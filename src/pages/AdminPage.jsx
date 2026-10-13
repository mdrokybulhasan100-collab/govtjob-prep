import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, isConfigured } from "../lib/supabaseClient";
import { ensureProfileExists } from "../lib/ensureProfile";
import ConfigNotice from "../components/ConfigNotice";
import Login from "../components/Login";
import Admin from "../components/Admin";

export default function AdminPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);

  useEffect(() => {
    if (!isConfigured) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) await ensureProfileExists(session.user);
      setUser(session?.user || null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) await ensureProfileExists(session.user);
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Use the stable user ID rather than the full Supabase user object.
  // Supabase can emit TOKEN_REFRESHED / USER_UPDATED events with a new user
  // object even though the signed-in account has not changed. Depending on
  // [user] made the whole Admin page briefly return null during every refresh.
  const userId = user?.id || null;

  useEffect(() => {
    if (!userId) {
      setCheckingRole(false);
      setIsAdmin(false);
      setSubjects([]);
      setTopics([]);
      setExams([]);
      return;
    }

    let cancelled = false;
    // A new authenticated user can arrive while checkingRole is still false
    // (for example, after the initial auth listener fires). Keep the loading
    // state active until this user's role has actually been verified.
    setCheckingRole(true);
    async function initializeAdmin() {
      const [{ data: profile }, { data: s }, { data: t }, { data: e }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", userId).single(),
        supabase.from("subjects").select("*").order("sort_order"),
        supabase.from("topics").select("*").order("sort_order"),
        supabase.from("exams").select("*").order("year", { ascending: false })
      ]);
      if (cancelled) return;
      setIsAdmin(profile?.role === "admin");
      setSubjects(s || []);
      setTopics(t || []);
      setExams(e || []);
      setCheckingRole(false);
    }
    initializeAdmin().catch((error) => {
      if (cancelled) return;
      console.error("Failed to initialize admin panel:", error);
      setIsAdmin(false);
      setCheckingRole(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  async function loadStaticData() {
    const [{ data: s }, { data: t }, { data: e }] = await Promise.all([
      supabase.from("subjects").select("*").order("sort_order"),
      supabase.from("topics").select("*").order("sort_order"),
      supabase.from("exams").select("*").order("year", { ascending: false })
    ]);
    setSubjects(s || []);
    setTopics(t || []);
    setExams(e || []);
  }

  if (!isConfigured) return <ConfigNotice />;
  if (authLoading) return null;
  if (!user) return <Login />;
  if (checkingRole) return null;

  if (!isAdmin) {
    return (
      <div className="locked-view">
        <h2>🔒 এই পাতা শুধু Admin-দের জন্য</h2>
        <p className="mode-desc">
          এই একাউন্ট ({user.email}) Admin হিসেবে সেট করা নেই। README.md-এর
          "নিজেকে Admin বানানো" অংশ অনুসরণ করুন।
        </p>
        <Link to="/" className="cta-ghost" style={{ display: "inline-block", textDecoration: "none" }}>
          ← মূল অ্যাপে ফিরুন
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-app-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <span className="admin-brand-mark">⚙</span>
          <span className="admin-brand-copy"><strong>Admin Console</strong><small>সরকারি চাকরি প্রস্তুতি</small></span>
        </div>
        <div className="admin-topbar-actions">
          <span className="admin-secure-label"><span /> Admin access</span>
          <Link to="/" className="admin-home-link" style={{ textDecoration: "none" }}>↗ মূল অ্যাপ</Link>
          <button className="admin-logout-btn" title="লগআউট" onClick={() => supabase.auth.signOut()}>লগআউট <span>↗</span></button>
        </div>
      </header>
      <main className="admin-main-area">
        <Admin subjects={subjects} topics={topics} exams={exams} refreshAll={loadStaticData} user={user} basePath="/admin" />
      </main>
    </div>
  );
}
