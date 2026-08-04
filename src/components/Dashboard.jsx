import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";

const RING_CIRCUMFERENCE = 327;
const XP_PER_LEVEL = 200;

const BADGE_DEFS = [
  { key: "first_quiz", emoji: "🎯", name: "প্রথম কুইজ", check: (s) => s.sessions >= 1 },
  { key: "q50", emoji: "📚", name: "৫০ প্রশ্ন", check: (s) => s.totalQ >= 50 },
  { key: "q200", emoji: "🏆", name: "২০০ প্রশ্ন", check: (s) => s.totalQ >= 200 },
  { key: "streak7", emoji: "🔥", name: "৭ দিনের ধারা", check: (s) => s.streak >= 7 },
  { key: "perfect", emoji: "💯", name: "নিখুঁত স্কোর", check: (s) => s.hasPerfect },
  { key: "master", emoji: "🥇", name: "বিষয় মাস্টার", check: (s) => s.hasMastery }
];

function computeStreak(dateStrings) {
  const uniqueDays = [...new Set(dateStrings)].sort().reverse(); // most recent first
  if (!uniqueDays.length) return 0;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (uniqueDays[0] !== todayStr && uniqueDays[0] !== yesterdayStr) return 0;

  let streak = 1;
  let cursor = new Date(uniqueDays[0]);
  for (let i = 1; i < uniqueDays.length; i++) {
    cursor.setDate(cursor.getDate() - 1);
    const expected = cursor.toISOString().slice(0, 10);
    if (uniqueDays[i] === expected) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export default function Dashboard({ user, subjects, setView }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQ: 0, sessions: 0, correct: 0, accuracy: 0, streak: 0, xp: 0, hasPerfect: false, hasMastery: false
  });
  const [subjectStats, setSubjectStats] = useState({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);

    const { data: sessions } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", user.id)
      .not("completed_at", "is", null);

    const rows = sessions || [];
    const totalQ = rows.reduce((a, s) => a + s.total_questions, 0);
    const correct = rows.reduce((a, s) => a + s.correct_answers, 0);
    const accuracy = totalQ ? Math.round((correct / totalQ) * 100) : 0;
    const hasPerfect = rows.some((s) => s.total_questions > 0 && s.correct_answers === s.total_questions);
    const streak = computeStreak(rows.map((s) => s.completed_at.slice(0, 10)));
    const xp = correct * 10 + totalQ * 2;

    const sessionIds = rows.map((s) => s.id);
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
    const hasMastery = Object.values(bySubject).some((s) => s.total >= 20 && s.correct / s.total >= 0.9);

    setSubjectStats(bySubject);
    setStats({ totalQ, sessions: rows.length, correct, accuracy, streak, xp, hasPerfect, hasMastery });
    setLoading(false);
  }

  const offset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * stats.accuracy) / 100;
  const level = Math.floor(stats.xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = stats.xp % XP_PER_LEVEL;
  const xpPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);

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
            <span className="stat-num">{toBn(stats.totalQ)}</span>
            <span className="stat-label">মোট প্রশ্ন চেষ্টা</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{toBn(stats.sessions)}</span>
            <span className="stat-label">সম্পন্ন সেশন</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{toBn(stats.correct)}</span>
            <span className="stat-label">সঠিক উত্তর</span>
          </div>
        </div>
      </div>

      <div className="gamify-row">
        <span className="chip chip-streak"><span className="chip-emoji">🔥</span> {toBn(stats.streak)} দিনের ধারা</span>
        <span className="chip chip-level"><span className="chip-emoji">⭐</span> লেভেল {toBn(level)}</span>
        <div className="xp-track"><div className="xp-fill" style={{ width: `${xpPct}%` }} /></div>
      </div>

      <h2 className="section-title">অর্জন</h2>
      <div className="badge-grid">
        {BADGE_DEFS.map((b) => {
          const unlocked = b.check(stats);
          return (
            <div className={`badge-card ${unlocked ? "" : "locked"}`} key={b.key}>
              <span className="badge-emoji">{b.emoji}</span>
              <span className="badge-name">{b.name}</span>
            </div>
          );
        })}
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
              <span className="sc-meta">{toBn(s.correct)}/{toBn(s.total)} সঠিক · {toBn(pct)}%</span>
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
