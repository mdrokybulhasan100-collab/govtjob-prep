import { useState } from "react";
import adminTabs from "../features/adminRegistry";

export default function Admin({ subjects, topics, exams, refreshAll }) {
  const [tab, setTab] = useState(adminTabs[0]?.key);
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text }

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  const ActiveTab = adminTabs.find((t) => t.key === tab)?.component;

  return (
    <section className="view">
      <h2 className="section-title">Admin Panel</h2>

      <div className="admin-tabs">
        {adminTabs.map((t) => (
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
