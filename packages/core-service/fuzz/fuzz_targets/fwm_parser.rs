#![no_main]

use core_service::parsers::parse_fwm;
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if let Ok(input) = std::str::from_utf8(data) {
        let _ = parse_fwm(input);
    }
});
