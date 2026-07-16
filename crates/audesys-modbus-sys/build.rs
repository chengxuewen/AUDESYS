fn main() {
    pkg_config::Config::new()
        .atleast_version("3.1")
        .probe("libmodbus")
        .expect("libmodbus not found — install with: brew install libmodbus");
}
