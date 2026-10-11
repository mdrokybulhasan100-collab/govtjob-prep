import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const emptyStats = { subjects: 0, topics: 0, exams: 0, questions: 0, users: 0, published: 0 };
const cards = [
  { key: "questions", label: "মোট প্রশ্ন", icon: "▤", tone: "violet", route: "/admin/questions-view" },
  { key: "published", label: "প্রকাশিত প্রশ্ন", icon: "✓", tone: "green", route: "/admin/questions-view" },
  { key: "users", label: "নিবন্ধিত ব্যবহারকারী", icon: "♙", tone: "blue", route: "/admin/users" },
  { key: "exams", label: "প্রশ্নপত্র", icon: "▣", tone: "orange", route: "/admin/exams" }
];

export default function DashboardTab({ subjects = [], topics = [], exams = [] }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(emptyStats);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const count = async (table, filters) => {
        let query = supabase.from(table).select("*", { count: "exact", head: true });
        if (filters) query = filters(query);
        const result = await query;
        return result.error ? null : (result.count ?? 0);
      };
      const [questionCount, userCount, publishedCount, latest] = await Promise.all([
        count("questions"),
        count("profiles"),
        count("questions", q => q.eq("is_published", true)),
        supabase.from("questions").select("id, question_text, created_at").order("created_at", { ascending: false }).limit(5)
      ]);
      if (!alive) return;
      setStats({
        subjects: subjects.length,
        topics: topics.length,
        exams: exams.length,
        questions: questionCount ?? 0,
        users: userCount ?? 0,
        published: publishedCount ?? 0
      });
      setRecent(latest.error ? [] : (latest.data || []));
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [subjects.length, topics.length, exams.length]);

  return (
    <div className="ed-dashboard">
      <div className="ed-welcome">
        <div><span className="ed-welcome-kicker">OVERVIEW</span><h3>স্বাগতম, Admin 👋</h3><p>আপনার সরকারি চাকরি প্রস্তুতি প্ল্যাটফর্মের সার্বিক অবস্থা এক নজরে দেখুন।</p></div>
        <button onClick={() => navigate("/admin/questions-add")}>＋ নতুন প্রশ্ন যোগ</button>
      </div>

      <div className="ed-stat-grid">
        {cards.map(card => (
          <button key={card.key} className={`ed-stat-card ${card.tone}`} onClick={() => navigate(card.route)}>
            <span className="ed-stat-top"><span>{card.label}</span><i>{card.icon}</i></span>
            <strong>{loading ? "—" : stats[card.key].toLocaleString("bn-BD")}</strong>
            <small><span className="ed-stat-dot" /> লাইভ ডেটাবেস সারাংশ</small>
          </button>
        ))}
      </div>

      <div className="ed-overview-grid">
        <section className="ed-dash-card ed-content-summary">
          <div className="ed-card-heading"><div><h4>কনটেন্ট লাইব্রেরি</h4><p>আপনার প্রস্তুতি কনটেন্টের সারাংশ</p></div><span className="ed-card-icon">▤</span></div>
          {[
            ["বিষয়", stats.subjects, "#7167ef"],
            ["টপিক", stats.topics, "#43a8df"],
            ["প্রশ্নপত্র", stats.exams, "#f4a261"],
            ["প্রশ্ন", stats.questions, "#43b995"]
          ].map(([label, value, color]) => (
            <div className="ed-progress-row" key={label}><div><span>{label}</span><strong>{loading ? "—" : Number(value).toLocaleString("bn-BD")}</strong></div><div className="ed-progress-track"><span style={{ width: `${Math.max(8, Math.min(100, Number(value) * 5))}%`, background: color }} /></div></div>
          ))}
        </section>

        <section className="ed-dash-card ed-publish-card">
          <div className="ed-card-heading"><div><h4>প্রশ্ন প্রকাশের অবস্থা</h4><p>Published ও মোট প্রশ্নের তুলনা</p></div><span className="ed-card-icon green">✓</span></div>
          <div className="ed-publish-visual"><div className="ed-publish-ring" style={{ "--published-angle": `${stats.questions ? stats.published / stats.questions * 360 : 0}deg` }}><div><strong>{loading ? "—" : (stats.questions ? Math.round(stats.published / stats.questions * 100) : 0) + "%"}</strong><small>প্রকাশিত</small></div></div></div>
          <div className="ed-publish-legend"><span><i className="published-dot" /> প্রকাশিত: {loading ? "—" : stats.published.toLocaleString("bn-BD")}</span><span><i className="draft-dot" /> মোট: {loading ? "—" : stats.questions.toLocaleString("bn-BD")}</span></div>
        </section>
      </div>

      <div className="ed-overview-grid lower">
        <section className="ed-dash-card">
          <div className="ed-card-heading"><div><h4>সাম্প্রতিক প্রশ্ন</h4><p>সর্বশেষ যোগ করা কনটেন্ট</p></div><button className="ed-text-link" onClick={() => navigate("/admin/questions-view")}>সব দেখুন →</button></div>
          {recent.length ? <div className="ed-recent-list">{recent.map((q, i) => <div className="ed-recent-item" key={q.id || i}><span className="ed-recent-index">{String(i + 1).padStart(2, "0")}</span><span className="ed-recent-question">{q.question_text || "প্রশ্নের টেক্সট নেই"}</span><span className="ed-recent-status">সংরক্ষিত</span></div>)}</div> : <div className="ed-empty-recent">{loading ? "ডেটা লোড হচ্ছে…" : "সাম্প্রতিক প্রশ্ন দেখানো যাচ্ছে না।"}</div>}
        </section>
        <section className="ed-dash-card ed-quick-actions">
          <div className="ed-card-heading"><div><h4>দ্রুত কাজ</h4><p>প্রতিদিনের ব্যবস্থাপনা</p></div></div>
          {[
            ["＋", "প্রশ্ন যোগ করুন", "নতুন MCQ বা Short প্রশ্ন তৈরি করুন", "/admin/questions-add"],
            ["☷", "প্রশ্ন পরিচালনা", "প্রশ্ন edit, publish বা unpublish করুন", "/admin/questions-view"],
            ["♙", "ইউজার ম্যানেজমেন্ট", "ব্যবহারকারীর অ্যাকাউন্ট পরিচালনা", "/admin/users"],
            ["⚙", "প্রোফাইল সেটিংস", "নিজের অ্যাকাউন্ট আপডেট করুন", "/admin/profile"]
          ].map(([icon, title, desc, route]) => <button key={route} className="ed-quick-action" onClick={() => navigate(route)}><span>{icon}</span><div><strong>{title}</strong><small>{desc}</small></div><b>›</b></button>)}
        </section>
      </div>
    </div>
  );
}
