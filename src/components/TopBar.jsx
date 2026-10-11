import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../lib/AppContext";
import features from "../features/registry";

export default function TopBar() {
  const { view, setView, user } = useApp();
  const mainFeatures = features.filter((item) => item.key !== "dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigateTo = (nextView) => { setView(nextView); setMobileMenuOpen(false); };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand-lockup" onClick={() => navigateTo("dashboard")} aria-label="ড্যাশবোর্ড">
          <span className="seal-mini">সচ</span>
          <span className="topbar-title">সরকারি চাকরি প্রস্তুতি</span>
        </button>

        <button className={`mobile-menu-toggle ${mobileMenuOpen ? "is-open" : ""}`} type="button" aria-label={mobileMenuOpen ? "মেনু বন্ধ করুন" : "মেনু খুলুন"} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><span></span><span></span><span></span></button>

        <nav className={`topbar-nav ${mobileMenuOpen ? "mobile-open" : ""}`} aria-label="প্রধান মেনু">
          <button className={`nav-link ${view === "dashboard" ? "active" : ""}`} onClick={() => navigateTo("dashboard")}>⌂ ড্যাশবোর্ড</button>
          {mainFeatures.map((item) => (
            <button key={item.key} className={`nav-link ${view === item.key ? "active" : ""}`} onClick={() => navigateTo(item.key)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <button className="topbar-premium" onClick={() => navigateTo("subscription")}>✦ Premium</button>
          {user?.user_metadata?.avatar_url ? <img className="avatar" src={user.user_metadata.avatar_url} alt="" /> : <span className="avatar avatar-fallback">{(user?.user_metadata?.full_name || user?.email || "U").slice(0,1).toUpperCase()}</span>}
          <span className="user-name">{user?.user_metadata?.full_name || user?.email}</span>
          <button className="logout-btn" title="লগআউট" onClick={() => supabase.auth.signOut()}>⎋</button>
        </div>
      </div>
    </header>
  );
}
