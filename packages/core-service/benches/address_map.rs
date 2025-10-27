use criterion::{criterion_group, criterion_main, Criterion};
use core_service::gateway::address_map::{AddressMapper, AddressMappingRule};
use core_service::models::Address;
use std::collections::HashMap;

fn bench_address_mapping(c: &mut Criterion) {
    let mapper = AddressMapper::new(
        vec![AddressMappingRule::new("{S}.{O}@{C}.example")],
        HashMap::new(),
    );
    let address = Address {
        country: "DE".into(),
        organization: "Modernization".into(),
        surname: "Operator".into(),
    };

    c.bench_function("map_or_to_rfc822", |b| {
        b.iter(|| mapper.map_or_to_rfc822(&address).unwrap());
    });
}

criterion_group!(benches, bench_address_mapping);
criterion_main!(benches);
