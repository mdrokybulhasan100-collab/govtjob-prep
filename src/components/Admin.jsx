import { useEffect, useState } from "react";
import defaultAdminTabs from "../features/adminRegistry";

export default function Admin({ subjects, topics, exams, refreshAll, tabs, title }) {
  const activeTabs = tabs || defaultAdminTabs;
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem("govtjobprep:admin-tab") || activeTabs[0]?.key;
    } catch (_) {
      return activeTabs[0]?.key;
    }
  });

  useEffect(() => {
    if (!activeTabs.some((t) => t.key === tab)) setTab(activeTabs[0]?.key);
  }, [activeTabs, tab]);

  useEffect(() => {
    try { localStorage.setItem("govtjobprep:admin-tab", tab || ""); } catch (_) {}
  }, [tab]);
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
          <button key={t.key} className={`admin-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
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
