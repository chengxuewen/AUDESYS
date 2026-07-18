use std::sync::Arc;
use audesys_amw_inproc::{InprocAuditLog, InprocMiddleware, InprocQoS, InprocTransport, StaticDiscovery};

pub fn build_inproc_stack() -> (Arc<InprocTransport>, InprocMiddleware) {
    let transport = Arc::new(InprocTransport::new());
    let signal_reg = transport.signal_registry();
    let discovery = Arc::new(StaticDiscovery::new(signal_reg));
    let qos = Arc::new(InprocQoS::new());
    let audit = Arc::new(InprocAuditLog::new());
    let mw = InprocMiddleware::new(Arc::clone(&transport), discovery, qos, audit);
    (transport, mw)
}
