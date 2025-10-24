use crate::config::{SecurityConfig, TransportConfig, TransportMode};
use crate::models::{Message, MessageContent, MessageEnvelope, Report, ReportType};
use crate::transport::tls::{self, TransportTlsState};
use anyhow::{anyhow, bail, Context, Result};
use chrono::Utc;
use libloading::Library;
use serde::Deserialize;
use std::ffi::CString;
use std::os::raw::c_char;
use std::ptr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tracing::debug;
use uuid::Uuid;

#[derive(Clone)]
pub struct P7DriverConfig {
    pub transport: TransportConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Clone)]
pub struct P7DriverStatus {
    pub mode: TransportMode,
    pub tls: TransportTlsState,
    pub session_active: bool,
    pub preferred_profile: Option<String>,
}

#[derive(Clone)]
pub struct P7Driver {
    config: TransportConfig,
    tls_state: TransportTlsState,
    security: SecurityConfig,
    backend: Arc<dyn SdkApi + Send + Sync>,
    session: Arc<Mutex<Option<SdkSession>>>,
}

#[derive(Debug, Clone)]
struct SdkSession {
    handle: SdkHandle,
    profile: String,
}

type SdkHandle = u64;

type DynSdk = dyn SdkApi + Send + Sync;

trait SdkApi {
    fn bind(&self, profile: &str) -> Result<SdkHandle>;
    fn unbind(&self, handle: SdkHandle) -> Result<()>;
    fn register_ms(&self, handle: SdkHandle, profile: &str) -> Result<()>;
    fn submit(&self, handle: SdkHandle, message: &Message) -> Result<SdkSubmitResult>;
    fn fetch(&self, handle: SdkHandle, folder: &str) -> Result<Vec<Message>>;
    fn list(&self, handle: SdkHandle, folder: &str) -> Result<Vec<MessageEnvelope>>;
    fn delete(&self, handle: SdkHandle, message_id: Uuid) -> Result<()>;
}

#[derive(Debug, Clone)]
struct SdkSubmitResult {
    queue_reference: Option<String>,
    reports: Vec<Report>,
}

impl P7Driver {
    pub fn new(config: P7DriverConfig) -> Result<Self> {
        if config.transport.mode != TransportMode::Sdk {
            return Err(anyhow!(
                "SDK mode is disabled. Launch the core service with transport.mode='sdk' to activate the driver."
            ));
        }

        let tls_state = tls::validate(&config.transport);
        let backend = Arc::new(FfiSdk::new(&config.transport)?);

        Ok(Self {
            config: config.transport,
            tls_state,
            security: config.security,
            backend,
            session: Arc::new(Mutex::new(None)),
        })
    }

    #[cfg(test)]
    fn with_backend(
        transport: TransportConfig,
        security: SecurityConfig,
        backend: Arc<DynSdk>,
    ) -> Result<Self> {
        if transport.mode != TransportMode::Sdk {
            return Err(anyhow!(
                "P7 driver requires transport mode 'sdk'; current mode is '{:?}'",
                transport.mode
            ));
        }

        let tls_state = tls::validate(&transport);

        Ok(Self {
            config: transport,
            tls_state,
            security,
            backend,
            session: Arc::new(Mutex::new(None)),
        })
    }

    pub fn status(&self) -> P7DriverStatus {
        let session_active = self
            .session
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false);

