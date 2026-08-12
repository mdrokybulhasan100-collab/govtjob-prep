import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, isConfigured } from "../lib/supabaseClient";
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
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
    <div>
      <header className="topbar">
        <div className="topbar-left">
          <span className="seal-mini">⚙️</span>
          <span className="topbar-title">Admin Panel</span>
        </div>
        <div className="topbar-right">
          <Link to="/" className="cta-small" style={{ textDecoration: "none" }}>← মূল অ্যাপ</Link>
          <button className="logout-btn" title="লগআউট" onClick={() => supabase.auth.signOut()}>⎋</button>
        </div>
      </header>
      <main className="main-area">
        <Admin subjects={subjects} topics={topics} exams={exams} refreshAll={loadStaticData} />
      </main>
    </div>
  );
}
