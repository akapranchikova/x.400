use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::config::LdapConfig;

use super::cache::DirectoryCache;
use super::models::{DirectoryEntry, DistributionList};

/// Lightweight LDAP client that stores a synthetic directory for tests.
#[derive(Clone, Debug)]
pub struct LdapDirectoryClient {
    config: LdapConfig,
    cache: Arc<Mutex<DirectoryCache>>,
    entries: Arc<Mutex<HashMap<String, DirectoryEntry>>>,
    lists: Arc<Mutex<HashMap<String, DistributionList>>>,
}

impl LdapDirectoryClient {
    pub fn new(config: LdapConfig, cache: DirectoryCache) -> Self {
        Self {
            config,
            cache: Arc::new(Mutex::new(cache)),
            entries: Arc::new(Mutex::new(HashMap::new())),
            lists: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn upsert_entry(&self, entry: DirectoryEntry) {
        if let Ok(mut map) = self.entries.lock() {
            map.insert(entry.id.clone(), entry.clone());
        }
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(entry);
        }
    }

    pub fn upsert_list(&self, list: DistributionList) {
        if let Ok(mut map) = self.lists.lock() {
            map.insert(list.id.clone(), list);
        }
    }

    pub fn search(&self, query: &str) -> Vec<DirectoryEntry> {
        if let Ok(mut cache) = self.cache.lock() {
            let cached = cache.search(query);
            if !cached.is_empty() {
                return cached;
            }
        }
        let mut results = Vec::new();
        if let Ok(entries) = self.entries.lock() {
            for entry in entries.values() {
                if entry.matches_query(query) {
                    results.push(entry.clone());
                }
            }
        }
        results
    }

    pub fn get_entry(&self, id: &str) -> Option<DirectoryEntry> {
        if let Ok(mut cache) = self.cache.lock() {
            if let Some(entry) = cache.get(id) {
                return Some(entry);
            }
        }
        self.entries
            .lock()
            .ok()
            .and_then(|map| map.get(id).cloned())
    }

    pub fn get_distribution_list(&self, id: &str) -> Option<DistributionList> {
        self.lists.lock().ok().and_then(|map| map.get(id).cloned())
    }

    pub fn config(&self) -> &LdapConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn client() -> LdapDirectoryClient {
        LdapDirectoryClient::new(LdapConfig::default(), DirectoryCache::new(60, 32))
    }

    #[test]
    fn caches_search_results() {
        let client = client();
        client.upsert_entry(DirectoryEntry {
            id: "1".into(),
            display_name: "Alice Example".into(),
            rfc822: "alice@example.com".into(),
            or_address: "C=DE;S=Example".into(),
            attributes: HashMap::new(),
        });
        let first = client.search("alice");
        assert_eq!(first.len(), 1);
        let second = client.search("alice");
        assert_eq!(second.len(), 1);
    }

    #[test]
    fn returns_distribution_lists() {
        let client = client();
        client.upsert_list(DistributionList {
            id: "ops".into(),
            name: "Operations".into(),
            members: vec!["alice@example.com".into()],
        });
        let list = client.get_distribution_list("ops").unwrap();
        assert_eq!(list.members.len(), 1);
    }
}
