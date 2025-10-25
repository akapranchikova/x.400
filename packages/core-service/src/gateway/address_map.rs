use std::collections::HashMap;

use regex::Regex;
use unicode_normalization::UnicodeNormalization;

use crate::models::Address;

/// Error returned when address mapping cannot be completed.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MappingError {
    #[error("no mapping rule matched address")]
    NoMatch,
    #[error("alias not found")]
    AliasMissing,
}

/// Mapping rule converting an O/R address into an RFC822 address.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AddressMappingRule {
    template: String,
}

impl AddressMappingRule {
    pub fn new(template: impl Into<String>) -> Self {
        Self {
            template: template.into(),
        }
    }

    fn placeholder_value(&self, placeholder: &str, address: &Address) -> Option<String> {
        match placeholder {
            "C" => Some(address.country.clone()),
            "O" => Some(address.organization.clone()),
            "S" => Some(address.surname.clone()),
            "G" => Some(address.surname.clone()),
            _ => None,
        }
    }

    fn sanitize(value: &str) -> String {
        let ascii = value
            .nfkd()
            .filter(|c| c.is_ascii())
            .collect::<String>()
            .to_lowercase();
        ascii
            .chars()
            .map(|c| match c {
                'a'..='z' | '0'..='9' => c,
                _ => '-',
            })
            .collect::<String>()
    }

    pub fn apply(&self, address: &Address) -> Option<String> {
        let mut rendered = self.template.clone();
        for placeholder in ["G", "S", "O", "C"] {
            let token = format!("{{{placeholder}}}");
            if rendered.contains(&token) {
                let value = self.placeholder_value(placeholder, address)?;
                rendered = rendered.replace(&token, &Self::sanitize(&value));
            }
        }
        if rendered.contains('{') {
            return None;
        }
        Some(rendered)
    }

    fn as_regex(&self) -> Option<Regex> {
        let mut escaped = Regex::escape(&self.template);
        for placeholder in ["G", "S", "O", "C"] {
            let token = format!("\\{{{placeholder}\\}}");
            if escaped.contains(&token) {
                escaped = escaped.replace(&token, &format!("(?P<{placeholder}>[a-z0-9-]+)"));
            }
        }
        Regex::new(&format!("^{escaped}$")).ok()
    }

    pub fn invert(&self, email: &str) -> Option<Address> {
        let regex = self.as_regex()?;
        let captures = regex.captures(email)?;
        let sanitize_back = |value: &str| {
            let mut parts = value
                .split('-')
                .filter(|segment| !segment.is_empty())
                .map(|segment| {
                    let mut chars = segment.chars();
                    match chars.next() {
                        Some(first) => format!("{}{}", first.to_ascii_uppercase(), chars.as_str()),
                        None => String::new(),
                    }
                })
                .collect::<Vec<_>>();
            if parts.is_empty() {
                String::new()
            } else if parts.len() == 1 {
                parts.remove(0)
            } else {
                parts.join(" ")
            }
        };

        Some(Address {
            country: captures
                .name("C")
                .map(|m| sanitize_back(m.as_str()))
                .unwrap_or_else(|| "XX".into()),
            organization: captures
                .name("O")
                .map(|m| sanitize_back(m.as_str()))
                .unwrap_or_else(|| "UNKNOWN".into()),
            surname: captures
                .name("S")
                .or_else(|| captures.name("G"))
                .map(|m| sanitize_back(m.as_str()))
                .unwrap_or_else(|| "User".into()),
        })
    }
}

/// Mapper responsible for translating addresses between X.400 and SMTP worlds.
#[derive(Clone, Debug, Default)]
pub struct AddressMapper {
    rules: Vec<AddressMappingRule>,
    aliases: HashMap<String, String>,
    alias_reverse: HashMap<String, String>,
}

impl AddressMapper {
    pub fn new(rules: Vec<AddressMappingRule>, aliases: HashMap<String, String>) -> Self {
        let mut alias_reverse = HashMap::new();
        for (or, email) in &aliases {
            alias_reverse.insert(email.to_lowercase(), or.clone());
        }
        Self {
            rules,
            aliases,
            alias_reverse,
        }
    }

    pub fn map_or_to_rfc822(&self, address: &Address) -> Result<String, MappingError> {
        let or_string = format!(
            "C={};O={};S={}",
            address.country, address.organization, address.surname
        );
        if let Some(value) = self.aliases.get(&or_string) {
            return Ok(value.clone());
        }

        for rule in &self.rules {
            if let Some(result) = rule.apply(address) {
                return Ok(result);
            }
        }
        Err(MappingError::NoMatch)
    }

    pub fn map_rfc822_to_or(&self, email: &str) -> Result<Address, MappingError> {
        if let Some(or) = self.alias_reverse.get(&email.to_lowercase()) {
            return self.parse_alias(or).ok_or(MappingError::AliasMissing);
        }

        for rule in &self.rules {
            if let Some(address) = rule.invert(email) {
                return Ok(address);
            }
        }
        Err(MappingError::NoMatch)
    }

    fn parse_alias(&self, value: &str) -> Option<Address> {
        let mut country = "".to_string();
        let mut organization = "".to_string();
        let mut surname = "".to_string();
        for part in value.split(';') {
            let mut key_value = part.splitn(2, '=');
            let key = key_value.next()?.trim();
            let val = key_value.next()?.trim();
            match key.to_ascii_uppercase().as_str() {
                "C" => country = val.to_string(),
                "O" => organization = val.to_string(),
                "S" => surname = val.to_string(),
                _ => {}
            }
        }
        if country.is_empty() || surname.is_empty() {
            return None;
        }
        if organization.is_empty() {
            organization = "UNKNOWN".into();
        }
        Some(Address {
            country,
            organization,
            surname,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_address() -> Address {
        Address {
            country: "DE".into(),
            organization: "Bundespost".into(),
            surname: "Müller".into(),
        }
    }

    #[test]
    fn rule_renders_email() {
        let rule = AddressMappingRule::new("{G}.{S}@{O}.{C}.example");
        let email = rule.apply(&sample_address()).unwrap();
        assert_eq!(email, "muller.muller@bundespost.de.example");
    }

    #[test]
    fn mapper_uses_rules() {
        let mapper = AddressMapper::new(
            vec![AddressMappingRule::new("{S}@example.com")],
            HashMap::new(),
        );
        let email = mapper.map_or_to_rfc822(&sample_address()).unwrap();
        assert_eq!(email, "muller@example.com");
    }

    #[test]
    fn mapper_inverse_rule() {
        let mapper = AddressMapper::new(
            vec![AddressMappingRule::new("{S}@example.com")],
            HashMap::new(),
        );
        let address = mapper.map_rfc822_to_or("muller@example.com").unwrap();
        assert_eq!(address.country, "XX");
        assert_eq!(address.organization, "UNKNOWN");
        assert_eq!(address.surname, "Muller");
    }

    #[test]
    fn mapper_alias_roundtrip() {
        let mut aliases = HashMap::new();
        aliases.insert(
            "C=DE;O=Bundespost;S=Mueller".into(),
            "hans.mueller@example.com".into(),
        );
        let mapper = AddressMapper::new(vec![], aliases);
        let address = mapper.map_rfc822_to_or("hans.mueller@example.com").unwrap();
        assert_eq!(address.country, "DE");
        assert_eq!(address.organization, "Bundespost");
        assert_eq!(address.surname, "Mueller");
    }
}
