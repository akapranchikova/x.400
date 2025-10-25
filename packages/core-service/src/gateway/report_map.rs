/// Simplified representation of a delivery report exchanged between SMTP and X.400.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DeliveryReport {
    pub correlation_id: String,
    pub status: String,
    pub detail: String,
}

/// Mapper handling conversion between DSN/MDN and DR/Read reports.
#[derive(Default, Clone, Debug)]
pub struct ReportMapper;

impl ReportMapper {
    /// Convert a Delivery Status Notification into the internal representation.
    pub fn from_dsn(&self, payload: &str, correlation_id: &str) -> DeliveryReport {
        DeliveryReport {
            correlation_id: correlation_id.into(),
            status: payload
                .lines()
                .find(|line| line.starts_with("Status:"))
                .map(|line| line.trim_start_matches("Status:").trim().to_string())
                .unwrap_or_else(|| "unknown".into()),
            detail: payload.to_string(),
        }
    }

    /// Convert a Message Disposition Notification into a read report.
    pub fn from_mdn(&self, payload: &str, correlation_id: &str) -> DeliveryReport {
        let status = if payload.contains("displayed") {
            "read"
        } else {
            "processed"
        };
        DeliveryReport {
            correlation_id: correlation_id.into(),
            status: status.into(),
            detail: payload.to_string(),
        }
    }

    /// Serialize an X.400 delivery report back into DSN format.
    pub fn to_dsn(&self, report: &DeliveryReport) -> String {
        format!(
            "Status: {}\nCorrelation-ID: {}",
            report.status, report.correlation_id
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_dsn_status_line() {
        let mapper = ReportMapper::default();
        let report = mapper.from_dsn("Status: 2.0.0\nAction: delivered", "abc");
        assert_eq!(report.status, "2.0.0");
        assert_eq!(report.correlation_id, "abc");
    }

    #[test]
    fn serializes_to_dsn() {
        let mapper = ReportMapper::default();
        let payload = mapper.to_dsn(&DeliveryReport {
            correlation_id: "123".into(),
            status: "2.0.0".into(),
            detail: "Delivered".into(),
        });
        assert!(payload.contains("Status: 2.0.0"));
        assert!(payload.contains("Correlation-ID: 123"));
    }
}
