import { Routes, Route } from "react-router-dom";
import MainApp from "./MainApp";
import AdminPage from "./pages/AdminPage";
import CentralArchive from '../CentralArchive';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/central-archive" element={<CentralArchive />} />
    </Routes>
  );
}
