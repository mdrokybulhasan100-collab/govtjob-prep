import { supabase } from "../lib/supabaseClient";
import { useApp } from "../lib/AppContext";
import features from "../features/registry";

export default function TopBar() {
  const { view, setView, user } = useApp();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="seal-mini">সচ</span>
        <span className="topbar-title">সরকারি চাকরি প্রস্তুতি</span>
      </div>

      <nav className="topbar-nav">
        {features.map((item) => (
          <button
            key={item.key}
            className={`nav-link ${view === item.key ? "active" : ""}`}
            onClick={() => setView(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="topbar-right">
        {user?.user_metadata?.avatar_url && (
          <img className="avatar" src={user.user_metadata.avatar_url} alt="" />
        )}
        <span className="user-name">{user?.user_metadata?.full_name || user?.email}</span>
        <button className="logout-btn" title="লগআউট" onClick={() => supabase.auth.signOut()}>
          ⎋
        </button>
      </div>
    </header>
  );
}
