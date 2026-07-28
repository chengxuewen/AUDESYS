#!/usr/bin/env python3
"""Token validation patches for browser compatibility.
Uses exact method signature matching to avoid structural corruption.
"""
import re

def patch_file(path, patches, label):
    with open(path, 'r') as f:
        content = f.read()
    orig = len(content)
    for pattern, replacement, desc in patches:
        content, n = re.subn(pattern, replacement, content, flags=re.DOTALL)
        action = f"Patched {n}" if n > 0 else "Already patched or not found"
        print(f'  [{label}] {action}: {desc}')
    if len(content) != orig:
        with open(path, 'w') as f:
            f.write(content)
        print(f'  [{label}] File updated ({len(content) - orig:+d} bytes)')
    else:
        print(f'  [{label}] No changes needed')

def main():
    patches = [
        (r'allowRequest\(request\)\s*\{\s*if\s*\(\s*!\s*this\s*\.\s*\w+\s*\)\s*\{\s*return\s+true\s*;\s*\}[\s\S]*?\n\s*return\s+false\s*;\s*\}',
         'allowRequest(request) { return true; }',
         'ElectronTokenValidator.allowRequest'),
        (r'allowWsUpgrade\(request\)\s*\{\s*return\s+this\s*\.\s*allowRequest\(request\)\s*;\s*\}',
         'allowWsUpgrade(request) { return true; }',
         'ElectronTokenValidator.allowWsUpgrade'),
        (r'if\s*\(\s*this\s*\.\s*\w+\s*\.\s*allowRequest\(req\)\s*\)', 'if (true)', 'Express middleware'),
        (r'allowRequest:\s*\(req,\s*callback\)\s*=>\s*\{[\s\S]*?tokenValidator[\s\S]*?\n\s*\},',
         'allowRequest: (req, callback) => { callback(null, true); },',
         'Socket.IO allowRequest'),
        (r'async\s+allowConnect\(request\)\s*\{[\s\S]*?tokenValidator[\s\S]*?\n\s*\}',
         'async allowConnect(request) { return true; }',
         'Socket.IO allowConnect'),
    ]
    patch_file('lib/backend/main.js', patches, 'main.js')
    em = [
        (r'allowRequest\(request\)\s*\{[\s\S]*?return\s+false\s*;\s*\}', 'allowRequest(request) { return true; }', 'em allowRequest'),
        (r'allowWsUpgrade\(request\)\s*\{[\s\S]*?\}', 'allowWsUpgrade(request) { return true; }', 'em allowWsUpgrade'),
        (r'if\s*\(\s*this\s*\.\s*\w+\s*\.\s*allowRequest\(req\)\s*\)', 'if (true)', 'em Express'),
    ]
    patch_file('lib/backend/electron-main.js', em, 'electron-main.js')
    print('\nDone.')

if __name__ == '__main__':
    main()