        P7DriverStatus {
            mode: self.config.mode,
            tls: self.tls_state.clone(),
            session_active,
            preferred_profile: self.config.sdk.preferred_profile.clone(),
        }
    }

    pub fn bind(&self, profile: &str) -> Result<()> {
        ensure_sdk_mode(self.config.mode)?;

        let resolved = self.resolve_profile(profile)?;
        let handle = self.backend.bind(&resolved)?;

        let mut slot = self
            .session
            .lock()
            .map_err(|_| anyhow!("SDK session mutex poisoned"))?;
        *slot = Some(SdkSession {
            handle,
            profile: resolved,
        });

        Ok(())
    }

    pub fn unbind(&self) -> Result<()> {
        ensure_sdk_mode(self.config.mode)?;

        let mut slot = self
            .session
            .lock()
            .map_err(|_| anyhow!("SDK session mutex poisoned"))?;

        if let Some(session) = slot.take() {
            self.backend.unbind(session.handle)?;
        }

        Ok(())
    }

    pub fn register_ms(&self, profile: &str) -> Result<()> {
        ensure_sdk_mode(self.config.mode)?;
        let session = self.current_session()?;
        let resolved = if profile.trim().is_empty() {
            session.profile.clone()
        } else {
            profile.trim().to_string()
        };

        self.backend.register_ms(session.handle, &resolved)
    }

    pub fn submit(&self, message: &Message) -> Result<()> {
        ensure_sdk_mode(self.config.mode)?;
        let session = self.current_session()?;

        let start = Instant::now();
        let receipt = self.backend.submit(session.handle, message)?;
        let duration = start.elapsed();
        debug!(
            elapsed_ms = duration.as_millis() as u64,
            queue_reference = receipt.queue_reference.as_deref().unwrap_or("n/a"),
            "Submitted message via SDK"
        );

        if !receipt.reports.is_empty() {
            for report in receipt.reports {
                debug!(?report, "Vendor SDK returned delivery report");
            }
        }

        Ok(())
    }

    pub fn fetch(&self, folder: &str) -> Result<Vec<Message>> {
        ensure_sdk_mode(self.config.mode)?;
        let session = self.current_session()?;
        let folder = folder.trim();
        let target = if folder.is_empty() { "inbox" } else { folder };

        let start = Instant::now();
        let messages = self.backend.fetch(session.handle, target)?;
        let duration = start.elapsed();
        debug!(
            elapsed_ms = duration.as_millis() as u64,
            count = messages.len(),
            folder = target,
            "Fetched messages via SDK"
        );

        Ok(messages)
    }

    pub fn list(&self, folder: &str) -> Result<Vec<MessageEnvelope>> {
        ensure_sdk_mode(self.config.mode)?;
        let session = self.current_session()?;
        let folder = folder.trim();
        let target = if folder.is_empty() { "inbox" } else { folder };

        self.backend.list(session.handle, target)
    }

    pub fn delete(&self, message_id: Uuid) -> Result<()> {
        ensure_sdk_mode(self.config.mode)?;
        let session = self.current_session()?;
        self.backend.delete(session.handle, message_id)
    }

    pub fn tls_state(&self) -> &TransportTlsState {
        &self.tls_state
    }

    pub fn security_config(&self) -> &SecurityConfig {
        &self.security
    }

    fn current_session(&self) -> Result<SdkSession> {
        self.session
            .lock()
            .map_err(|_| anyhow!("SDK session mutex poisoned"))?
            .clone()
            .ok_or_else(|| anyhow!("No active SDK session. Call bind first."))
    }

    fn resolve_profile(&self, explicit: &str) -> Result<String> {
        let trimmed = explicit.trim();
        if trimmed.is_empty() {
            if let Some(preferred) = &self.config.sdk.preferred_profile {
                Ok(preferred.clone())
            } else {
                bail!("No profile specified and transport.sdk.preferred_profile is unset");
            }
        } else {
            Ok(trimmed.to_string())
        }
    }
}

struct FfiSdk {
    library: Library,
    timeouts: SdkTimeouts,
}

#[derive(Clone, Copy)]
struct SdkTimeouts {
    connect: Duration,
    operation: Duration,
}

impl From<&TransportConfig> for SdkTimeouts {
    fn from(config: &TransportConfig) -> Self {
        Self {
            connect: Duration::from_millis(config.sdk.connect_timeout_ms),
            operation: Duration::from_millis(config.sdk.operation_timeout_ms),
        }
    }
}

#[repr(C)]
struct SdkBuffer {
    data: *mut u8,
    len: usize,
}

impl Default for SdkBuffer {
    fn default() -> Self {
        Self {
            data: ptr::null_mut(),
            len: 0,
        }
    }
}

#[derive(Debug, Deserialize)]
struct RawMessage {
    envelope: MessageEnvelope,
    content: MessageContent,
    #[serde(default)]
    reports: Vec<RawReport>,
}

#[derive(Debug, Deserialize)]
struct RawSubmitResult {
    #[serde(default)]
    queue_reference: Option<String>,
    #[serde(default)]
    reports: Vec<RawReport>,
}

