use core_service::config::AppConfig;

#[test]
fn loads_default_configuration() {
    let config = AppConfig::load().expect("configuration loads");
    assert_eq!(config.server.port, 3333);
}
