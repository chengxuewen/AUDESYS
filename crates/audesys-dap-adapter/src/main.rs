use std::io::{self, BufRead, BufReader, Read, Write};

mod adapter;
mod protocol;
use adapter::DebugAdapter;
use protocol::DapRequest;

fn main() {
    eprintln!("AUDESYS DAP Adapter started");
    let mut adapter = DebugAdapter::new();
    let stdin = io::stdin();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();

    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Err(_) => break,
            _ => {}
        }

        if line.trim().is_empty() {
            continue;
        }

        let content_length = match parse_content_length(&line) {
            Some(len) => len,
            None => continue,
        };

        // Read blank separator line
        line.clear();
        if reader.read_line(&mut line).is_err() {
            break;
        }

        // Read JSON body
        let mut body = vec![0u8; content_length];
        if reader.read_exact(&mut body).is_err() {
            break;
        }

        let body_str = String::from_utf8_lossy(&body);
        let req: DapRequest = match serde_json::from_str(&body_str) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("DAP parse error: {e}");
                continue;
            }
        };

        let responses = adapter.handle(req);
        for resp in responses {
            send_packet(&resp);
        }
    }

    eprintln!("AUDESYS DAP Adapter exiting");
}

fn parse_content_length(line: &str) -> Option<usize> {
    let prefix = "Content-Length: ";
    if line.starts_with(prefix) { line[prefix.len()..].trim().parse().ok() } else { None }
}

fn send_packet(data: &str) {
    let header = format!("Content-Length: {}\r\n\r\n", data.len());
    print!("{}{}", header, data);
    let _ = io::stdout().flush();
}
