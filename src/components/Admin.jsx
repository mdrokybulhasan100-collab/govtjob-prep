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

  const activeTab = activeTabs.find((t) => t.key === tab);

  return (
    <section className="view admin-workspace">
      <div className="admin-page-heading">
        <div>
          <div className="admin-eyebrow">CONTROL CENTER <span /></div>
          <h1>{title || "Admin Panel"}</h1>
          <p>আপনার প্রস্তুতি প্ল্যাটফর্মের কনটেন্ট, পরীক্ষা ও শিক্ষার্থী এক জায়গা থেকে পরিচালনা করুন।</p>
        </div>
        <div className="admin-heading-meta"><span className="admin-heading-meta-dot" /> সিস্টেম পরিচালনা</div>
      </div>

      <div className="admin-workspace-grid">
        <aside className="admin-sidebar" aria-label="Admin navigation">
          <div className="admin-sidebar-label">WORKSPACE</div>
          {activeTabs.map((t, index) => (
            <button
              key={t.key}
              className={`admin-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => navigate(tabRoutes[t.key])}
              aria-current={tab === t.key ? "page" : undefined}
            >
              <span className="admin-tab-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="admin-tab-label">{t.label}</span>
              <span className="admin-tab-arrow">›</span>
            </button>
          ))}
          <div className="admin-sidebar-note"><span>✦</span><div><strong>Admin workspace</strong><small>পরিবর্তনগুলো সেভ করার আগে যাচাই করুন।</small></div></div>
        </aside>

        <div className="admin-content-column">
          <div className="admin-content-heading">
            <div><span className="admin-content-kicker">CURRENT SECTION</span><h2>{activeTab?.label?.replace(/^\p{Extended_Pictographic}\s*/u, "") || "Management"}</h2></div>
            <span className="admin-live-pill"><span /> Active</span>
          </div>
          {msg && <div className={`admin-msg ${msg.type}`}>{msg.text}</div>}
          <div className="admin-panel">
            {ActiveTab && (
              <ActiveTab subjects={subjects} topics={topics} exams={exams} refreshAll={refreshAll} flash={flash} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
