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

  useEffect(() => {
    if (user) {
      checkAdmin();
      loadStaticData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function checkAdmin() {
    setCheckingRole(true);
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    setIsAdmin(data?.role === "admin");
    setCheckingRole(false);
  }

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
        <Admin subjects={subjects} topics={topics} exams={exams} refreshAll={loadStaticData} basePath="/admin" />
      </main>
    </div>
  );
}
