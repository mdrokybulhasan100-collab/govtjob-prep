import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, isConfigured } from "../lib/supabaseClient";
import ConfigNotice from "../components/ConfigNotice";
import Login from "../components/Login";
import Admin from "../components/Admin";
import editorTabs from "../features/editorRegistry";

export default function EditorPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [profile, setProfile] = useState(null); // { role, editor_status }

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
      checkRole();
      loadStaticData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function checkRole() {
    setCheckingRole(true);
    const { data } = await supabase.from("profiles").select("role, editor_status").eq("id", user.id).single();

    // First-ever visit to /editor for a plain 'user' with no prior
    // application: automatically file an application (status = pending).
    if (data && data.role === "user" && !data.editor_status) {
      await supabase
        .from("profiles")
        .update({ editor_status: "pending", editor_requested_at: new Date().toISOString() })
        .eq("id", user.id);
      setProfile({ role: "user", editor_status: "pending" });
    } else {
      setProfile(data || { role: "user", editor_status: null });
    }
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
  if (checkingRole || !profile) return null;

  const hasAccess = profile.role === "editor" || profile.role === "admin";

  if (!hasAccess) {
    return (
      <div className="locked-view">
        {profile.editor_status === "rejected" ? (
          <>
            <h2>❌ আবেদন গ্রহণযোগ্য হয়নি</h2>
            <p className="mode-desc">
              দুঃখিত, এই একাউন্টের ({user.email}) এডিটর আবেদন Admin গ্রহণ করেননি।
            </p>
          </>
        ) : (
          <>
            <h2>⏳ অনুমোদনের অপেক্ষায়</h2>
            <p className="mode-desc">
              আপনার আবেদন জমা হয়েছে ({user.email})। Admin অনুমোদন দিলেই এই পাতায়
              প্রশ্ন/বিষয়/টপিক যোগ করতে পারবেন। একটু পর আবার চেষ্টা করুন।
            </p>
          </>
        )}
        <Link to="/" className="cta-ghost" style={{ display: "inline-block", textDecoration: "none", marginTop: 12 }}>
          ← মূল অ্যাপে ফিরুন
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="topbar">
        <div className="topbar-left">
          <span className="seal-mini">✏️</span>
          <span className="topbar-title">Editor Panel</span>
        </div>
        <div className="topbar-right">
          <Link to="/" className="cta-small" style={{ textDecoration: "none" }}>← মূল অ্যাপ</Link>
          <button className="logout-btn" title="লগআউট" onClick={() => supabase.auth.signOut()}>⎋</button>
        </div>
      </header>
      <main className="main-area">
        <Admin
          subjects={subjects}
          topics={topics}
          exams={exams}
          refreshAll={loadStaticData}
          tabs={editorTabs}
          title="Editor Panel"
        />
      </main>
    </div>
  );
}