#[derive(Debug, Deserialize)]
struct RawReport {
    id: Uuid,
    #[serde(alias = "message_id")]
    message_id: Uuid,
    #[serde(alias = "type")]
    kind: RawReportKind,
    timestamp: chrono::DateTime<Utc>,
    #[serde(default, alias = "reason_code")]
    reason_code: Option<i32>,
    #[serde(default, alias = "diagnostic_code")]
    diagnostic_code: Option<i32>,
    #[serde(default, alias = "supplemental_info")]
    supplemental_info: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum RawReportKind {
    Delivery,
    NonDelivery,
    Read,
}

impl From<RawReportKind> for ReportType {
    fn from(value: RawReportKind) -> Self {
        match value {
            RawReportKind::Delivery => ReportType::Delivery,
            RawReportKind::NonDelivery => ReportType::NonDelivery,
            RawReportKind::Read => ReportType::Read,
        }
    }
}

impl FfiSdk {
    fn new(config: &TransportConfig) -> Result<Self> {
        let library_path = config
            .sdk
            .library_path
            .clone()
            .or_else(|| std::env::var("X400_SDK_LIBRARY").ok())
            .ok_or_else(|| anyhow!("transport.sdk.library_path must be configured in SDK mode"))?;

        let library = unsafe { Library::new(&library_path) }
            .with_context(|| format!("failed to load vendor SDK at {library_path}"))?;

        Ok(Self {
            library,
            timeouts: SdkTimeouts::from(config),
        })
    }

    fn bind(&self, profile: &str) -> Result<SdkHandle> {
        unsafe {
            type BindFn = unsafe extern "C" fn(*const c_char, u64, u64, *mut SdkHandle) -> i32;

            let func: libloading::Symbol<BindFn> = self
                .library
                .get(b"x400_sdk_bind\0")
                .context("missing x400_sdk_bind")?;
            let profile = CString::new(profile)?;
            let mut handle: SdkHandle = 0;
            let code = func(
                profile.as_ptr(),
                self.timeouts.connect.as_millis() as u64,
                self.timeouts.operation.as_millis() as u64,
                &mut handle,
            );
            map_sdk_result(code, "bind")?;
            Ok(handle)
        }
    }

    fn unbind(&self, handle: SdkHandle) -> Result<()> {
        unsafe {
            type UnbindFn = unsafe extern "C" fn(SdkHandle) -> i32;
            let func: libloading::Symbol<UnbindFn> = self
                .library
                .get(b"x400_sdk_unbind\0")
                .context("missing x400_sdk_unbind")?;
            let code = func(handle);
            map_sdk_result(code, "unbind")
        }
    }

    fn register_ms(&self, handle: SdkHandle, profile: &str) -> Result<()> {
        unsafe {
            type RegisterFn = unsafe extern "C" fn(SdkHandle, *const c_char) -> i32;
            let func: libloading::Symbol<RegisterFn> = self
                .library
                .get(b"x400_sdk_register_ms\0")
                .context("missing x400_sdk_register_ms")?;
            let profile = CString::new(profile)?;
            let code = func(handle, profile.as_ptr());
            map_sdk_result(code, "register_ms")
        }
    }

    fn submit(&self, handle: SdkHandle, message: &Message) -> Result<SdkSubmitResult> {
        unsafe {
            type SubmitFn =
                unsafe extern "C" fn(SdkHandle, *const u8, usize, *mut SdkBuffer) -> i32;

            let func: libloading::Symbol<SubmitFn> = self
                .library
                .get(b"x400_sdk_submit\0")
                .context("missing x400_sdk_submit")?;
            let payload = serde_json::to_vec(message)?;
            let mut buffer = SdkBuffer::default();
            let code = func(handle, payload.as_ptr(), payload.len(), &mut buffer);
            map_sdk_result(code, "submit")?;
            let bytes = self.take_buffer(buffer)?;
            let raw: RawSubmitResult = serde_json::from_slice(&bytes)
                .context("failed to deserialize SDK submit receipt")?;
            Ok(SdkSubmitResult {
                queue_reference: raw.queue_reference,
                reports: translate_reports(raw.reports),
            })
        }
    }

