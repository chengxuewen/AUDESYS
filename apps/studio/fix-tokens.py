"""Apply all browser-compatibility patches using exact string replacement.

This script patches the Theia build output to allow browser connections
(used for development/testing). Key changes:
- Remove WebSocket/Socket.IO token validation
- Inject polyfill for Electron APIs in browser mode
- Add HTML menu bar for browser mode

Patch status as of 2026-07-30:
- ElectronTokenValidator class does NOT exist in minified bundle
  (Theia refactored token validation into DI-based WsRequestValidator)
- Socket.IO allowRequest already returns true (built into onStart)
- The actual blocker is allowConnect calling wsRequestValidator
"""
import os

BUNDLE = 'lib/frontend/bundle.js'
HTML = 'lib/frontend/index.html'
MAIN = 'lib/backend/main.js'


# ---------------------------------------------------------------------------
# 1) WindowMetadata crash fix (for bundle.js)
#    Theia 1.73+ bundle may reference window.electronTheiaCore.WindowMetadata
#    which is undefined in browser mode. Apply optional chaining.
# ---------------------------------------------------------------------------
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
else:
    print('1) WindowMetadata: not found (already patched or not present)')


# ---------------------------------------------------------------------------
# 2) Polyfill injection (for index.html)
#    Inject a polyfill for window.electronTheiaCore so browser mode
#    doesn't crash on missing Electron APIs.
# ---------------------------------------------------------------------------
with open(HTML, 'r') as f:
    h = f.read()
if 'electronTheiaCore' not in h:
    poly = ('<script>window.electronTheiaCore={'
            'WindowMetadata:{webcontentId:"browser",isPrimary:false},'
            'getSecurityToken:()=>({value:""}),'
            'onData:()=>({dispose:()=>{}}),sendData:()=>{},'
            'getTitleBarStyleAtStartup:()=>Promise.resolve("native"),'
            'setBackgroundColor:()=>{},setTheme:(t)=>{},'
            'isFullScreenable:()=>false,'
            'onAboutToClose:(cb)=>({dispose:()=>{}}),'
            'onKeyboardLayoutChanged:(cb)=>({dispose:()=>{}}),'
            'onWindowEvent:(cb)=>({dispose:()=>{}}),'
            'setOpenUrlHandler:(cb)=>{},setMenuBarVisible:(v)=>{},'
            'focusWindow:()=>{},isFullScreen:()=>Promise.resolve(false),'
            'minimize:()=>{},maximize:()=>{},close:()=>{},'
            'setCloseRequestHandler:(h)=>{},requestReload:()=>{},'
            'toggleDevTools:()=>{},setZoomLevel:(z)=>{},'
            'readClipboard:()=>"",writeClipboard:(t)=>{},'
            'applicationStateChanged:()=>{},useNativeElements:false,'
            'getMenu:()=>[],setMenu:()=>{},openDevTools:()=>{},'
            'onApplicationStateChanged:(cb)=>({dispose:()=>{}}),'
            'sendWindowEvent:(n,d)=>{}};</script>')
    import re
    h = re.sub(r'(<script[^>]*src="\./bundle\.js"[^>]*>)', f'{poly}\n\\1', h)
    with open(HTML, 'w') as f:
        f.write(h)
    print('2) Polyfill injected')
else:
    print('2) Polyfill: already injected')


# ---------------------------------------------------------------------------
# 3) Socket.IO allowConnect — bypass wsRequestValidator
#    The actual minified pattern in the bundle is:
#      async allowConnect(e){try{return
#        this.wsRequestValidator.allowWsUpgrade(e)}catch{return!1}}
#    Replace with: always return true.
# ---------------------------------------------------------------------------
with open(MAIN, 'r') as f:
    m = f.read()

OLD_ALLOW_CONNECT = (
    'async allowConnect(e){try{return '
    'this.wsRequestValidator.allowWsUpgrade(e)}catch{return!1}}'
)
NEW_ALLOW_CONNECT = 'async allowConnect(e){return true}'

n = m.count(OLD_ALLOW_CONNECT)
if n > 0:
    m = m.replace(OLD_ALLOW_CONNECT, NEW_ALLOW_CONNECT)
    print(f'3) Socket.IO allowConnect: {n} instances patched')
else:
    print('3) Socket.IO allowConnect: pattern not found')

