use std::collections::HashMap;

/// Representation of a directory entry resolved via LDAP.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DirectoryEntry {
    pub id: String,
    pub display_name: String,
    pub rfc822: String,
    pub or_address: String,
    pub attributes: HashMap<String, String>,
}

impl DirectoryEntry {
    pub fn matches_query(&self, query: &str) -> bool {
        let needle = query.to_lowercase();
        self.display_name.to_lowercase().contains(&needle)
            || self.rfc822.to_lowercase().contains(&needle)
            || self.or_address.to_lowercase().contains(&needle)
    }
}

/// Simple representation of a distribution list.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DistributionList {
    pub id: String,
    pub name: String,
    pub members: Vec<String>,
}
