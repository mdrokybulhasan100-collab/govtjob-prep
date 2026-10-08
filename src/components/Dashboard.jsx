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
    <section className="view dashboard-view">
      <div className="dashboard-welcome">
        <div className="welcome-copy">
          <span className="eyebrow">🎯 আপনার প্রস্তুতির কেন্দ্র</span>
          <h1>আজও একটু এগিয়ে যান{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}!</h1>
          <p>নিয়মিত অনুশীলন, নিজের দুর্বল বিষয় চিহ্নিত করা এবং প্রতিদিনের অগ্রগতি ধরে রাখাই সাফল্যের চাবিকাঠি।</p>
          <div className="welcome-actions">
            <button className="cta-primary dashboard-primary" onClick={() => setView("practice")}>প্র্যাকটিস শুরু করুন <span>→</span></button>
            <button className="dashboard-secondary" onClick={() => setView("quizbuilder")}>কুইজ তৈরি করুন</button>
          </div>
        </div>
        <div className="welcome-progress">
          <div className="progress-ring-large">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="50" className="ring-track" />
              <circle cx="60" cy="60" r="50" className="ring-fill" style={{ strokeDashoffset: 314 - (314 * Math.min(xpPct, 100)) / 100 }} />
            </svg>
            <div><strong>{toBn(xpPct)}%</strong><span>লেভেল প্রগ্রেস</span></div>
          </div>
          <div className="welcome-level">
            <span>⭐ বর্তমান লেভেল</span>
            <strong>{toBn(level)}</strong>
            <small>{toBn(stats.xp)} XP অর্জিত</small>
          </div>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat stat-blue"><span className="stat-icon">📝</span><div><strong>{toBn(stats.totalQ)}</strong><span>মোট প্রশ্ন</span></div></div>
        <div className="dashboard-stat stat-green"><span className="stat-icon">✓</span><div><strong>{toBn(stats.accuracy)}%</strong><span>নির্ভুলতা</span></div></div>
        <div className="dashboard-stat stat-orange"><span className="stat-icon">🔥</span><div><strong>{toBn(stats.streak)}</strong><span>দিনের স্ট্রিক</span></div></div>
        <div className="dashboard-stat stat-purple"><span className="stat-icon">⏱</span><div><strong>{toBn(Math.floor(studyMinutes / 60))}<small>ঘ</small> {toBn(studyMinutes % 60)}<small>মি</small></strong><span>মোট পড়ার সময়</span></div></div>
      </div>

      <div className="dashboard-quick-grid">
        <button className="quick-action" onClick={() => setView("practice")}><span className="quick-icon">📚</span><span><strong>প্র্যাকটিস</strong><small>বিষয় বা টপিক বেছে অনুশীলন</small></span><b>→</b></button>
        <button className="quick-action" onClick={() => setView("quizbuilder")}><span className="quick-icon">🎛️</span><span><strong>কুইজ বিল্ডার</strong><small>নিজের মতো প্রশ্ন সেট করুন</small></span><b>→</b></button>
        <button className="quick-action" onClick={() => setView("favorites")}><span className="quick-icon">🔖</span><span><strong>রিভিশন লিস্ট</strong><small>{toBn(quickCounts.favorites)}টি প্রশ্ন অপেক্ষায়</small></span><b>→</b></button>
        <button className="quick-action" onClick={() => setView("exams")}><span className="quick-icon">📁</span><span><strong>পরীক্ষা আর্কাইভ</strong><small>আগের পরীক্ষাগুলো আবার দিন</small></span><b>→</b></button>
      </div>

      <div className="dashboard-section-head">
        <div><span className="eyebrow">LIVE & UPDATE</span><h2>আজকের আপডেট</h2></div>
        <span className="section-note">আপনার প্রস্তুতির গুরুত্বপূর্ণ তথ্য</span>
      </div>
      <div className="widget-row dashboard-widgets">
        <LiveExamWidget />
        <DailyFactWidget />
        <AnnouncementsWidget />
      </div>

      {loading ? (
        <div className="dashboard-empty"><div className="loading-dot">●</div><p>আপনার অগ্রগতির তথ্য লোড হচ্ছে...</p></div>
      ) : stats.totalQ === 0 ? (
        <div className="dashboard-empty dashboard-empty-cta">
          <span>🚀</span><h2>আপনার প্রস্তুতি শুরু করার সময় এখনই</h2><p>প্রথম কুইজ শেষ করলেই এখানে আপনার পারফরম্যান্স, গ্রাফ এবং দুর্বল বিষয়গুলো দেখা যাবে।</p>
          <button className="cta-primary" onClick={() => setView("practice")}>প্রথম প্র্যাকটিস শুরু করুন →</button>
        </div>
      ) : (
        <>
          <div className="dashboard-section-head analytics-head">
            <div><span className="eyebrow">YOUR ANALYTICS</span><h2>আপনার অগ্রগতি</h2></div>
            <span className="section-note">শেষ ১৪ দিনের পারফরম্যান্স</span>
          </div>

          <div className="chart-card analytics-main-card">
            <div className="card-heading-row"><div><h3>প্রশ্ন সমাধানের ধারাবাহিকতা</h3><p>প্রতিদিন কতগুলো প্রশ্ন সমাধান করেছেন</p></div><span className="mini-badge">১৪ দিন</span></div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendData}>
                <defs><linearGradient id="qFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} /><stop offset="95%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5F3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6B667F" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#6B667F" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E7E5F3", fontSize: 13 }} />
                <Area type="monotone" dataKey="প্রশ্ন" stroke="#4F46E5" strokeWidth={3} fill="url(#qFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-grid dashboard-chart-grid">
            <div className="chart-card"><div className="card-heading-row"><div><h3>বিষয়ভিত্তিক ফলাফল</h3><p>কোথায় ভালো করছেন, কোথায় আরও অনুশীলন দরকার</p></div></div>
              {subjectData.length === 0 ? <p className="mode-desc">এখনো কোনো বিষয়ভিত্তিক ডেটা নেই।</p> : <ResponsiveContainer width="100%" height={280}><BarChart data={subjectData} layout="vertical" margin={{ left: 10, right: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7E5F3" horizontal={false} /><XAxis type="number" tick={{ fontSize: 12, fill: "#6B667F" }} axisLine={false} tickLine={false} allowDecimals={false} /><YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 12, fill: "#1E1B3A" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E7E5F3", fontSize: 13 }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="সঠিক" stackId="a" fill={COLORS.correct} radius={[4, 0, 0, 4]} /><Bar dataKey="ভুল" stackId="a" fill={COLORS.wrong} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>}
            </div>
            <div className="chart-card"><div className="card-heading-row"><div><h3>সামগ্রিক ফলাফল</h3><p>সঠিক ও ভুল উত্তরের অনুপাত</p></div></div><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={4}><Cell fill={COLORS.correct} /><Cell fill={COLORS.wrong} /></Pie><Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E7E5F3", fontSize: 13 }} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer></div>
          </div>

          <div className="dashboard-insight-grid">
            {weekCompare && <div className="chart-card insight-card"><span className="insight-icon">📈</span><div><h3>এই সপ্তাহ বনাম গত সপ্তাহ</h3><div className="insight-values"><div><small>প্রশ্ন</small><strong>{toBn(weekCompare.thisWeekQ)}</strong><em className={weekCompare.thisWeekQ >= weekCompare.lastWeekQ ? "up" : "down"}>{weekCompare.thisWeekQ >= weekCompare.lastWeekQ ? "▲" : "▼"} {toBn(weekCompare.lastWeekQ)}</em></div><div><small>নির্ভুলতা</small><strong>{toBn(weekCompare.thisAcc)}%</strong><em className={weekCompare.thisAcc >= weekCompare.lastAcc ? "up" : "down"}>{weekCompare.thisAcc >= weekCompare.lastAcc ? "▲" : "▼"} {toBn(weekCompare.lastAcc)}%</em></div></div></div></div>}
            {typeBreakdown && (typeBreakdown.mcq.total > 0 || typeBreakdown.short.total > 0) && <div className="chart-card insight-card"><span className="insight-icon">🎯</span><div><h3>প্রশ্নের ধরন অনুযায়ী</h3><div className="insight-values"><div><small>MCQ</small><strong>{typeBreakdown.mcq.total ? toBn(Math.round((typeBreakdown.mcq.correct / typeBreakdown.mcq.total) * 100)) : toBn(0)}%</strong><em>{toBn(typeBreakdown.mcq.correct)}/{toBn(typeBreakdown.mcq.total)}</em></div><div><small>Short</small><strong>{typeBreakdown.short.total ? toBn(Math.round((typeBreakdown.short.correct / typeBreakdown.short.total) * 100)) : toBn(0)}%</strong><em>{toBn(typeBreakdown.short.correct)}/{toBn(typeBreakdown.short.total)}</em></div></div></div></div>}
          </div>

          {(bestSubject || worstSubject) && <div className="dashboard-highlight-grid">{bestSubject && <div className="highlight-card highlight-good"><span className="highlight-label">💪 সবচেয়ে ভালো</span><span className="highlight-name">{bestSubject.name}</span><span className="highlight-pct">{toBn(Math.round(bestSubject.acc * 100))}% নির্ভুলতা</span></div>}{worstSubject && <div className="highlight-card highlight-bad"><span className="highlight-label">📌 আরও অনুশীলন দরকার</span><span className="highlight-name">{worstSubject.name}</span><span className="highlight-pct">{toBn(Math.round(worstSubject.acc * 100))}% নির্ভুলতা</span></div>}</div>}

          {topicProgress.length > 0 && <><div className="dashboard-section-head compact"><div><span className="eyebrow">TOPIC PROGRESS</span><h2>টপিকভিত্তিক প্রোগ্রেস</h2></div></div><div className="chart-card"><div className="topic-progress-list">{topicProgress.map((t, i) => <div className="topic-progress-row" key={i}><span className="tp-name">{t.name}</span><div className="sc-bar-track"><div className="sc-bar-fill" style={{ width: `${t.pct}%` }} /></div><span className="tp-pct">{toBn(t.correct)}/{toBn(t.total)} · {toBn(t.pct)}%</span></div>)}</div></div></>}

          {recentSessions.length > 0 && <><div className="dashboard-section-head compact"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>সাম্প্রতিক সেশন</h2></div></div><div className="chart-card recent-card"><table className="admin-table"><thead><tr><th>তারিখ</th><th>মোড</th><th>বিষয়/টপিক</th><th>স্কোর/সময়</th></tr></thead><tbody>{recentSessions.map((s) => <tr key={s.id}><td>{s.date}</td><td>{s.mode}</td><td>{s.label}</td><td>{s.isPractice ? `${toBn(s.minutes)} মিনিট` : `${toBn(s.correct)}/${toBn(s.total)} (${toBn(s.pct)}%)`}</td></tr>)}</tbody></table></div></>}
        </>
      )}
    </section>
  );
}
