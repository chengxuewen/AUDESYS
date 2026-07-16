export default function StatusBar() {
  return (
    <footer className="h-7 w-full bg-gray-900 border-t border-gray-800 flex items-center justify-between px-3 flex-shrink-0">
      <span className="text-xs text-gray-500">Status: Ready</span>
      <span className="text-xs text-gray-600">Phase 1</span>
      <span className="text-xs text-gray-600">v0.1.0-dev</span>
    </footer>
  );
}
