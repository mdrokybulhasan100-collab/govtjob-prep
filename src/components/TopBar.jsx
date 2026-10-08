import { supabase } from "../lib/supabaseClient";
import { useApp } from "../lib/AppContext";
import features from "../features/registry";

export default function TopBar() {
  const { view, setView, user } = useApp();
  const mainFeatures = features.filter((item) => item.key !== "dashboard");

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand-lockup" onClick={() => setView("dashboard")} aria-label="ড্যাশবোর্ড">
          <span className="seal-mini">সচ</span>
          <span className="topbar-title">সরকারি চাকরি প্রস্তুতি</span>
        </button>

        <nav className="topbar-nav" aria-label="প্রধান মেনু">
          <button className={`nav-link ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>⌂ ড্যাশবোর্ড</button>
          {mainFeatures.map((item) => (
            <button key={item.key} className={`nav-link ${view === item.key ? "active" : ""}`} onClick={() => setView(item.key)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <button className="topbar-premium" onClick={() => setView("subscription")}>✦ Premium</button>
          {user?.user_metadata?.avatar_url ? <img className="avatar" src={user.user_metadata.avatar_url} alt="" /> : <span className="avatar avatar-fallback">{(user?.user_metadata?.full_name || user?.email || "U").slice(0,1).toUpperCase()}</span>}
          <span className="user-name">{user?.user_metadata?.full_name || user?.email}</span>
          <button className="logout-btn" title="লগআউট" onClick={() => supabase.auth.signOut()}>⎋</button>
        </div>
      </div>
    </header>
  );
}
