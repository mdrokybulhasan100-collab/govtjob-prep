import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const RING_CIRCUMFERENCE = 327;

export default function Dashboard({ user, subjects, setView }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalQ: 0, sessions: 0, correct: 0, accuracy: 0 });
  const [subjectStats, setSubjectStats] = useState({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);

    // .eq("user_id", user.id) is explicit here for clarity, and RLS on the
    // server guarantees this user can never receive another user's rows
    // even if this filter were ever removed or a query written differently.
    const { data: sessions } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", user.id)
      .not("completed_at", "is", null);

    const totalQ = (sessions || []).reduce((a, s) => a + s.total_questions, 0);
    const correct = (sessions || []).reduce((a, s) => a + s.correct_answers, 0);
    const accuracy = totalQ ? Math.round((correct / totalQ) * 100) : 0;

    setStats({ totalQ, sessions: (sessions || []).length, correct, accuracy });

    const sessionIds = (sessions || []).map((s) => s.id);
    let answers = [];
    if (sessionIds.length) {
      const { data } = await supabase
        .from("session_answers")
        .select("is_correct, questions(subject_id)")
        .in("session_id", sessionIds);
      answers = data || [];
    }

    const bySubject = {};
    answers.forEach((a) => {
      const sid = a.questions?.subject_id;
      if (!sid) return;
      bySubject[sid] = bySubject[sid] || { total: 0, correct: 0 };
      bySubject[sid].total++;
      if (a.is_correct) bySubject[sid].correct++;
    });
    setSubjectStats(bySubject);
    setLoading(false);
  }

  const offset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * stats.accuracy) / 100;

  return (
    <section className="view">
      <div className="dash-hero">
        <div className="ring-wrap">
          <svg viewBox="0 0 120 120" className="progress-ring">
            <circle cx="60" cy="60" r="52" className="ring-track" />
            <circle
              cx="60" cy="60" r="52" className="ring-fill"
              style={{ strokeDashoffset: loading ? RING_CIRCUMFERENCE : offset }}
            />
          </svg>
          <div className="ring-center">
            <span>{stats.accuracy}%</span>
            <small>সঠিক উত্তর</small>
          </div>
        </div>
        <div className="dash-stats">
          <div className="stat-card">
            <span className="stat-num">{stats.totalQ}</span>
            <span className="stat-label">মোট প্রশ্ন চেষ্টা</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{stats.sessions}</span>
            <span className="stat-label">সম্পন্ন সেশন</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{stats.correct}</span>
            <span className="stat-label">সঠিক উত্তর</span>
          </div>
        </div>
      </div>

      <h2 className="section-title">বিষয়ভিত্তিক অগ্রগতি</h2>
      <div className="subject-grid">
        {subjects.map((sub) => {
          const s = subjectStats[sub.id] || { total: 0, correct: 0 };
          const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
          return (
            <div className="subject-card" key={sub.id}>
              <span className="sc-name">{sub.icon} {sub.name_bn}</span>
              <div className="sc-bar-track"><div className="sc-bar-fill" style={{ width: `${pct}%` }} /></div>
              <span className="sc-meta">{s.correct}/{s.total} সঠিক · {pct}%</span>
            </div>
          );
        })}
      </div>

      <button className="cta-primary" style={{ marginTop: 28 }} onClick={() => setView("practice")}>
        নতুন প্র্যাকটিস শুরু করুন →
      </button>
    </section>
  );
}
