use audesys_controller_client::ControllerClient;
use audesys_runtime_common::types::Role;
use crate::protocol::*;

pub struct DebugAdapter {
    client: Option<ControllerClient>,
    next_seq: u64,
}

impl DebugAdapter {
    pub fn new() -> Self {
        Self { client: None, next_seq: 1 }
    }

    fn seq(&mut self) -> u64 {
        let s = self.next_seq;
        self.next_seq += 1;
        s
    }

    // ── Request dispatch ──

    pub fn handle(&mut self, req: DapRequest) -> Vec<String> {
        match req.command.as_str() {
            "initialize" => self.handle_initialize(req),
            "launch" | "attach" => self.handle_attach(req),
            "setBreakpoints" => self.handle_set_breakpoints(req),
            "configurationDone" => self.handle_config_done(req),
            "continue" => self.handle_continue(req),
            "next" => self.handle_next(req),
            "stepIn" => self.handle_step_in(req),
            "pause" => self.handle_pause(req),
            "threads" => self.handle_threads(req),
            "stackTrace" => self.handle_stack_trace(req),
            "scopes" => self.handle_scopes(req),
            "variables" => self.handle_variables(req),
            "disconnect" => self.handle_disconnect(req),
            _ => vec![self.err(&req, "unsupported command")],
        }
    }

    // ── Handlers ──

    fn handle_initialize(&mut self, _req: DapRequest) -> Vec<String> {
        let body = serde_json::to_value(InitializeResponse {
            supports_config_done: true,
            supports_cond_bp: false,
            supports_step_targets: false,
            supports_step_back: false,
            supports_goto_targets: false,
        }).unwrap();
        vec![self.ok(&_req, body)]
    }

    fn handle_attach(&mut self, req: DapRequest) -> Vec<String> {
        let args: LaunchArguments = match req.arguments.as_ref()
            .and_then(|a| serde_json::from_value(a.clone()).ok())
        {
            Some(a) => a,
            None => return vec![self.err(&req, "invalid launch arguments")],
        };

        match ControllerClient::connect(&args.socket_path, args.secret.as_bytes()) {
            Ok(mut client) => {
                if let Err(e) = client.authenticate(Role::Engineer) {
                    return vec![self.err(&req, &format!("auth failed: {e}"))];
                }
                // Pause engine on attach, so user controls execution
                let _ = client.pause();
                self.client = Some(client);
                let seq = self.seq();
                let mut out = vec![
                    serde_json::to_string(&DapEvent::initialized(seq)).unwrap(),
                    serde_json::to_string(&DapEvent::stopped(self.seq(), "entry")).unwrap(),
                ];
                out.push(self.ok(&req, serde_json::json!({})));
                out
            }
            Err(e) => vec![self.err(&req, &format!("connect: {e}"))],
        }
    }

    fn handle_set_breakpoints(&mut self, req: DapRequest) -> Vec<String> {
        let client = match self.client.as_mut() {
            Some(c) => c,
            None => return vec![self.err(&req, "not connected")],
        };

        let args: SetBreakpointsArguments = match req.arguments.as_ref()
            .and_then(|a| serde_json::from_value(a.clone()).ok())
        {
            Some(a) => a,
            None => return vec![self.err(&req, "invalid breakpoint arguments")],
        };

        // Clear existing breakpoints then set new ones
        let existing = client.list_breakpoints().unwrap_or_default();
        if existing != "[]" && !existing.is_empty() {
            for ip_str in existing.trim_matches(|c| c == '[' || c == ']').split(',') {
                if let Ok(ip) = ip_str.trim().parse::<u32>() {
                    let _ = client.clear_breakpoint(ip);
                }
            }
        }

        let mut bps = Vec::new();
        for (i, bp_arg) in args.breakpoints.iter().enumerate() {
            let ip = bp_arg.line as u32;
            match client.set_breakpoint(ip) {
                Ok(_) => bps.push(Breakpoint { id: i + 1, verified: true, line: Some(bp_arg.line), message: None }),
                Err(e) => bps.push(Breakpoint { id: i + 1, verified: false, line: Some(bp_arg.line), message: Some(e) }),
            }
        }

        let body = serde_json::to_value(SetBreakpointsResponse { breakpoints: bps }).unwrap();
        vec![self.ok(&req, body)]
    }

    fn handle_config_done(&mut self, req: DapRequest) -> Vec<String> {
        let seq = self.seq();
        vec![
            serde_json::to_string(&DapEvent::continued(seq)).unwrap(),
            self.ok(&req, serde_json::json!({})),
        ]
    }

