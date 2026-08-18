import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { shuffle } from "../lib/utils";
import { useApp } from "../lib/AppContext";

const TYPE_OPTIONS = [
  { key: "all", label: "সব প্রশ্ন থেকে র‍্যান্ডম" },
  { key: "favorites", label: "🔖 রিভিশন লিস্টের প্রশ্ন" },
  { key: "wrong", label: "❌ ভুল করা প্রশ্ন" },
  { key: "unanswered", label: "❔ উত্তর না দেওয়া প্রশ্ন" },
  { key: "right", label: "✅ সঠিক করা প্রশ্ন" },
  { key: "examonly", label: "📁 শুধু পরীক্ষার প্রশ্ন (Exam)" }
];

export default function QuizBuilder() {
  const { user, subjects, startCustomQuiz: onStartCustomQuiz } = useApp();
  const [type, setType] = useState("all");
  const [selectedSubjects, setSelectedSubjects] = useState([]); // empty = all
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(20); // mandatory — exam-style, must be > 0
  const [loading, setLoading] = useState(false);

  function toggleSubject(id) {
    setSelectedSubjects((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function getIdFilterForType() {
    if (type === "all" || type === "examonly") return null; // no id-list restriction needed

    if (type === "favorites") {
      const { data } = await supabase.from("question_knowledge").select("question_id").eq("user_id", user.id).eq("status", "unknown");
      return (data || []).map((r) => r.question_id);
    }

    if (type === "wrong" || type === "right") {
      const { data } = await supabase
        .from("session_answers")
        .select("question_id, is_correct, practice_sessions!inner(user_id)")
        .eq("practice_sessions.user_id", user.id);
      const wantCorrect = type === "right";
      const ids = (data || []).filter((r) => r.is_correct === wantCorrect).map((r) => r.question_id);
      return [...new Set(ids)];
    }

    if (type === "unanswered") {
      const [{ data: allQ }, { data: answered }] = await Promise.all([
        supabase.from("questions").select("id").eq("question_type", "mcq"),
        supabase
          .from("session_answers")
          .select("question_id, practice_sessions!inner(user_id)")
          .eq("practice_sessions.user_id", user.id)
      ]);
      const answeredSet = new Set((answered || []).map((r) => r.question_id));
      return (allQ || []).map((q) => q.id).filter((id) => !answeredSet.has(id));
    }

    return null;
  }

  async function handleGenerate() {
    if (!minutes || minutes < 1) {
      alert("সময়সীমা আবশ্যক — কমপক্ষে ১ মিনিট দিন।");
      return;
    }
    setLoading(true);
    try {
      const idFilter = await getIdFilterForType();
      if (idFilter && idFilter.length === 0) {
        alert("এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি। অন্য অপশন চেষ্টা করুন।");
        setLoading(false);
        return;
      }

      let query = supabase.from("questions").select("*").eq("question_type", "mcq");
      if (idFilter) query = query.in("id", idFilter);
      if (selectedSubjects.length > 0) query = query.in("subject_id", selectedSubjects);
      if (type === "examonly") query = query.not("exam_id", "is", null);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        alert("এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।");
        setLoading(false);
        return;
      }

      const picked = shuffle(data).slice(0, count);
      const meta = { subjectId: selectedSubjects.length === 1 ? selectedSubjects[0] : null };
      const timeLimitSeconds = minutes * 60;

      await onStartCustomQuiz(picked, meta, timeLimitSeconds);
    } catch (err) {
      alert("একটা সমস্যা হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="view">
      <h2 className="section-title">🎛️ কুইজ বিল্ডার</h2>
      <p className="mode-desc">
        নিজের মতো করে কাস্টমাইজ করে exam-style কুইজ বানান — শুধু MCQ প্রশ্ন, সময়সীমার
        ভেতরে শেষ করতে হবে, ফলাফল শুধু সব প্রশ্ন শেষ হলে দেখা যাবে।
      </p>

      <div className="qb-block">
        <label className="qb-label">১. প্রশ্নের উৎস</label>
        <div className="mode-tabs">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`mode-tab ${type === opt.key ? "active" : ""}`}
              onClick={() => setType(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="qb-block">
        <label className="qb-label">২. বিষয় (কিছু না বেছে নিলে সব বিষয় মিলিয়ে আসবে)</label>
        <div className="pick-list">
          {subjects.map((s) => (
            <button
              key={s.id}
              className={`pick-item ${selectedSubjects.includes(s.id) ? "selected" : ""}`}
              onClick={() => toggleSubject(s.id)}
            >
              {s.icon} {s.name_bn}
            </button>
          ))}
        </div>
      </div>

      <div className="qb-block qb-row">
        <div className="form-field" style={{ maxWidth: 200 }}>
          <label>৩. প্রশ্ন সংখ্যা</label>
          <input
            type="number" min="5" max="100" value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div className="form-field" style={{ maxWidth: 220 }}>
          <label>৪. সময়সীমা (মিনিট) — বাধ্যতামূলক</label>
          <input
            type="number" min="1" max="180" value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>

      <button className="cta-primary" disabled={loading} onClick={handleGenerate} style={{ marginTop: 10 }}>
        {loading ? "তৈরি হচ্ছে..." : "কুইজ শুরু করুন →"}
      </button>
    </section>
  );
}
