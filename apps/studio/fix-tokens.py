"""Apply all browser-compatibility patches using exact string replacement."""
import os

BUNDLE = 'lib/frontend/bundle.js'
HTML = 'lib/frontend/index.html'
MAIN = 'lib/backend/main.js'

# 1) WindowMetadata crash fix
with open(BUNDLE, 'r') as f:
    b = f.read()
if 'electronTheiaCore.WindowMetadata' in b:
    b = b.replace(
        'window.electronTheiaCore.WindowMetadata.webcontentId',
        '(window.electronTheiaCore?.WindowMetadata?.webcontentId ?? "browser")'
    )
    with open(BUNDLE, 'w') as f:
        f.write(b)
    print('1) WindowMetadata patched')

# 2) Polyfill injection
with open(HTML, 'r') as f:
    h = f.read()
if 'electronTheiaCore' not in h:
    poly = '<script>window.electronTheiaCore={WindowMetadata:{webcontentId:"browser",isPrimary:false},getSecurityToken:()=>({value:""}),onData:()=>({dispose:()=>{}}),sendData:()=>{},getTitleBarStyleAtStartup:()=>Promise.resolve("native"),setBackgroundColor:()=>{},setTheme:(t)=>{},isFullScreenable:()=>false,onAboutToClose:(cb)=>({dispose:()=>{}}),onKeyboardLayoutChanged:(cb)=>({dispose:()=>{}}),onWindowEvent:(cb)=>({dispose:()=>{}}),setOpenUrlHandler:(cb)=>{},setMenuBarVisible:(v)=>{},focusWindow:()=>{},isFullScreen:()=>Promise.resolve(false),minimize:()=>{},maximize:()=>{},close:()=>{},setCloseRequestHandler:(h)=>{},requestReload:()=>{},toggleDevTools:()=>{},setZoomLevel:(z)=>{},readClipboard:()=>"",writeClipboard:(t)=>{},applicationStateChanged:()=>{},useNativeElements:false,getMenu:()=>[],setMenu:()=>{},openDevTools:()=>{},onApplicationStateChanged:(cb)=>({dispose:()=>{}}),sendWindowEvent:(n,d)=>{}};</script>'
    import re
    h = re.sub(r'(<script[^>]*src="\./bundle\.js"[^>]*>)', f'{poly}\n\\1', h)
    with open(HTML, 'w') as f:
        f.write(h)
    print('2) Polyfill injected')

# 3) ElectronTokenValidator — allowRequest / allowWsUpgrade
with open(MAIN, 'r') as f:
    m = f.read()
old_ar = '''allowRequest(request) { if (!this._useSocketValidator) { return true; } try { const header = request.headers["x-access-token"]; if (typeof header === "string") { const providedToken = JSON.parse(header); return this._validator.validate(providedToken); } } catch { /* ignore */ } return false; }'''
new_ar = 'allowRequest(request) { return true; }'
if old_ar in m:
    m = m.replace(old_ar, new_ar)
    print('3a) allowRequest patched')
old_awu = 'allowWsUpgrade(request) { return this.allowRequest(request); }'
new_awu = 'allowWsUpgrade(request) { return true; }'
if old_awu in m:
    m = m.replace(old_awu, new_awu)
    print('3b) allowWsUpgrade patched')

# 4) Express middleware
old_em = 'if (this._electronTokenValidator.allowRequest(req))'
new_em = 'if (true)'
if old_em in m:
    m = m.replace(old_em, new_em)
    print('4) Express middleware patched')

# 5) Socket.IO allowRequest
old_sio_ar = '''allowRequest: (req, callback) => {
            const noError = null;
            this.wsRequestValidator.allowWsUpgrade(req).then((allowed) => callback(noError, allowed), (error) => {
              console.error("Error during WebSocket allowRequest validation:", error);
              callback(error?.message ?? "Validation error", false);
            });
          }'''
new_sio_ar = 'allowRequest: (req, callback) => { callback(null, true); }'
n = m.count(old_sio_ar)
if n > 0:
    m = m.replace(old_sio_ar, new_sio_ar)
    print(f'5) Socket.IO allowRequest: {n} instances patched')

# 6) Socket.IO allowConnect
old_sio_ac = '''async allowConnect(request) {
        try {
          return this.wsRequestValidator.allowWsUpgrade(request);
        } catch (e) {
          return false;
        }
      }'''
new_sio_ac = 'async allowConnect(request) { return true; }'
n = m.count(old_sio_ac)
if n > 0:
    m = m.replace(old_sio_ac, new_sio_ac)
    print(f'6) Socket.IO allowConnect: {n} instances patched')

with open(MAIN, 'w') as f:
    f.write(m)
print('Done. Browser connections should now work.')