    fn handle_continue(&mut self, req: DapRequest) -> Vec<String> {
        let client = match self.client.as_mut() {
            Some(c) => c,
            None => return vec![self.err(&req, "not connected")],
        };
        if let Err(e) = client.resume() {
            return vec![self.err(&req, &format!("resume: {e}"))];
        }
        let seq = self.seq();
        vec![
            serde_json::to_string(&DapEvent::continued(seq)).unwrap(),
            self.ok(&req, serde_json::json!({"allThreadsContinued": true})),
        ]
    }

    fn handle_next(&mut self, req: DapRequest) -> Vec<String> {
        let client = match self.client.as_mut() {
            Some(c) => c,
            None => return vec![self.err(&req, "not connected")],
        };
        if let Err(e) = client.step_cycle() {
            return vec![self.err(&req, &format!("step: {e}"))];
        }
        let seq = self.seq();
        vec![
            serde_json::to_string(&DapEvent::stopped(seq, "step")).unwrap(),
            self.ok(&req, serde_json::json!({})),
        ]
    }

    fn handle_step_in(&mut self, req: DapRequest) -> Vec<String> {
        self.handle_next(req)
    }

    fn handle_pause(&mut self, req: DapRequest) -> Vec<String> {
        let client = match self.client.as_mut() {
            Some(c) => c,
            None => return vec![self.err(&req, "not connected")],
        };
        if let Err(e) = client.pause() {
            return vec![self.err(&req, &format!("pause: {e}"))];
        }
        let seq = self.seq();
        vec![
            serde_json::to_string(&DapEvent::stopped(seq, "pause")).unwrap(),
            self.ok(&req, serde_json::json!({})),
        ]
    }

    fn handle_threads(&mut self, req: DapRequest) -> Vec<String> {
        let body = serde_json::to_value(ThreadsResponse {
            threads: vec![Thread { id: 1, name: "main".into() }],
        }).unwrap();
        vec![self.ok(&req, body)]
    }

    fn handle_stack_trace(&mut self, req: DapRequest) -> Vec<String> {
        let client = match self.client.as_mut() {
            Some(c) => c,
            None => return vec![self.err(&req, "not connected")],
        };
        // Get debug state to show current IP
        let state = client.debug_state().unwrap_or_default();
        let debug: serde_json::Value = serde_json::from_str(&state).unwrap_or_default();
        let ip: usize = debug["breakpoints"].as_array()
            .and_then(|a| a.first())
            .and_then(|v| v.as_u64())
            .map(|v| v as usize)
            .unwrap_or(0);

        let frame = StackFrame {
            id: 0,
            name: "ST Program".into(),
            line: ip,
            column: 0,
            source: Some(Source { name: "main.st".into(), path: None }),
            ip_reference: format!("0x{ip:X}"),
        };
        let body = serde_json::to_value(StackTraceResponse { frames: vec![frame], total_frames: 1 }).unwrap();
        vec![self.ok(&req, body)]
    }

    fn handle_scopes(&mut self, req: DapRequest) -> Vec<String> {
        let body = serde_json::to_value(ScopesResponse {
            scopes: vec![Scope { name: "Registers".into(), variables_ref: 1, expensive: false }],
        }).unwrap();
        vec![self.ok(&req, body)]
    }

    fn handle_variables(&mut self, req: DapRequest) -> Vec<String> {
        let client = match self.client.as_mut() {
            Some(c) => c,
            None => return vec![self.err(&req, "not connected")],
        };

        // Read all 14 VM registers
        let reg_names = ["r0","r1","r2","r3","r4","r5","r6","r7","r8","r9","r10","r11","r12","r13"];
        let mut vars = Vec::new();
        for (i, name) in reg_names.iter().enumerate() {
            let val = client.read_register(i as u8).unwrap_or_else(|_| "?".into());
            // parse "rN=VALUE" format
            let val_str = val.splitn(2, '=').nth(1).unwrap_or(&val).to_string();
            vars.push(Variable { name: name.to_string(), value: val_str, variables_ref: 0 });
        }

        let body = serde_json::to_value(VariablesResponse { variables: vars }).unwrap();
        vec![self.ok(&req, body)]
    }

    fn handle_disconnect(&mut self, req: DapRequest) -> Vec<String> {
        if let Some(ref mut client) = self.client {
            let _ = client.resume();
        }
        self.client = None;
        vec![self.ok(&req, serde_json::json!({}))]
    }

    // ── Helpers ──

    fn ok(&mut self, req: &DapRequest, body: serde_json::Value) -> String {
        serde_json::to_string(&DapResponse::ok(self.seq(), req.seq, &req.command, body)).unwrap()
    }

    fn err(&mut self, req: &DapRequest, msg: &str) -> String {
        serde_json::to_string(&DapResponse::err(self.seq(), req.seq, &req.command, msg)).unwrap()
    }
}
