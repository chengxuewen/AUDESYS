#!/usr/bin/env python3
"""Token validation patches for browser (non-Electron) compatibility.

Patches Theia's 3-layer token validation for browser access:
  Layer 1: Express middleware (ElectronTokenBackendContribution.expressMiddleware)
  Layer 2: Socket.IO allowRequest callback (all WebsocketEndpoint copies)
  Layer 3: Socket.IO allowConnect defense-in-depth (all copies)
  Layer 4: ElectronTokenValidator.allowRequest/allowWsUpgrade (root validators)

Usage: python3 token-patch.py
Run AFTER `theia build` generates lib/backend/main.js.
"""

import re
import sys

def patch_file(path, patches, label):
    """Apply regex patches. Each patch is (pattern, replacement, description)."""
    with open(path, 'r') as f:
        content = f.read()
    
    original_len = len(content)
    for pattern, replacement, desc in patches:
        content, n = re.subn(pattern, replacement, content, flags=re.DOTALL)
        if n > 0:
            print(f'  [{label}] Patched {n} instance(s): {desc}')
        else:
            print(f'  [{label}] Already patched or not found: {desc}')
    
    if len(content) != original_len:
        with open(path, 'w') as f:
            f.write(content)
        print(f'  [{label}] File updated ({len(content) - original_len:+d} bytes)')
    else:
        print(f'  [{label}] No changes needed')
    
    return len(content) != original_len

def main():
    main_js = 'lib/backend/main.js'
    
    patches = [
        # Layer 4: ElectronTokenValidator.allowRequest — match full multi-line method
        # Pattern: allowRequest(request){if(!this.X){return true}...return false}
        (
            r'allowRequest\(request\)\s*\{\s*if\s*\(\s*!\s*this\s*\.\s*\w+\s*\)\s*\{\s*return\s+true\s*;\s*\}[\s\S]*?return\s+false\s*;\s*\}',
            'allowRequest(request) { return true; }',
            'ElectronTokenValidator.allowRequest → always true'
        ),
        # Layer 4: ElectronTokenValidator.allowWsUpgrade
        (
            r'allowWsUpgrade\(request\)\s*\{\s*return\s+this\s*\.\s*allowRequest\(request\)\s*;\s*\}',
            'allowWsUpgrade(request) { return true; }',
            'ElectronTokenValidator.allowWsUpgrade → always true'
        ),
        # Layer 1: Express middleware
        (
            r'if\s*\(\s*this\s*\.\s*\w+\s*\.\s*allowRequest\(req\)\s*\)',
            'if (true)',
            'Express middleware bypass'
        ),
        # Layer 2: Socket.IO allowRequest that calls wsRequestValidator (multi-line)
        (
            r'allowRequest\s*:\s*\(req\s*,\s*callback\)\s*=>\s*\{[\s\S]*?wsRequestValidator[\s\S]*?\}',
            'allowRequest: (req, callback) => { callback(null, true); }',
            'Socket.IO allowRequest bypass'
        ),
        # Layer 3: Socket.IO allowConnect that calls wsRequestValidator (multi-line)
        (
            r'async\s+allowConnect\(request\)\s*\{[\s\S]*?wsRequestValidator[\s\S]*?\}',
            'async allowConnect(request) { return true; }',
            'Socket.IO allowConnect bypass'
        ),
    ]
    
    patch_file(main_js, patches, 'main.js')
    
    # Also check electron-main.js (may contain separate token code)
    em_js = 'lib/backend/electron-main.js'
    em_patches = [
        (
            r'allowRequest\(request\)\s*\{[\s\S]*?return\s+false\s*;\s*\}',
            'allowRequest(request) { return true; }',
            'electron-main.js allowRequest'
        ),
        (
            r'allowWsUpgrade\(request\)\s*\{[\s\S]*?\}',
            'allowWsUpgrade(request) { return true; }',
            'electron-main.js allowWsUpgrade'
        ),
        (
            r'if\s*\(\s*this\s*\.\s*\w+\s*\.\s*allowRequest\(req\)\s*\)',
            'if (true)',
            'electron-main.js Express middleware bypass'
        ),
    ]
    patch_file(em_js, em_patches, 'electron-main.js')
    
    print('\nDone. Browser connections should now work.')

if __name__ == '__main__':
    main()
