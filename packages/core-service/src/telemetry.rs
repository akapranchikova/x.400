use std::collections::VecDeque;
use std::fmt;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};

use once_cell::sync::OnceCell;
use opentelemetry::global;
use opentelemetry::trace::TracerProvider;
use opentelemetry::KeyValue;
use opentelemetry_sdk::export::trace::{ExportResult, SpanData, SpanExporter};
use opentelemetry_sdk::trace;
use opentelemetry_sdk::Resource;
use regex::Regex;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::warn;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_opentelemetry::OpenTelemetryLayer;
use tracing_subscriber::util::SubscriberInitError;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use zip::result::ZipError;
use zip::write::FileOptions;

use crate::config::TelemetryConfig;

#[derive(Debug, Error)]
pub enum TelemetryError {
    #[error("telemetry IO failure: {0}")]
    Io(#[from] io::Error),
    #[error("failed to initialise tracing: {0}")]
    Install(SubscriberInitError),
    #[error("telemetry archive failure: {0}")]
    Archive(#[from] ZipError),
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct TelemetryEvent {
    pub flow: String,
    pub latency_ms: u128,
    pub success: bool,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct TelemetryMetrics {
    pub messages_sent: u64,
    pub total_latency_ms: u128,
    pub latency_samples: u64,
    pub queue_depth: usize,
    pub error_count: u64,
}

impl TelemetryMetrics {
    pub fn average_latency(&self) -> f64 {
        if self.latency_samples == 0 {
            return 0.0;
        }
        self.total_latency_ms as f64 / self.latency_samples as f64
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct TelemetrySnapshot {
    pub metrics: TelemetryMetrics,
    pub average_latency_ms: f64,
    pub events: Vec<TelemetryEvent>,
    pub last_errors: Vec<String>,
}

#[derive(Default)]
struct TelemetryInner {
    config: TelemetryConfig,
    metrics: Mutex<TelemetryMetrics>,
    events: Mutex<VecDeque<TelemetryEvent>>,
    errors: Mutex<VecDeque<String>>,
    log_path: PathBuf,
    guard: OnceCell<WorkerGuard>,
}

/// Manager responsible for telemetry and diagnostics.
#[derive(Clone, Default)]
pub struct TelemetryManager {
    inner: Arc<TelemetryInner>,
}

impl TelemetryManager {
    pub fn from_config(config: &TelemetryConfig) -> Self {
        let base = PathBuf::from(&config.local_path);
        let log_path = base.join("trace.jsonl");
        let inner = TelemetryInner {
            config: config.clone(),
            metrics: Mutex::new(TelemetryMetrics::default()),
            events: Mutex::new(VecDeque::with_capacity(256)),
            errors: Mutex::new(VecDeque::with_capacity(64)),
            log_path,
            guard: OnceCell::new(),
        };

        let manager = Self {
            inner: Arc::new(inner),
        };

        if manager.inner.config.enabled {
            if let Err(err) = manager.initialise_runtime() {
                warn!(
                    target = "telemetry",
                    "failed to initialise telemetry runtime: {err}"
                );
            }
        }

        manager
    }

    fn initialise_runtime(&self) -> Result<(), TelemetryError> {
        let base = PathBuf::from(&self.inner.config.local_path);
        fs::create_dir_all(&base)?;
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.inner.log_path)?;
        let (writer, guard) = tracing_appender::non_blocking(file);
        self.inner.guard.get_or_init(|| guard);

        let exporter = FileSpanExporter {
            manager: self.clone(),
        };
        let provider = trace::TracerProvider::builder()
            .with_simple_exporter(exporter)
            .with_config(trace::Config::default().with_resource(Resource::new(vec![
                KeyValue::new("service.name", "x400-core"),
            ])))
            .build();
        let tracer = provider.tracer("core-service");
        let layer = OpenTelemetryLayer::new(tracer);

        let fmt_layer = tracing_subscriber::fmt::layer()
            .json()
            .with_ansi(false)
            .with_writer(writer);

        let env_filter =
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt_layer)
            .with(layer)
            .try_init()
            .map_err(TelemetryError::Install)?;

        global::set_tracer_provider(provider);
        Ok(())
    }

    pub fn record_flow(&self, flow: &str, latency: Duration, success: bool, queue_depth: usize) {
        if !self.inner.config.enabled {
            return;
        }
        let mut metrics = self.inner.metrics.lock().expect("metrics lock");
        if success {
            metrics.messages_sent += 1;
        } else {
            metrics.error_count += 1;
        }
        metrics.queue_depth = queue_depth;
        metrics.total_latency_ms += latency.as_millis();
        metrics.latency_samples += 1;
        drop(metrics);

        let event = TelemetryEvent {
            flow: flow.to_string(),
            latency_ms: latency.as_millis(),
            success,
            timestamp: now_millis(),
        };
        self.push_event(event.clone());
        if let Err(err) = self.append_event(&event) {
            warn!(
                target = "telemetry",
                "failed to persist telemetry event: {err}"
            );
        }
        if let Err(err) = self.persist_snapshot() {
            warn!(target = "telemetry", "failed to persist snapshot: {err}");
        }
        if !success {
            self.record_error(format!("flow {flow} reported failure"));
        }
    }

    pub fn record_error(&self, message: impl Into<String>) {
        if !self.inner.config.enabled {
            return;
        }
        let mut errors = self.inner.errors.lock().expect("errors lock");
        let mut buffer = redact(message.into());
        if buffer.len() > 512 {
            buffer.truncate(512);
        }
        if errors.len() >= 64 {
            errors.pop_front();
        }
        errors.push_back(buffer);
        if let Err(err) = self.persist_snapshot() {
            warn!(target = "telemetry", "failed to persist snapshot: {err}");
        }
    }

    pub fn snapshot(&self) -> TelemetrySnapshot {
        let metrics = self
            .inner
            .metrics
            .lock()
            .map(|m| m.clone())
            .unwrap_or_default();
        let events: Vec<TelemetryEvent> = self
            .inner
            .events
            .lock()
            .map(|queue| queue.iter().cloned().collect())
            .unwrap_or_default();
        let last_errors = self
            .inner
            .errors
            .lock()
            .map(|queue| queue.iter().cloned().collect())
            .unwrap_or_default();

        TelemetrySnapshot {
            average_latency_ms: metrics.average_latency(),
            metrics,
            events,
            last_errors,
        }
    }

    pub fn queue_depth(&self) -> usize {
        self.inner
            .metrics
            .lock()
            .map(|metrics| metrics.queue_depth)
            .unwrap_or_default()
    }

    pub fn append_remote(&self, bundle: &[u8]) -> Result<PathBuf, TelemetryError> {
        let base = PathBuf::from(&self.inner.config.local_path);
        fs::create_dir_all(&base)?;
        let path = base.join(format!("remote-{}.bin", now_millis()));
        fs::write(&path, bundle)?;
        Ok(path)
    }

    pub fn bundle(&self) -> Result<Vec<u8>, TelemetryError> {
        let cursor = std::io::Cursor::new(Vec::new());
        let mut writer = zip::ZipWriter::new(cursor);
        let snapshot = self.snapshot();
        let serialized = serde_json::to_vec_pretty(&snapshot).expect("serialize snapshot");
        let snapshot_path = self.snapshot_path();
        if let Some(parent) = snapshot_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&snapshot_path, &serialized)?;
        writer.start_file("snapshot.json", FileOptions::default())?;
        writer.write_all(&serialized)?;

        if Path::new(&self.inner.log_path).exists() {
            let contents = fs::read(&self.inner.log_path)?;
            writer.start_file("trace.jsonl", FileOptions::default())?;
            writer.write_all(&contents)?;
        }

        let cursor = writer.finish()?;
        Ok(cursor.into_inner())
    }

    fn push_event(&self, event: TelemetryEvent) {
        if let Ok(mut queue) = self.inner.events.lock() {
            if queue.len() >= 256 {
                queue.pop_front();
            }
            queue.push_back(event);
        }
    }

    fn append_event(&self, event: &TelemetryEvent) -> Result<(), io::Error> {
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.inner.log_path)?;
        let line = serde_json::to_vec(event).unwrap_or_default();
        file.write_all(&line)?;
        file.write_all(b"\n")?;
        Ok(())
    }

    fn persist_snapshot(&self) -> Result<(), io::Error> {
        let snapshot = self.snapshot();
        let serialized = serde_json::to_vec_pretty(&snapshot).expect("serialize snapshot");
        let path = self.snapshot_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serialized)?;
        Ok(())
    }

    fn snapshot_path(&self) -> PathBuf {
        Path::new(&self.inner.log_path)
            .parent()
            .map(|parent| parent.join("snapshot.json"))
            .unwrap_or_else(|| PathBuf::from("snapshot.json"))
    }
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn redact(input: String) -> String {
    static RE_EMAIL: once_cell::sync::Lazy<Regex> = once_cell::sync::Lazy::new(|| {
        Regex::new(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}").expect("regex")
    });

    RE_EMAIL.replace_all(&input, "[REDACTED]").to_string()
}

struct FileSpanExporter {
    manager: TelemetryManager,
}

impl fmt::Debug for FileSpanExporter {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("FileSpanExporter").finish()
    }
}

impl SpanExporter for FileSpanExporter {
    fn export(
        &mut self,
        batch: Vec<SpanData>,
    ) -> Pin<Box<dyn std::future::Future<Output = ExportResult> + Send + 'static>> {
        let manager = self.manager.clone();
        Box::pin(async move {
            if !manager.inner.config.enabled {
                return Ok(());
            }
            for span in batch {
                let mut event = TelemetryEvent {
                    flow: span.name.to_string(),
                    latency_ms: span
                        .end_time
                        .duration_since(span.start_time)
                        .unwrap_or_default()
                        .as_millis(),
                    success: true,
                    timestamp: now_millis(),
                };
                event.flow = redact(event.flow);
                if let Err(err) = manager.append_event(&event) {
                    warn!(target = "telemetry", "failed to export span: {err}");
                }
                manager.push_event(event);
            }
            Ok(())
        })
    }

    fn shutdown(
        &mut self,
    ) -> Pin<Box<dyn std::future::Future<Output = ExportResult> + Send + 'static>> {
        Box::pin(async { Ok(()) })
    }
}

pub fn tracer(flow: &str) -> opentelemetry::global::BoxedTracer {
    let provider = global::tracer_provider();
    provider.tracer(flow)
}
