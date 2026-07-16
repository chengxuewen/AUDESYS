export default function MainContent() {
  return (
    <main className="flex-1 bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-gray-300 mb-2">
          AUDESYS Studio
        </h1>
        <p className="text-sm text-gray-600">
          Industrial Control IDE
        </p>
        <p className="text-xs text-gray-700 mt-4">
          Select a file from the sidebar to begin
        </p>
      </div>
    </main>
  );
}
