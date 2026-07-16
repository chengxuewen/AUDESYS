//! HAL primitive types and configuration structs.
//! 来源: docs/modules/hal/iec-type-system-design.md, docs/modules/hal/hal-protocol-design.md

/// Typed timestamp with microsecond resolution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Timestamp {
    pub secs: u64,
    pub micros: u32,
}

// ── Pin direction ──

/// I/O direction for HAL pins.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum HalPinDirection {
    In,
    Out,
    IO,
}

// ── Pin type discriminator ──

/// The concrete Rust type underlying a HAL value — used for Array<T> element_type, etc.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum HalPinType {
    Bool,
    S8,
    U8,
    S16,
    U16,
    S32,
    U32,
    S64,
    U64,
    F32,
    F64,
    Blob,
    String,
}

// ── Metadata ──

/// Arbitrary key-value metadata attached to components, Signals, etc.
#[derive(Debug, Clone, Default)]
pub struct Metadata {
    pub entries: Vec<(String, String)>,
}

// ── StreamConfig ──

/// Streaming channel configuration.
#[derive(Debug, Clone)]
pub struct StreamConfig {
    pub queue_depth: u32,
    pub queue_policy: QueuePolicy,
    pub error_policy: ConsumerErrorPolicy,
    pub circuit_breaker: Option<CircuitBreakerConfig>,
    pub shm_threshold_bytes: u32,
}

/// Queue overflow policy for StreamChannel (S-CH-004).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueuePolicy {
    DropOldest,
    Backpressure,
    DropNewest,
}

/// Error handling policy when a StreamChannel consumer fails (S-CH-005).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConsumerErrorPolicy {
    Block,
    Drop,
    Notify,
}

/// Optional circuit breaker configuration (S-CH-006).
#[derive(Debug, Clone, Copy)]
pub struct CircuitBreakerConfig {
    pub max_consecutive_failures: u32,
    pub cooldown_ms: u64,
    pub on_open: CircuitBreakerAction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitBreakerAction {
    Notify,
    Panic,
    Ignore,
}

// ── Subscription ──

/// Subscription handle returned by transport::subscribe_signal / StreamReader::subscribe.
#[derive(Debug)]
pub struct Subscription {
    // ponytail: opaque token — real impl hooks into transport's callback registry
}

// ── Error types ──

/// Unified HAL error type.
#[derive(Debug)]
pub enum HalError {
    NotFound {
        signal: String,
    },
    AlreadyExists {
        signal: String,
    },
    TransportClosed,
    Timeout {
        method: String,
        timeout_ms: u64,
    },
    Rejected {
        code: u16,
        reason: String,
    },
    Execution {
        method: String,
        reason: String,
    },
    TypeMismatch {
        expected: HalPinType,
        actual: HalPinType,
    },
    InvalidUtf8,
    InvalidBlobLength {
        declared: u32,
        actual: u32,
    },
    UnknownHalType {
        type_id: u8,
    },
    MaxNestingExceeded {
        depth: u32,
    },
    /// ponytail: catch-all for errors from downstream transports
    Internal(String),
}

impl std::fmt::Display for HalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HalError::NotFound { signal } => write!(f, "Signal not found: {}", signal),
            HalError::AlreadyExists { signal } => write!(f, "Signal already exists: {}", signal),
            HalError::TransportClosed => write!(f, "Transport closed"),
            HalError::Timeout { method, timeout_ms } => {
                write!(f, "RPC timeout: {} ({}ms)", method, timeout_ms)
            }
            HalError::Rejected { code, reason } => {
                write!(f, "RPC rejected: {} — {}", code, reason)
            }
            HalError::Execution { method, reason } => {
                write!(f, "RPC execution error: {} — {}", method, reason)
            }
            HalError::TypeMismatch { expected, actual } => {
                write!(f, "Type mismatch: expected {:?}, got {:?}", expected, actual)
            }
            HalError::InvalidUtf8 => write!(f, "Invalid UTF-8 string"),
            HalError::InvalidBlobLength { declared, actual } => {
                write!(f, "Invalid blob length: declared {}, actual {}", declared, actual)
            }
            HalError::UnknownHalType { type_id } => {
                write!(f, "Unknown HAL type ID: {}", type_id)
            }
            HalError::MaxNestingExceeded { depth } => {
                write!(f, "Max array nesting exceeded: {}", depth)
            }
            HalError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for HalError {}

/// Result alias used throughout HAL.
pub type HalResult<T> = std::result::Result<T, HalError>;
