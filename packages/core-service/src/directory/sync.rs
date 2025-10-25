use std::time::{Duration, Instant};

use super::ldap_client::LdapDirectoryClient;
use super::models::DistributionList;

/// Handles background synchronisation of directory entities.
#[derive(Clone, Debug)]
pub struct DirectorySync {
    client: LdapDirectoryClient,
    last_sync: Instant,
    interval: Duration,
}

impl DirectorySync {
    pub fn new(client: LdapDirectoryClient, interval: Duration) -> Self {
        Self {
            client,
            last_sync: Instant::now() - interval,
            interval,
        }
    }

    pub fn needs_sync(&self) -> bool {
        self.last_sync.elapsed() >= self.interval
    }

    pub fn sync_distribution_list(&mut self, list: DistributionList) {
        self.client.upsert_list(list);
        self.last_sync = Instant::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::LdapConfig;
    use crate::directory::cache::DirectoryCache;
    use crate::directory::models::DirectoryEntry;

    #[test]
    fn syncs_after_interval() {
        let client = LdapDirectoryClient::new(LdapConfig::default(), DirectoryCache::new(1, 8));
        let mut sync = DirectorySync::new(client.clone(), Duration::from_secs(1));
        assert!(sync.needs_sync());
        sync.sync_distribution_list(DistributionList {
            id: "team".into(),
            name: "Team".into(),
            members: vec![],
        });
        assert!(!sync.needs_sync());
        client.upsert_entry(DirectoryEntry {
            id: "1".into(),
            display_name: "Alice".into(),
            rfc822: "alice@example.com".into(),
            or_address: "C=DE;S=Alice".into(),
            attributes: Default::default(),
        });
    }
}
