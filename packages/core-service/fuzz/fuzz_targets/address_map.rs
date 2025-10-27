#![no_main]

use core_service::gateway::address_map::AddressMappingRule;
use core_service::models::Address;
use libfuzzer_sys::fuzz_target;

fn sanitize(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| (*b as char))
        .filter(|c| c.is_ascii_alphanumeric() || *c == ' ')
        .collect::<String>()
}

fuzz_target!(|data: &[u8]| {
    if data.len() < 6 {
        return;
    }
    let chunk = std::cmp::max(1, data.len() / 3);
    let (country_bytes, rest) = data.split_at(chunk);
    let (org_bytes, surname_bytes) = rest.split_at(std::cmp::max(1, rest.len() / 2));

    let address = Address {
        country: sanitize(country_bytes).chars().take(2).collect::<String>().to_uppercase(),
        organization: sanitize(org_bytes),
        surname: sanitize(surname_bytes),
    };

    let rule = AddressMappingRule::new("{S}.{O}@gateway.{C}.example");
    if let Some(email) = rule.apply(&address) {
        let _ = rule.invert(&email);
    }
});
