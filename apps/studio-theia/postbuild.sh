#!/bin/bash
# Post-build patches for browser compatibility
set -e

BUNDLE="lib/frontend/bundle.js"
HTML="lib/frontend/index.html"

# Patch 1: WindowMetadata crash fix
if grep -q "electronTheiaCore.WindowMetadata" "$BUNDLE"; then
  sed -i '' 's/window\.electronTheiaCore\.WindowMetadata\.webcontentId/(window.electronTheiaCore?.WindowMetadata?.webcontentId ?? "browser")/g' "$BUNDLE"
  echo "✅ WindowMetadata patched"
fi

# Patch 2: Polyfill
if ! grep -q "electronTheiaCore" "$HTML"; then
  POLYFILL='<script>window.electronTheiaCore={WindowMetadata:{webcontentId:"browser",isPrimary:false},getSecurityToken:()=>({value:""}),onData:()=>({dispose:()=>{}}),sendData:()=>{},getTitleBarStyleAtStartup:()=>Promise.resolve("native"),setBackgroundColor:()=>{},isFullScreenable:()=>false,onAboutToClose:(cb)=>({dispose:()=>{}}),onKeyboardLayoutChanged:(cb)=>({dispose:()=>{}}),onWindowEvent:(cb)=>({dispose:()=>{}}),setOpenUrlHandler:(cb)=>{},setMenuBarVisible:(v)=>{},focusWindow:()=>{},isFullScreen:()=>Promise.resolve(false),minimize:()=>{},maximize:()=>{},close:()=>{},setCloseRequestHandler:(h)=>{},requestReload:()=>{},toggleDevTools:()=>{},setZoomLevel:(z)=>{},readClipboard:()=>"",writeClipboard:(t)=>{},applicationStateChanged:()=>{},useNativeElements:false,getMenu:()=>[],setMenu:()=>{},openDevTools:()=>{},onApplicationStateChanged:(cb)=>({dispose:()=>{}}),sendWindowEvent:(n,d)=>{}};</script>'
  sed -i '' "s|<script type=\"text/javascript\" src=\"./bundle.js\"|${POLYFILL}\n<script type=\"text/javascript\" src=\"./bundle.js\"|" "$HTML"
  echo "✅ Polyfill injected"
fi

echo "Post-build complete"

# Reapply token patches (npm install may reset them)
python3 -c "exec(open(\"token-patch.py\").read())" 2>/dev/null || true
