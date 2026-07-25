//! Structured JSON-line logger for the AUDESYS controller.
//!
//! Replaces `format!("{:?}")` / `eprintln!` debug output with
//! JSON-formatted log lines. Each line is a machine-parseable JSON object.
//!
//! # Example output
//!
//! ```json
//! {"ts":"2026-07-18T10:30:00.123Z","level":"INFO","module":"engine","msg":"engine started","cycle_ms":10}
//! {"ts":"2026-07-18T10:30:01.456Z","level":"ERROR","module":"ipc","msg":"auth failed","reason":"invalid token"}
//! ```
//!
//! # Configuration
//!
//! Set `AUDESYS_LOG_LEVEL` environment variable: `error`, `warn`, `info`, `debug`.
//! Default: `info`.

use std::io::{self, Write};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

// ── Log Levels ──

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum LogLevel {
    Error = 0,
    Warn = 1,
    Info = 2,
    Debug = 3,
}

impl LogLevel {
    fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "error" => LogLevel::Error,
            "warn" | "warning" => LogLevel::Warn,
            "info" => LogLevel::Info,
            "debug" | "trace" => LogLevel::Debug,
            _ => LogLevel::Info,
        }
    }
}

// ── Global Logger ──

static LOG_LEVEL: AtomicU8 = AtomicU8::new(LogLevel::Info as u8);
static LOGGER: LazyLock<Mutex<Box<dyn Write + Send>>> =
    LazyLock::new(|| Mutex::new(Box::new(io::stderr())));

// ── Public API ──

/// Initialize the logger. Reads AUDESYS_LOG_LEVEL from env.
pub fn init() {
    let level = std::env::var("AUDESYS_LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
    set_level(LogLevel::from_str(&level));
}

/// Set the global log level.
pub fn set_level(level: LogLevel) {
    LOG_LEVEL.store(level as u8, Ordering::Relaxed);
}

/// Log a message at the given level if the level is enabled.
pub fn log(level: LogLevel, module: &str, msg: &str, fields: &[(&str, &dyn std::fmt::Display)]) {
    if level as u8 > LOG_LEVEL.load(Ordering::Relaxed) {
        return;
    }
    emit(level, module, msg, fields);
}

// ── Convenience macros ──

/// Log at Error level.
#[macro_export]
macro_rules! log_error {
    ($module:expr, $msg:expr $(, $key:expr => $val:expr)* $(,)?) => {
        $crate::logging::log(
            $crate::logging::LogLevel::Error,
            $module,
            $msg,
            &[$(( $key, &$val )),*]
        )
    };
}

/// Log at Warn level.
#[macro_export]
macro_rules! log_warn {
    ($module:expr, $msg:expr $(, $key:expr => $val:expr)* $(,)?) => {
        $crate::logging::log(
            $crate::logging::LogLevel::Warn,
            $module,
            $msg,
            &[$(( $key, &$val )),*]
        )
    };
}

/// Log at Info level.
#[macro_export]
macro_rules! log_info {
    ($module:expr, $msg:expr $(, $key:expr => $val:expr)* $(,)?) => {
        $crate::logging::log(
            $crate::logging::LogLevel::Info,
            $module,
            $msg,
            &[$(( $key, &$val )),*]
        )
    };
}

/// Log at Debug level.
#[macro_export]
macro_rules! log_debug {
    ($module:expr, $msg:expr $(, $key:expr => $val:expr)* $(,)?) => {
        $crate::logging::log(
            $crate::logging::LogLevel::Debug,
            $module,
            $msg,
            &[$(( $key, &$val )),*]
        )
    };
}

// ── Internals ──

/// Emit a JSON log line to stderr.
fn emit(level: LogLevel, module: &str, msg: &str, fields: &[(&str, &dyn std::fmt::Display)]) {
    let ts = timestamp();
    let level_str = match level {
        LogLevel::Error => "ERROR",
        LogLevel::Warn => "WARN",
        LogLevel::Info => "INFO",
        LogLevel::Debug => "DEBUG",
    };

    let mut output = format!(
        "{{\"ts\":\"{}\",\"level\":\"{}\",\"module\":\"{}\",\"msg\":\"{}\"",
        ts,
        level_str,
        escape(module),
        escape(msg)
    );

    for (key, val) in fields {
        output.push_str(&format!(",\"{}\":\"{}\"", escape(key), escape(&val.to_string())));
    }

    output.push_str("}\n");

    if let Ok(mut writer) = LOGGER.lock() {
        let _ = writer.write_all(output.as_bytes());
        let _ = writer.flush();
    }
}

fn timestamp() -> String {
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs();
    let millis = dur.subsec_millis();
    format!("{secs}.{millis:03}")
}

fn escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n").replace('\t', "\\t")
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_level_ordering() {
        assert!(LogLevel::Error < LogLevel::Warn);
        assert!(LogLevel::Warn < LogLevel::Info);
        assert!(LogLevel::Info < LogLevel::Debug);
    }

    #[test]
    fn test_log_level_from_str() {
        assert_eq!(LogLevel::from_str("error"), LogLevel::Error);
        assert_eq!(LogLevel::from_str("warn"), LogLevel::Warn);
        assert_eq!(LogLevel::from_str("info"), LogLevel::Info);
        assert_eq!(LogLevel::from_str("debug"), LogLevel::Debug);
        assert_eq!(LogLevel::from_str("unknown"), LogLevel::Info); // default
    }

    #[test]
    fn test_level_filtering() {
        set_level(LogLevel::Warn);
        assert!(!is_enabled(LogLevel::Info));
        assert!(is_enabled(LogLevel::Error));
        set_level(LogLevel::Info); // restore
    }

    #[test]
    fn test_timestamp_format() {
        let ts = timestamp();
        assert!(ts.contains('.'));
        let parts: Vec<&str> = ts.split('.').collect();
        assert_eq!(parts.len(), 2);
        // seconds should be a reasonable Unix timestamp
        let secs: u64 = parts[0].parse().unwrap();
        assert!(secs > 1_500_000_000); // after 2017
    }

    #[test]
    fn test_escape_special_chars() {
        assert_eq!(escape("hello"), "hello");
        assert_eq!(escape("say \"hi\""), "say \\\"hi\\\"");
        assert_eq!(escape("a\nb"), "a\\nb");
    }

    fn is_enabled(level: LogLevel) -> bool {
        level as u8 <= LOG_LEVEL.load(Ordering::Relaxed)
    }
}
