import { Routes, Route } from "react-router-dom";
import MainApp from "./MainApp";
import AdminPage from "./pages/AdminPage";
import EditorPage from "./pages/EditorPage";

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="/editor/*" element={<EditorPage />} />
      <Route path="*" element={<MainApp />} />
    </Routes>
  );
}