# ---------------------------------------------------------------------------
# 4) WsRequestValidator.allowWsUpgrade — bypass all contributions
#    The actual minified pattern is:
#      async allowWsUpgrade(e){return new Promise(async n=>{await
#        Promise.all(Array.from(this.requestValidators.getContributions(),
#        async i=>{await i.allowWsUpgrade(e)||n(!1)})),n(!0)})}
#    Replace with: always return true (belt-and-suspenders with patch 3).
# ---------------------------------------------------------------------------
OLD_WS_VALIDATOR = (
    'async allowWsUpgrade(e){return new Promise(async n=>{await '
    'Promise.all(Array.from(this.requestValidators.getContributions(),'
    'async i=>{await i.allowWsUpgrade(e)||n(!1)})),n(!0)})}'
)
NEW_WS_VALIDATOR = 'async allowWsUpgrade(e){return true}'

n = m.count(OLD_WS_VALIDATOR)
if n > 0:
    m = m.replace(OLD_WS_VALIDATOR, NEW_WS_VALIDATOR)
    print(f'4) WsRequestValidator: {n} instances patched')
else:
    print('4) WsRequestValidator: pattern not found')


# ---------------------------------------------------------------------------
# 5) F12 DevTools shortcut for Electron mode
#    The electron-main.js is at src-gen/backend/electron-main.js
#    (not lib/backend/electron-main.js). It uses async function start()
#    pattern, not app.whenReady().
# ---------------------------------------------------------------------------
EM = 'src-gen/backend/electron-main.js'
if os.path.exists(EM):
    with open(EM, 'r') as f:
        em = f.read()
    if 'DevTools shortcuts registered' in em:
        print('5) F12 DevTools: already patched')
    elif 'async function start()' in em:
        # Insert DevTools shortcut registration after the async function start
        old_start = 'async function start() {'
        new_start = (
            'async function start() {\n'
            '    const { globalShortcut, BrowserWindow } = require(\'electron\');\n'
            '    globalShortcut.register(\'F12\', () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools());\n'
            '    globalShortcut.register(\'CommandOrControl+Option+I\', () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools());\n'
            '    console.log(\'DevTools shortcuts registered: F12, Cmd+Option+I\');\n'
        )
        if old_start in em:
            em = em.replace(old_start, new_start)
            with open(EM, 'w') as f:
                f.write(em)
            print('5) F12 DevTools: patched')
        else:
            print('5) F12 DevTools: pattern not found')
    else:
        print('5) F12 DevTools: unknown pattern, skipping')
else:
    print(f'5) F12 DevTools: electron-main.js not found at {EM}')


# ---------------------------------------------------------------------------
# 6) HTML menu bar with dropdowns (for browser mode)
#    When Theia targets browser mode, the menu bar needs to be rendered
#    as HTML instead of native OS menus.
# ---------------------------------------------------------------------------
with open(HTML, 'r') as f:
    h = f.read()
if 'ponytail-menubar' not in h:
    script = (
        '<script>'
        'window.addEventListener("DOMContentLoaded",()=>{'
        'setTimeout(()=>{'
        'const t=document.getElementById("theia-top-panel");'
        'if(t&&t.children.length===0){'
        'const m=["File","Edit","Selection","View","Go","Run","Terminal","Help"];'
        'const b=document.createElement("div");'
        'b.className="lm-Widget lm-MenuBar ponytail-menubar";'
        'b.style.cssText="display:flex;align-items:center;height:100%;padding:0 8px;'
        'background:var(--theia-titleBar-activeBackground,#252526);";'
        'm.forEach(n=>{'
        'const i=document.createElement("div");'
        'i.className="lm-MenuBar-item";'
        'i.style.cssText="padding:4px 8px;cursor:pointer;font-size:13px;'
        'color:var(--theia-menu-foreground,#ccc);";'
        'i.textContent=n;b.appendChild(i)});t.appendChild(b);'
        'console.log("Menu bar injected (ponytail)")}},3000)});'
        '</script>'
    )
    h = h.replace('</head>', script + '\n</head>')
    with open(HTML, 'w') as f:
        f.write(h)
    print('6) HTML menu bar: injected')
else:
    print('6) HTML menu bar: already injected')


# ---------------------------------------------------------------------------
# Write modified main.js
# ---------------------------------------------------------------------------
with open(MAIN, 'w') as f:
    f.write(m)
print('Done. Browser connections should now work.')