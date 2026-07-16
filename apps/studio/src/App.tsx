import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import MainContent from "./components/MainContent";

export default function App() {
  return (
    <div className="h-screen w-screen bg-gray-950 text-gray-200 flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainContent />
      </div>
      <StatusBar />
    </div>
  );
}
