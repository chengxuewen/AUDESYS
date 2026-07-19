use serde::{Deserialize, Serialize};

// ── DAP JSON-RPC base types ──

#[derive(Debug, Deserialize)]
pub struct DapRequest {
    pub seq: u64,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub arguments: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct DapResponse {
    pub seq: u64,
    #[serde(rename = "type")]
    pub msg_type: &'static str,
    pub request_seq: u64,
    pub success: bool,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DapEvent {
    pub seq: u64,
    #[serde(rename = "type")]
    pub msg_type: &'static str,
    pub event: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<serde_json::Value>,
}

impl DapResponse {
    pub fn ok(seq: u64, request_seq: u64, command: &str, body: serde_json::Value) -> Self {
        Self {
            seq,
            msg_type: "response",
            request_seq,
            success: true,
            command: command.to_string(),
            body: Some(body),
            message: None,
        }
    }

    #[allow(dead_code)]
    pub fn ok_empty(seq: u64, request_seq: u64, command: &str) -> Self {
        Self {
            seq,
            msg_type: "response",
            request_seq,
            success: true,
            command: command.to_string(),
            body: None,
            message: None,
        }
    }

    pub fn err(seq: u64, request_seq: u64, command: &str, msg: &str) -> Self {
        Self {
            seq,
            msg_type: "response",
            request_seq,
            success: false,
            command: command.to_string(),
            body: None,
            message: Some(msg.to_string()),
        }
    }
}

impl DapEvent {
    pub fn stopped(seq: u64, reason: &str) -> Self {
        let body = serde_json::json!({ "reason": reason, "threadId": 1 });
        Self { seq, msg_type: "event", event: "stopped".into(), body: Some(body) }
    }

    pub fn continued(seq: u64) -> Self {
        Self {
            seq,
            msg_type: "event",
            event: "continued".into(),
            body: Some(serde_json::json!({"threadId": 1})),
        }
    }

    pub fn initialized(seq: u64) -> Self {
        Self { seq, msg_type: "event", event: "initialized".into(), body: None }
    }

    #[allow(dead_code)]
    pub fn output(seq: u64, text: &str) -> Self {
        let body = serde_json::json!({"output": text, "category": "console"});
        Self { seq, msg_type: "event", event: "output".into(), body: Some(body) }
    }
}

// ── Specific DAP response types ──

#[derive(Debug, Serialize)]
pub struct InitializeResponse {
    #[serde(rename = "supportsConfigurationDoneRequest")]
    pub supports_config_done: bool,
    #[serde(rename = "supportsConditionalBreakpoints")]
    pub supports_cond_bp: bool,
    #[serde(rename = "supportsStepInTargetsRequest")]
    pub supports_step_targets: bool,
    #[serde(rename = "supportsStepBack")]
    pub supports_step_back: bool,
    #[serde(rename = "supportsGotoTargetsRequest")]
    pub supports_goto_targets: bool,
}

#[derive(Debug, Serialize)]
pub struct Thread {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct ThreadsResponse {
    pub threads: Vec<Thread>,
}

#[derive(Debug, Serialize)]
pub struct StackFrame {
    pub id: u64,
    pub name: String,
    pub line: usize,
    pub column: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Source>,
    #[serde(rename = "instructionPointerReference")]
    pub ip_reference: String,
}

#[derive(Debug, Serialize)]
pub struct Source {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StackTraceResponse {
    #[serde(rename = "stackFrames")]
    pub frames: Vec<StackFrame>,
    #[serde(rename = "totalFrames")]
    pub total_frames: usize,
}

#[derive(Debug, Serialize)]
pub struct Scope {
    pub name: String,
    #[serde(rename = "variablesReference")]
    pub variables_ref: u64,
    pub expensive: bool,
}

#[derive(Debug, Serialize)]
pub struct ScopesResponse {
    pub scopes: Vec<Scope>,
}

#[derive(Debug, Serialize)]
pub struct Variable {
    pub name: String,
    pub value: String,
    #[serde(rename = "variablesReference")]
    pub variables_ref: u64,
}

#[derive(Debug, Serialize)]
pub struct VariablesResponse {
    pub variables: Vec<Variable>,
}

#[derive(Debug, Serialize)]
pub struct Breakpoint {
    pub id: usize,
    pub verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SetBreakpointsResponse {
    pub breakpoints: Vec<Breakpoint>,
}

// ── Specific DAP argument types ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchArguments {
    #[serde(default = "default_socket_path")]
    pub socket_path: String,
    #[serde(default = "default_secret")]
    pub secret: String,
}

fn default_socket_path() -> String {
    "/tmp/audesys-controller.sock".into()
}
fn default_secret() -> String {
    "audesys-dev-secret".into()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetBreakpointsArguments {
    #[allow(dead_code)]
    pub source: SourceArg,
    #[serde(default)]
    pub breakpoints: Vec<BreakpointArg>,
}

#[derive(Debug, Deserialize)]
pub struct SourceArg {
    #[allow(dead_code)]
    pub name: String,
    #[allow(dead_code)]
    pub path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BreakpointArg {
    pub line: usize,
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initialize_response_serialization() {
        let r = InitializeResponse {
            supports_config_done: true,
            supports_cond_bp: false,
            supports_step_targets: false,
            supports_step_back: false,
            supports_goto_targets: false,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("supportsConfigurationDoneRequest"));
        assert!(json.contains("true"));
    }

    #[test]
    fn test_stopped_event() {
        let ev = DapEvent::stopped(1, "breakpoint");
        let json = serde_json::to_value(&ev).unwrap();
        assert_eq!(json["event"], "stopped");
        assert_eq!(json["type"], "event");
    }

    #[test]
    fn test_response_error() {
        let resp = DapResponse::err(2, 1, "unknown", "not implemented");
        assert!(!resp.success);
        assert_eq!(resp.message, Some("not implemented".into()));
    }

    #[test]
    fn test_deserialize_launch_args() {
        let json = r#"{"socketPath":"/tmp/test.sock","secret":"test123"}"#;
        let args: LaunchArguments = serde_json::from_str(json).unwrap();
        assert_eq!(args.socket_path, "/tmp/test.sock");
        assert_eq!(args.secret, "test123");
    }

    #[test]
    fn test_deserialize_launch_args_defaults() {
        let json = r#"{}"#;
        let args: LaunchArguments = serde_json::from_str(json).unwrap();
        assert_eq!(args.socket_path, "/tmp/audesys-controller.sock");
    }
}
