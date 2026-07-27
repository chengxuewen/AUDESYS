#!/bin/bash
# Post-build patches for browser compatibility
# Run AFTER `theia build`
set -e

BUNDLE="lib/frontend/bundle.js"
HTML="lib/frontend/index.html"

# Patch 1: WindowMetadata crash fix
if grep -q "electronTheiaCore.WindowMetadata" "$BUNDLE"; then
  sed -i '' 's/window\.electronTheiaCore\.WindowMetadata\.webcontentId/(window.electronTheiaCore?.WindowMetadata?.webcontentId ?? "browser")/g' "$BUNDLE"
  echo "✅ WindowMetadata patched"
fi

# Patch 2: Polyfill (handles script tag with any attributes including charset)
if ! grep -q "electronTheiaCore" "$HTML"; then
  POLYFILL='<script>window.electronTheiaCore={WindowMetadata:{webcontentId:"browser",isPrimary:false},getSecurityToken:()=>({value:""}),onData:()=>({dispose:()=>{}}),sendData:()=>{},getTitleBarStyleAtStartup:()=>Promise.resolve("native"),setBackgroundColor:()=>{},setTheme:(t)=>{},isFullScreenable:()=>false,onAboutToClose:(cb)=>({dispose:()=>{}}),onKeyboardLayoutChanged:(cb)=>({dispose:()=>{}}),onWindowEvent:(cb)=>({dispose:()=>{}}),setOpenUrlHandler:(cb)=>{},setMenuBarVisible:(v)=>{},focusWindow:()=>{},isFullScreen:()=>Promise.resolve(false),minimize:()=>{},maximize:()=>{},close:()=>{},setCloseRequestHandler:(h)=>{},requestReload:()=>{},toggleDevTools:()=>{},setZoomLevel:(z)=>{},readClipboard:()=>"",writeClipboard:(t)=>{},applicationStateChanged:()=>{},useNativeElements:false,getMenu:()=>[],setMenu:()=>{},openDevTools:()=>{},onApplicationStateChanged:(cb)=>({dispose:()=>{}}),sendWindowEvent:(n,d)=>{}};</script>'
  # Match <script ... src="./bundle.js" ...> with any attributes
  sed -i '' "s|<script[^>]*src=\"./bundle.js\"[^>]*>|${POLYFILL}\n&|" "$HTML"
  echo "✅ Polyfill injected"
fi

echo "Post-build complete"

# Reapply token patches (theia build may produce unpatched code)
python3 token-patch.py 2>/dev/null || echo "⚠️ token-patch.py failed (non-fatal)"
