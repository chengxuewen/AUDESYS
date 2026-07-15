# Cheatsheet — FUXA Quick Reference for AUDESYS Design

## Deployment

```bash
# Docker one-liner
docker run -d -p 1881:1881 frangoteam/fuxa:latest

# With persistent storage
docker run -d -p 1881:1881 \
  -v fuxa_data:/usr/src/app/FUXA/server/_appdata \
  -v fuxa_db:/usr/src/app/FUXA/server/_db \
  frangoteam/fuxa:latest

# npm install
npm install @frangoteam/fuxa
cd node_modules/@frangoteam/fuxa && npm start
```

## Architecture in 30 seconds

- **Frontend**: Angular SPA + SVG Editor + WebSocket real-time
- **Backend**: Node.js 18+ Express + SQLite (config) + InfluxDB (optional, history)
- **Protocol adapters**: 8 protocols via plugin interface (connect/disconnect/read/write)
- **Default port**: 1881
- **Project files**: JSON in `_appdata/` directory

## SVG Editor Components

- **Basic**: rect, circle, ellipse, line, polyline, polygon, path, text
- **Gauges**: circular gauge, bar gauge, tank level, linear gauge
- **Controls**: button, toggle switch, slider, input
- **Charts**: real-time trend, history trend, pie, bar
- **Containers**: panel, iframe, pipe
- **Binding**: any component property → Tag value (color, size, text, visibility)

## Protocol Support

| Protocol | npm Package | Mode |
|----------|------------|------|
| Modbus | node-modbus | RTU/TCP polling |
| OPC UA | node-opcua | Subscription |
| MQTT | mqtt.js | Pub/sub |
| S7 | node-snap7/nodes7 | TCP direct |
| BACnet | node-bacnet | UDP |
| EtherNet/IP | custom | TCP/UDP |
| WebAPI | axios/fetch | HTTP REST |

## REST API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/tags | List all tags |
| GET | /api/tags/{id}/value | Read tag value |
| POST | /api/tags/{id}/value | Write tag value |
| GET | /api/alarms | List current alarms |
| POST | /api/alarms/{id}/ack | Acknowledge alarm |
| GET | /api/history | Query historical data |
| GET | /api/projects | List projects |

## Key Lessons for AUDESYS

| FUXA Decision | AUDESYS Takeaway |
|--------------|-----------------|
| Node.js + GC → no hard real-time | Rust core with SCHED_FIFO |
| Single-process → no scaling | Rust multi-thread + amw plugins |
| SVG < 200 components/page | Canvas/WebGL for high-density |
| Basic security (JWT only) | Enterprise RBAC + LDAP/OAuth |
| JSON project files → Git-friendly | YAML + FlatBuffers (D24) |
| $45 Raspberry Pi SCADA | Rust binary even lighter |
| WebSocket push real-time | HAL StreamChannel Web bridge |
| Plugin protocol adapters | HAL Driver trait plugins |

## Common Gotchas

1. **Node.js 14→18 migration**: Some S7 libraries break on version upgrades — Rust avoids this
2. **SQLite bottleneck at >1000 tags**: Use InfluxDB/TDengine for production-scale
3. **Single-process ceiling**: FUXA cannot horizontally scale — AUDESYS must be multi-process from start
4. **SVG editor complexity**: Snap/rotate/path editing is harder than it looks — consider Fabric.js/Konva.js
5. **No mobile app**: FUXA is browser-only — AUDESYS PWA (Phase 2) fills this gap
