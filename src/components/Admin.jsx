import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import defaultAdminTabs from "../features/adminRegistry";

export default function Admin({ subjects, topics, exams, refreshAll, tabs, title, basePath = "/admin" }) {
  const activeTabs = tabs || defaultAdminTabs;
  const location = useLocation();
  const navigate = useNavigate();

  const tabRoutes = useMemo(() => {
    const routes = {};
    activeTabs.forEach((t) => {
      const slug = t.key === "liveexams" ? "live-exams" : t.key === "dailyfacts" ? "daily-facts" : t.key;
      routes[t.key] = `${basePath}/${slug}`;
    });
    return routes;
  }, [activeTabs, basePath]);

  const tab = activeTabs.find((t) => location.pathname === tabRoutes[t.key])?.key || null;

  useEffect(() => {
    if (!activeTabs.length) return;
    const valid = activeTabs.some((t) => location.pathname === tabRoutes[t.key]);
    if (!valid) navigate(tabRoutes[activeTabs[0].key], { replace: true });
  }, [activeTabs, location.pathname, navigate, tabRoutes]);

  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text }

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  const ActiveTab = activeTabs.find((t) => t.key === tab)?.component;

  return (
    <section className="view">
      <h2 className="section-title">{title || "Admin Panel"}</h2>

      <div className="admin-tabs">
        {activeTabs.map((t) => (
          <button
            key={t.key}
            className={`admin-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => navigate(tabRoutes[t.key])}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <div className={`admin-msg ${msg.type}`}>{msg.text}</div>}

      <div className="admin-panel">
        {ActiveTab && (
          <ActiveTab subjects={subjects} topics={topics} exams={exams} refreshAll={refreshAll} flash={flash} />
        )}
      </div>
    </section>
  );
}
