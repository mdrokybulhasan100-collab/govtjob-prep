import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { useApp } from "../lib/AppContext";
import LiveExamWidget from "./LiveExamWidget";
import AnnouncementsWidget from "./AnnouncementsWidget";
import DailyFactWidget from "./DailyFactWidget";

const XP_PER_LEVEL = 200;
const COLORS = { correct: "#10B981", wrong: "#EF4444" };
const BN_WEEKDAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];

function computeStreak(dateStrings) {
  const uniqueDays = [...new Set(dateStrings)].sort().reverse();
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
    if (uniqueDays[i] === expected) streak++;
    else break;
  }
  return streak;
}

function last14Days() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const MODE_LABELS = {
  all: "সব বিষয়", subject: "বিষয়ভিত্তিক", topic: "টপিকভিত্তিক",
  exam: "পরীক্ষা", custom: "কুইজ বিল্ডার", live: "লাইভ পরীক্ষা",
  practice: "প্র্যাকটিস", examarchive: "পরীক্ষা আর্কাইভ"
};

export default function Dashboard() {
  const { user, subjects, topics, exams, setView } = useApp();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalQ: 0, sessions: 0, correct: 0, accuracy: 0, streak: 0, xp: 0 });
  const [trendData, setTrendData] = useState([]);
  const [subjectData, setSubjectData] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [bestSubject, setBestSubject] = useState(null);
  const [worstSubject, setWorstSubject] = useState(null);
  const [topicProgress, setTopicProgress] = useState([]);
  const [studyMinutes, setStudyMinutes] = useState(0);
  const [weekCompare, setWeekCompare] = useState(null); // { thisWeekQ, lastWeekQ, thisAcc, lastAcc }
  const [typeBreakdown, setTypeBreakdown] = useState(null); // { mcq: {correct,total}, short: {correct,total} }
  const [quickCounts, setQuickCounts] = useState({ favorites: 0, liveExams: 0 });

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
    // Score/accuracy stats come from real quizzes only (Quiz Builder, Live
    // Exam, Exam Archive) — casual flashcard Practice never saves a score,
    // so it's excluded here but still counted toward study time below.
    const scoreRows = rows.filter((s) => s.mode !== "practice");
    const totalQ = scoreRows.reduce((a, s) => a + s.total_questions, 0);
    const correct = scoreRows.reduce((a, s) => a + s.correct_answers, 0);
    const accuracy = totalQ ? Math.round((correct / totalQ) * 100) : 0;
    const streak = computeStreak(rows.map((s) => s.completed_at.slice(0, 10)));
    const xp = correct * 10 + totalQ * 2;
    setStats({ totalQ, sessions: scoreRows.length, correct, accuracy, streak, xp });

    // ---- Total study time (sum of started_at -> completed_at per session) ----
    const totalMs = rows.reduce((a, s) => {
      if (!s.started_at || !s.completed_at) return a;
      return a + (new Date(s.completed_at) - new Date(s.started_at));
    }, 0);
    setStudyMinutes(Math.round(totalMs / 60000));

    // ---- This week vs last week (score-relevant sessions only) ----
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const thisWeekRows = scoreRows.filter((s) => now - new Date(s.completed_at).getTime() <= 7 * oneDay);
    const lastWeekRows = scoreRows.filter((s) => {
      const diff = now - new Date(s.completed_at).getTime();
      return diff > 7 * oneDay && diff <= 14 * oneDay;
    });
    const sumQ = (arr) => arr.reduce((a, s) => a + s.total_questions, 0);
    const sumC = (arr) => arr.reduce((a, s) => a + s.correct_answers, 0);
    const thisWeekQ = sumQ(thisWeekRows);
    const lastWeekQ = sumQ(lastWeekRows);
    const thisAcc = thisWeekQ ? Math.round((sumC(thisWeekRows) / thisWeekQ) * 100) : 0;
    const lastAcc = lastWeekQ ? Math.round((sumC(lastWeekRows) / lastWeekQ) * 100) : 0;
    setWeekCompare({ thisWeekQ, lastWeekQ, thisAcc, lastAcc });

    // ---- Quick counts: revision list, live exams participated ----
    const [{ count: favCount }, { count: liveCount }] = await Promise.all([
      supabase.from("question_knowledge").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "unknown"),
      supabase.from("practice_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("mode", "live").not("completed_at", "is", null)
    ]);
    setQuickCounts({ favorites: favCount || 0, liveExams: liveCount || 0 });

    // ---- Recent sessions (last 8, all activity including practice) ----
    const sorted = [...rows].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
    const recent = sorted.slice(0, 8).map((s) => {
      const subj = subjects.find((x) => x.id === s.subject_id);
      const top = topics.find((x) => x.id === s.topic_id);
      const ex = exams.find((x) => x.id === s.exam_id);
      const label = top?.name_bn || subj?.name_bn || ex?.name || MODE_LABELS[s.mode] || s.mode;
      const isPractice = s.mode === "practice";
      const pct = s.total_questions ? Math.round((s.correct_answers / s.total_questions) * 100) : 0;
      const minutes = s.started_at ? Math.max(0, Math.round((new Date(s.completed_at) - new Date(s.started_at)) / 60000)) : 0;
      return {
        id: s.id,
        mode: MODE_LABELS[s.mode] || s.mode,
        label,
        date: new Date(s.completed_at).toLocaleDateString("bn-BD", { day: "numeric", month: "short" }),
        isPractice,
        minutes,
        correct: s.correct_answers,
        total: s.total_questions,
        pct
      };
    });
    setRecentSessions(recent);

    // ---- Daily trend (last 14 days): questions answered (score-relevant only) ----
    const byDay = {};
    scoreRows.forEach((s) => {
      const day = s.completed_at.slice(0, 10);
      byDay[day] = byDay[day] || { total: 0, correct: 0 };
      byDay[day].total += s.total_questions;
      byDay[day].correct += s.correct_answers;
    });
    const trend = last14Days().map((day) => {
      const d = new Date(day);
      const stat = byDay[day] || { total: 0, correct: 0 };
      return {
        label: BN_WEEKDAYS[d.getDay()],
        প্রশ্ন: stat.total,
        নির্ভুলতা: stat.total ? Math.round((stat.correct / stat.total) * 100) : 0
      };
    });
    setTrendData(trend);

    // ---- Subject-wise correct/wrong + topic-wise progress + question-type breakdown ----
    const sessionIds = rows.map((s) => s.id);
    let answers = [];
    if (sessionIds.length) {
      const { data } = await supabase
        .from("session_answers")
        .select("is_correct, questions(subject_id, topic_id, question_type, topics(name_bn))")
        .in("session_id", sessionIds);
      answers = data || [];
    }

    const bySubject = {};
    const byTopic = {};
    const byType = { mcq: { correct: 0, total: 0 }, short: { correct: 0, total: 0 } };
    answers.forEach((a) => {
      const sid = a.questions?.subject_id;
      const tid = a.questions?.topic_id;
      const tname = a.questions?.topics?.name_bn;
      const qtype = a.questions?.question_type === "short" ? "short" : "mcq";
      if (sid) {
        bySubject[sid] = bySubject[sid] || { correct: 0, wrong: 0 };
        if (a.is_correct) bySubject[sid].correct++;
        else if (a.is_correct === false) bySubject[sid].wrong++;
      }
      if (tid) {
        byTopic[tid] = byTopic[tid] || { name: tname || "অজানা টপিক", correct: 0, total: 0 };
        byTopic[tid].total++;
        if (a.is_correct) byTopic[tid].correct++;
      }
      if (a.questions) {
        byType[qtype].total++;
        if (a.is_correct) byType[qtype].correct++;
      }
    });
    setTypeBreakdown(byType);

    const subjectChart = subjects
      .map((sub) => {
        const s = bySubject[sub.id] || { correct: 0, wrong: 0 };
        return { name: `${sub.icon} ${sub.name_bn}`, সঠিক: s.correct, ভুল: s.wrong, total: s.correct + s.wrong };
      })
      .filter((s) => s.total > 0);
    setSubjectData(subjectChart);

    // best/worst subject — need a minimum sample size to be meaningful
    const qualifying = subjectChart.filter((s) => s.total >= 5);
    if (qualifying.length) {
      const withAcc = qualifying.map((s) => ({ ...s, acc: s.সঠিক / s.total }));
      withAcc.sort((a, b) => b.acc - a.acc);
      setBestSubject(withAcc[0]);
      setWorstSubject(withAcc[withAcc.length - 1]);
    } else {
      setBestSubject(null);
      setWorstSubject(null);
    }

    const topicList = Object.values(byTopic)
      .filter((t) => t.total >= 3)
      .map((t) => ({ ...t, pct: Math.round((t.correct / t.total) * 100) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    setTopicProgress(topicList);

    setLoading(false);
  }

  const level = Math.floor(stats.xp / XP_PER_LEVEL) + 1;
  const xpPct = Math.round(((stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100);
  const pieData = [
    { name: "সঠিক", value: stats.correct },
    { name: "ভুল", value: Math.max(0, stats.totalQ - stats.correct) }
  ];

  return (
    <section className="view">
      <div className="dash-top-row">
        <div className="dash-stat-mini">
          <span className="stat-num">{toBn(stats.totalQ)}</span>
          <span className="stat-label">মোট প্রশ্ন</span>
        </div>
        <div className="dash-stat-mini">
          <span className="stat-num">{toBn(stats.sessions)}</span>
          <span className="stat-label">সেশন</span>
        </div>
        <div className="dash-stat-mini">
          <span className="stat-num">{stats.accuracy}%</span>
          <span className="stat-label">নির্ভুলতা</span>
        </div>
        <div className="dash-stat-mini">
          <span className="stat-num">{toBn(Math.floor(studyMinutes / 60))}<small style={{ fontSize: 12 }}>ঘ</small> {toBn(studyMinutes % 60)}<small style={{ fontSize: 12 }}>মি</small></span>
          <span className="stat-label">মোট সময়</span>
        </div>
        <div className="dash-stat-mini">
          <span className="chip chip-streak">🔥 {toBn(stats.streak)} দিন</span>
        </div>
        <div className="dash-stat-mini">
          <span className="chip chip-level">⭐ লেভেল {toBn(level)} ({toBn(xpPct)}%)</span>
        </div>
      </div>

      <div className="dash-top-row">
        <div className="dash-stat-mini">
          <span className="stat-num">{toBn(quickCounts.favorites)}</span>
          <span className="stat-label">🔖 রিভিশন লিস্ট</span>
        </div>
        <div className="dash-stat-mini">
          <span className="stat-num">{toBn(quickCounts.liveExams)}</span>
          <span className="stat-label">🔴 লাইভ পরীক্ষা অংশগ্রহণ</span>
        </div>
      </div>

      <div className="widget-row">
        <LiveExamWidget />
        <DailyFactWidget />
        <AnnouncementsWidget />
      </div>

      {loading ? (
        <p className="mode-desc">লোড হচ্ছে...</p>
      ) : stats.totalQ === 0 ? (
        <div className="chart-card">
          <p className="mode-desc">এখনো কোনো প্র্যাকটিস করেননি — প্রথম কুইজ দিলেই এখানে গ্রাফ দেখা শুরু হবে।</p>
          <button className="cta-primary" onClick={() => setView("practice")}>প্র্যাকটিস শুরু করুন →</button>
        </div>
      ) : (
        <>
          <h2 className="section-title">গত ১৪ দিনের অ্যাক্টিভিটি</h2>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="qFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5F3" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6B667F" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#6B667F" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E7E5F3", fontSize: 13 }} />
                <Area type="monotone" dataKey="প্রশ্ন" stroke="#4F46E5" strokeWidth={2} fill="url(#qFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <h3 className="chart-card-title">বিষয়ভিত্তিক সঠিক/ভুল</h3>
              {subjectData.length === 0 ? (
                <p className="mode-desc">এখনো কোনো বিষয়ভিত্তিক ডেটা নেই।</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={subjectData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E5F3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#6B667F" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: "#1E1B3A" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E7E5F3", fontSize: 13 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="সঠিক" stackId="a" fill={COLORS.correct} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="ভুল" stackId="a" fill={COLORS.wrong} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-card">
              <h3 className="chart-card-title">সামগ্রিক ফলাফল</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    <Cell fill={COLORS.correct} />
                    <Cell fill={COLORS.wrong} />
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E7E5F3", fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-grid" style={{ marginBottom: 20 }}>
            {weekCompare && (
              <div className="chart-card">
                <h3 className="chart-card-title">এই সপ্তাহ বনাম গত সপ্তাহ</h3>
                <div className="week-compare-row">
                  <div>
                    <span className="wc-label">প্রশ্ন চেষ্টা</span>
                    <span className="wc-value">{toBn(weekCompare.thisWeekQ)}</span>
                    <span className={`wc-delta ${weekCompare.thisWeekQ >= weekCompare.lastWeekQ ? "up" : "down"}`}>
                      {weekCompare.thisWeekQ >= weekCompare.lastWeekQ ? "▲" : "▼"} গত সপ্তাহ: {toBn(weekCompare.lastWeekQ)}
                    </span>
                  </div>
                  <div>
                    <span className="wc-label">নির্ভুলতা</span>
                    <span className="wc-value">{toBn(weekCompare.thisAcc)}%</span>
                    <span className={`wc-delta ${weekCompare.thisAcc >= weekCompare.lastAcc ? "up" : "down"}`}>
                      {weekCompare.thisAcc >= weekCompare.lastAcc ? "▲" : "▼"} গত সপ্তাহ: {toBn(weekCompare.lastAcc)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {typeBreakdown && (typeBreakdown.mcq.total > 0 || typeBreakdown.short.total > 0) && (
              <div className="chart-card">
                <h3 className="chart-card-title">MCQ বনাম Short Answer</h3>
                <div className="week-compare-row">
                  <div>
                    <span className="wc-label">MCQ</span>
                    <span className="wc-value">
                      {typeBreakdown.mcq.total ? toBn(Math.round((typeBreakdown.mcq.correct / typeBreakdown.mcq.total) * 100)) : toBn(0)}%
                    </span>
                    <span className="wc-delta">{toBn(typeBreakdown.mcq.correct)}/{toBn(typeBreakdown.mcq.total)} সঠিক</span>
                  </div>
                  <div>
                    <span className="wc-label">Short Answer</span>
                    <span className="wc-value">
                      {typeBreakdown.short.total ? toBn(Math.round((typeBreakdown.short.correct / typeBreakdown.short.total) * 100)) : toBn(0)}%
                    </span>
                    <span className="wc-delta">{toBn(typeBreakdown.short.correct)}/{toBn(typeBreakdown.short.total)} সঠিক</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {(bestSubject || worstSubject) && (
            <div className="chart-grid" style={{ marginBottom: 20 }}>
              {bestSubject && (
                <div className="highlight-card highlight-good">
                  <span className="highlight-label">💪 সবচেয়ে ভালো বিষয়</span>
                  <span className="highlight-name">{bestSubject.name}</span>
                  <span className="highlight-pct">{toBn(Math.round(bestSubject.acc * 100))}% নির্ভুলতা</span>
                </div>
              )}
              {worstSubject && (
                <div className="highlight-card highlight-bad">
                  <span className="highlight-label">📌 আরও অনুশীলন দরকার</span>
                  <span className="highlight-name">{worstSubject.name}</span>
                  <span className="highlight-pct">{toBn(Math.round(worstSubject.acc * 100))}% নির্ভুলতা</span>
                </div>
              )}
            </div>
          )}

          {topicProgress.length > 0 && (
            <>
              <h2 className="section-title">টপিকভিত্তিক প্রোগ্রেস</h2>
              <div className="chart-card">
                <div className="topic-progress-list">
                  {topicProgress.map((t, i) => (
                    <div className="topic-progress-row" key={i}>
                      <span className="tp-name">{t.name}</span>
                      <div className="sc-bar-track"><div className="sc-bar-fill" style={{ width: `${t.pct}%` }} /></div>
                      <span className="tp-pct">{toBn(t.correct)}/{toBn(t.total)} · {toBn(t.pct)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {recentSessions.length > 0 && (
            <>
              <h2 className="section-title">সাম্প্রতিক সেশন</h2>
              <div className="chart-card">
                <table className="admin-table">
                  <thead><tr><th>তারিখ</th><th>মোড</th><th>বিষয়/টপিক</th><th>স্কোর/সময়</th></tr></thead>
                  <tbody>
                    {recentSessions.map((s) => (
                      <tr key={s.id}>
                        <td>{s.date}</td>
                        <td>{s.mode}</td>
                        <td>{s.label}</td>
                        <td>{s.isPractice ? `${toBn(s.minutes)} মিনিট` : `${toBn(s.correct)}/${toBn(s.total)} (${toBn(s.pct)}%)`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <button className="cta-primary" style={{ marginTop: 4 }} onClick={() => setView("practice")}>
            নতুন প্র্যাকটিস শুরু করুন →
          </button>
        </>
      )}
    </section>
  );
}