    fn fetch(&self, handle: SdkHandle, folder: &str) -> Result<Vec<Message>> {
        unsafe {
            type FetchFn = unsafe extern "C" fn(SdkHandle, *const c_char, *mut SdkBuffer) -> i32;
            let func: libloading::Symbol<FetchFn> = self
                .library
                .get(b"x400_sdk_fetch\0")
                .context("missing x400_sdk_fetch")?;
            let folder = CString::new(folder)?;
            let mut buffer = SdkBuffer::default();
            let code = func(handle, folder.as_ptr(), &mut buffer);
            map_sdk_result(code, "fetch")?;
            let bytes = self.take_buffer(buffer)?;
            let raw: Vec<RawMessage> = serde_json::from_slice(&bytes)
                .context("failed to deserialize SDK fetch payload")?;
            Ok(raw.into_iter().map(convert_message).collect())
        }
    }

    fn list(&self, handle: SdkHandle, folder: &str) -> Result<Vec<MessageEnvelope>> {
        unsafe {
            type ListFn = unsafe extern "C" fn(SdkHandle, *const c_char, *mut SdkBuffer) -> i32;
            let func: libloading::Symbol<ListFn> = self
                .library
                .get(b"x400_sdk_list\0")
                .context("missing x400_sdk_list")?;
            let folder = CString::new(folder)?;
            let mut buffer = SdkBuffer::default();
            let code = func(handle, folder.as_ptr(), &mut buffer);
            map_sdk_result(code, "list")?;
            let bytes = self.take_buffer(buffer)?;
            let envelopes: Vec<MessageEnvelope> =
                serde_json::from_slice(&bytes).context("failed to deserialize SDK list payload")?;
            Ok(envelopes)
        }
    }

    fn delete(&self, handle: SdkHandle, message_id: Uuid) -> Result<()> {
        unsafe {
            type DeleteFn = unsafe extern "C" fn(SdkHandle, *const c_char) -> i32;
            let func: libloading::Symbol<DeleteFn> = self
                .library
                .get(b"x400_sdk_delete\0")
                .context("missing x400_sdk_delete")?;
            let id = CString::new(message_id.to_string())?;
            let code = func(handle, id.as_ptr());
            map_sdk_result(code, "delete")
        }
    }

    fn take_buffer(&self, mut buffer: SdkBuffer) -> Result<Vec<u8>> {
        unsafe {
            if buffer.data.is_null() || buffer.len == 0 {
                return Ok(Vec::new());
            }

            let data = std::slice::from_raw_parts(buffer.data, buffer.len).to_vec();
            let free: libloading::Symbol<unsafe extern "C" fn(*mut u8, usize)> = self
                .library
                .get(b"x400_sdk_free_buffer\0")
                .context("missing x400_sdk_free_buffer")?;
            free(buffer.data, buffer.len);
            buffer.data = ptr::null_mut();
            buffer.len = 0;
            Ok(data)
        }
    }
}

impl SdkApi for FfiSdk {
    fn bind(&self, profile: &str) -> Result<SdkHandle> {
        self.bind(profile)
    }

    fn unbind(&self, handle: SdkHandle) -> Result<()> {
        self.unbind(handle)
    }

    fn register_ms(&self, handle: SdkHandle, profile: &str) -> Result<()> {
        self.register_ms(handle, profile)
    }

    fn submit(&self, handle: SdkHandle, message: &Message) -> Result<SdkSubmitResult> {
        self.submit(handle, message)
    }

    fn fetch(&self, handle: SdkHandle, folder: &str) -> Result<Vec<Message>> {
        self.fetch(handle, folder)
    }

    fn list(&self, handle: SdkHandle, folder: &str) -> Result<Vec<MessageEnvelope>> {
        self.list(handle, folder)
    }

