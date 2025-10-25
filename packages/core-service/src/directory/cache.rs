use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

use super::models::DirectoryEntry;

/// In-memory cache with TTL semantics for directory entries.
#[derive(Debug)]
pub struct DirectoryCache {
    entries: HashMap<String, (DirectoryEntry, Instant)>,
    order: VecDeque<String>,
    ttl: Duration,
    capacity: usize,
}

impl DirectoryCache {
    pub fn new(ttl_seconds: u64, capacity: usize) -> Self {
        Self {
            entries: HashMap::new(),
            order: VecDeque::new(),
            ttl: Duration::from_secs(ttl_seconds.max(1)),
            capacity: capacity.max(8),
        }
    }

    pub fn insert(&mut self, entry: DirectoryEntry) {
        if self.entries.len() >= self.capacity {
            if let Some(oldest) = self.order.pop_front() {
                self.entries.remove(&oldest);
            }
        }
        self.order.push_back(entry.id.clone());
        self.entries
            .insert(entry.id.clone(), (entry, Instant::now()));
    }

    pub fn get(&mut self, id: &str) -> Option<DirectoryEntry> {
        self.cleanup();
        self.entries.get(id).map(|(entry, _)| entry.clone())
    }

    pub fn search(&mut self, query: &str) -> Vec<DirectoryEntry> {
        self.cleanup();
        self.entries
            .values()
            .filter(|(entry, _)| entry.matches_query(query))
            .map(|(entry, _)| entry.clone())
            .collect()
    }

    fn cleanup(&mut self) {
        let ttl = self.ttl;
        self.entries.retain(|key, (_value, inserted)| {
            if inserted.elapsed() > ttl {
                self.order.retain(|candidate| candidate != key);
                false
            } else {
                true
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, name: &str) -> DirectoryEntry {
        DirectoryEntry {
            id: id.into(),
            display_name: name.into(),
            rfc822: format!("{}@example.com", name.to_lowercase()),
            or_address: format!("C=DE;S={}", name),
            attributes: HashMap::new(),
        }
    }

    #[test]
    fn stores_entries_and_evicts() {
        let mut cache = DirectoryCache::new(60, 1);
        cache.insert(entry("1", "First"));
        cache.insert(entry("2", "Second"));
        assert!(cache.get("1").is_none());
        assert!(cache.get("2").is_some());
    }

    #[test]
    fn matches_search_query() {
        let mut cache = DirectoryCache::new(60, 5);
        cache.insert(entry("1", "Alice"));
        cache.insert(entry("2", "Bob"));
        let results = cache.search("alice");
        assert_eq!(results.len(), 1);
    }
}