    fn delete(&self, handle: SdkHandle, message_id: Uuid) -> Result<()> {
        self.delete(handle, message_id)
    }
}

fn convert_message(raw: RawMessage) -> Message {
    Message {
        envelope: raw.envelope,
        content: raw.content,
        reports: translate_reports(raw.reports),
    }
}

fn translate_reports(raw: Vec<RawReport>) -> Vec<Report> {
    raw.into_iter()
        .map(|report| {
            let report_type: ReportType = report.kind.into();
            let reason_text = map_reason_description(report_type.clone(), report.reason_code);
            let diagnostic_text = map_diagnostic_description(report.diagnostic_code);

            let supplemental = match (reason_text, report.supplemental_info) {
                (Some(reason), Some(existing)) => Some(format!("{reason}; {existing}")),
                (Some(reason), None) => Some(reason),
                (None, supplemental) => supplemental,
            };

            Report {
                id: report.id,
                message_id: report.message_id,
                r#type: report_type,
                timestamp: report.timestamp,
                diagnostic_code: diagnostic_text,
                supplemental_info: supplemental,
            }
        })
        .collect()
}

fn map_reason_description(report_type: ReportType, reason_code: Option<i32>) -> Option<String> {
    let reason = reason_code?;
    let description = match report_type {
        ReportType::Delivery => match reason {
            0 => "Delivered to recipient".to_string(),
            1 => "Relayed to downstream MTA".to_string(),
            2 => "Delivery deferred by recipient".to_string(),
            3 => "Converted to alternate representation".to_string(),
            _ => format!("Delivery report reason {reason}"),
        },
        ReportType::NonDelivery => match reason {
            0 => "Unable to transfer to recipient".to_string(),
            1 => "Incompatible content type".to_string(),
            2 => "Recipient unknown".to_string(),
            3 => "Security policy rejected".to_string(),
            _ => format!("Non-delivery reason {reason}"),
        },
        ReportType::Read => match reason {
            0 => "Recipient displayed message".to_string(),
            1 => "Recipient deleted without reading".to_string(),
            2 => "Recipient printed message".to_string(),
            _ => format!("Read report reason {reason}"),
        },
    };
    Some(description)
}

fn map_diagnostic_description(code: Option<i32>) -> Option<String> {
    let diagnostic = code?;
    let description = match diagnostic {
        0 => "No diagnostic provided".to_string(),
        4 => "Transfer failure".to_string(),
        32 => "Encoded information types not supported".to_string(),
        44 => "Content too large".to_string(),
        68 => "Security labels required".to_string(),
        224 => "Physical rendition not supported".to_string(),
        _ => format!("Diagnostic code {diagnostic}"),
    };
    Some(description)
}

fn ensure_sdk_mode(mode: TransportMode) -> Result<()> {
    if mode == TransportMode::Sdk {
        Ok(())
    } else {
        Err(anyhow!(
            "P7 driver requires transport mode 'sdk'; current mode is '{mode:?}'"
        ))
    }
}

fn map_sdk_result(code: i32, operation: &str) -> Result<()> {
    match code {
        0 => Ok(()),
        -1 => bail!("{operation} timed out"),
        1 => bail!("{operation} failed: invalid profile"),
        2 => bail!("{operation} failed: transport unreachable"),
        3 => bail!("{operation} failed: authentication rejected"),
        4 => bail!("{operation} failed: TLS handshake failure"),
        other => bail!("Vendor SDK returned error code {other} during {operation}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{SecurityConfig, TransportConfig, TransportMode, TransportTlsConfig};
    use crate::models::{
        Attachment, MessageContent, MessageEnvelope, MessageStatus, OrName, X400Address,
    };
    use chrono::TimeZone;
    use std::sync::atomic::{AtomicU64, Ordering};

    struct MockSdk {
        next_handle: AtomicU64,
        bound_profiles: Mutex<Vec<String>>,
        stored_messages: Mutex<Vec<Message>>,
        stored_envelopes: Mutex<Vec<MessageEnvelope>>,
    }

    impl MockSdk {
        fn new() -> Self {
            Self {
                next_handle: AtomicU64::new(1),
                bound_profiles: Mutex::new(Vec::new()),
                stored_messages: Mutex::new(Vec::new()),
                stored_envelopes: Mutex::new(Vec::new()),
            }
        }

        fn example_message() -> Message {
            let envelope = MessageEnvelope {
                id: Uuid::new_v4(),
                subject: "Integration".to_string(),
                sender: X400Address {
                    or_name: OrName {
                        c: "DE".to_string(),
                        admd: None,
                        prmd: Some("TEST".to_string()),
                        o: Some("Example".to_string()),
                        ou: vec!["Lab".to_string()],
                        surname: Some("Doe".to_string()),
                        given_name: Some("John".to_string()),
                    },
                    dda: vec![],
                    routing_hints: vec![],
                },
                to: vec![],
                cc: vec![],
                bcc: vec![],
                folder: "inbox".to_string(),
                status: MessageStatus::Delivered,
                priority: crate::models::MessagePriority::Normal,
                sensitivity: crate::models::MessageSensitivity::Normal,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                message_id: "<test@example>".to_string(),
            };
            let content = MessageContent {
                text: "Hello".to_string(),
                attachments: vec![Attachment {
                    id: Uuid::new_v4(),
                    filename: "note.txt".to_string(),
                    mime_type: "text/plain".to_string(),
                    size: 12,
                }],
            };
            Message {
                envelope,
                content,
                reports: Vec::new(),
            }
        }
    }

    impl SdkApi for MockSdk {
        fn bind(&self, profile: &str) -> Result<SdkHandle> {
            self.bound_profiles
                .lock()
                .expect("bound profile lock")
                .push(profile.to_string());
            Ok(self.next_handle.fetch_add(1, Ordering::SeqCst))
        }

        fn unbind(&self, _handle: SdkHandle) -> Result<()> {
            Ok(())
        }

        fn register_ms(&self, _handle: SdkHandle, _profile: &str) -> Result<()> {
            Ok(())
        }

        fn submit(&self, _handle: SdkHandle, message: &Message) -> Result<SdkSubmitResult> {
            self.stored_messages
                .lock()
                .expect("messages lock")
                .push(message.clone());
            Ok(SdkSubmitResult {
                queue_reference: Some("sdk://queue/123".to_string()),
                reports: vec![Report {
                    id: Uuid::new_v4(),
                    message_id: message.envelope.id,
                    r#type: ReportType::Delivery,
                    timestamp: Utc::now(),
                    diagnostic_code: Some("No diagnostic provided".to_string()),
                    supplemental_info: Some("Delivered to recipient".to_string()),
                }],
            })
        }

        fn fetch(&self, _handle: SdkHandle, _folder: &str) -> Result<Vec<Message>> {
            Ok(vec![Self::example_message()])
        }

        fn list(&self, _handle: SdkHandle, _folder: &str) -> Result<Vec<MessageEnvelope>> {
            let envelope = Self::example_message().envelope;
            let mut stored = self.stored_envelopes.lock().expect("envelopes lock");
            if stored.is_empty() {
                stored.push(envelope.clone());
            }
            Ok(stored.clone())
        }

        fn delete(&self, _handle: SdkHandle, _message_id: Uuid) -> Result<()> {
            Ok(())
        }
    }

    fn base_transport() -> TransportConfig {
        TransportConfig {
            mode: TransportMode::Sdk,
            profiles_dir: "profiles".into(),
            tls: TransportTlsConfig {
                enabled: false,
                ..Default::default()
            },
            fingerprints: vec![],
            sdk: crate::config::TransportSdkConfig {
                library_path: Some("/tmp/libmock.so".to_string()),
                preferred_profile: Some("primary".to_string()),
                connect_timeout_ms: 1_000,
                operation_timeout_ms: 1_000,
            },
        }
    }

    #[test]
    fn bind_uses_preferred_profile_when_empty() {
        let mock = Arc::new(MockSdk::new());
        let backend: Arc<DynSdk> = mock.clone();
        let driver = P7Driver::with_backend(base_transport(), SecurityConfig::default(), backend)
            .expect("driver");

        driver.bind("").expect("bind");

        let profiles = mock.bound_profiles.lock().unwrap().clone();
        assert_eq!(profiles, vec!["primary".to_string()]);
    }

    #[test]
    fn submit_persists_message_in_mock_backend() {
        let mock = Arc::new(MockSdk::new());
        let backend: Arc<DynSdk> = mock.clone();
        let driver = P7Driver::with_backend(base_transport(), SecurityConfig::default(), backend)
            .expect("driver");
        driver.bind("integration").expect("bind");
        let message = MockSdk::example_message();
        driver.submit(&message).expect("submit");
        let stored = mock.stored_messages.lock().unwrap();
        assert_eq!(stored.len(), 1);
    }

    #[test]
    fn translate_reports_maps_reason_and_diagnostic() {
        let report = RawReport {
            id: Uuid::nil(),
            message_id: Uuid::nil(),
            kind: RawReportKind::NonDelivery,
            timestamp: chrono::Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap(),
            reason_code: Some(2),
            diagnostic_code: Some(44),
            supplemental_info: None,
        };
        let reports = translate_reports(vec![report]);
        assert_eq!(reports.len(), 1);
        let mapped = &reports[0];
        assert_eq!(
            mapped.supplemental_info.as_deref(),
            Some("Recipient unknown")
        );
        assert_eq!(mapped.diagnostic_code.as_deref(), Some("Content too large"));
    }
}
