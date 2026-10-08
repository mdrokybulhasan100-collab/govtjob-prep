import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { shuffle } from "../lib/utils";
import { useApp } from "../lib/AppContext";

const TYPE_OPTIONS = [
  { key: "all", icon: "✦", label: "সব প্রশ্ন" },
  { key: "favorites", icon: "★", label: "রিভিশন লিস্ট" },
  { key: "wrong", icon: "✕", label: "ভুল করা" },
  { key: "unanswered", icon: "?", label: "উত্তর দিইনি" },
  { key: "right", icon: "✓", label: "সঠিক করা" },
  { key: "examonly", icon: "📁", label: "পরীক্ষার প্রশ্ন" }
];

export default function QuizBuilder() {
  const { user, subjects, startCustomQuiz: onStartCustomQuiz } = useApp();
  const [type, setType] = useState("all");
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(20);
  const [loading, setLoading] = useState(false);
  function toggleSubject(id) { setSelectedSubjects((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }
  async function getIdFilterForType() {
    if (type === "all" || type === "examonly") return null;
    if (type === "favorites") { const { data } = await supabase.from("question_knowledge").select("question_id").eq("user_id", user.id).eq("status", "unknown"); return (data || []).map((r) => r.question_id); }
    if (type === "wrong" || type === "right") { const { data } = await supabase.from("session_answers").select("question_id, is_correct, practice_sessions!inner(user_id)").eq("practice_sessions.user_id", user.id); return [...new Set((data || []).filter((r) => r.is_correct === (type === "right")).map((r) => r.question_id))]; }
    if (type === "unanswered") { const [{ data: allQ }, { data: answered }] = await Promise.all([supabase.from("questions").select("id").eq("question_type", "mcq"), supabase.from("session_answers").select("question_id, practice_sessions!inner(user_id)").eq("practice_sessions.user_id", user.id)]); const set = new Set((answered || []).map((r) => r.question_id)); return (allQ || []).map((q) => q.id).filter((id) => !set.has(id)); }
    return null;
  }
  async function handleGenerate() {
    if (!minutes || minutes < 1) { alert("সময়সীমা আবশ্যক — কমপক্ষে ১ মিনিট দিন।"); return; }
    setLoading(true);
    try { const idFilter = await getIdFilterForType(); if (idFilter && !idFilter.length) { alert("এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি।"); return; } let query = supabase.from("questions").select("*").eq("question_type", "mcq"); if (idFilter) query = query.in("id", idFilter); if (selectedSubjects.length) query = query.in("subject_id", selectedSubjects); if (type === "examonly") query = query.not("exam_id", "is", null); const { data, error } = await query; if (error) throw error; if (!data?.length) { alert("এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি।"); return; } await onStartCustomQuiz(shuffle(data).slice(0, count), { subjectId: selectedSubjects.length === 1 ? selectedSubjects[0] : null }, minutes * 60); } catch (err) { alert("একটা সমস্যা হয়েছে: " + err.message); } finally { setLoading(false); }
  }
  return <section className="view builder-page">
    <div className="page-hero builder-hero"><div><span className="eyebrow">QUIZ BUILDER</span><h1>নিজের মতো Quiz বানান</h1><p>প্রশ্নের উৎস, বিষয়, প্রশ্ন সংখ্যা এবং সময়—সবকিছু আপনার নিয়ন্ত্রণে।</p></div><div className="hero-icon">🎯</div></div>
    <div className="builder-steps"><span className="step active"><b>01</b> প্রশ্নের উৎস</span><span className="step"><b>02</b> বিষয়</span><span className="step"><b>03</b> সময়</span><span className="step"><b>04</b> শুরু</span></div>
    <div className="builder-card"><div className="section-heading-row"><div><span className="eyebrow">STEP 01</span><h2>কোন প্রশ্ন দিয়ে Quiz করবেন?</h2></div><span className="selection-count">{type === "all" ? "সব প্রশ্ন" : TYPE_OPTIONS.find(x => x.key === type)?.label}</span></div><div className="builder-filter-grid">{TYPE_OPTIONS.map((opt) => <button key={opt.key} className={`builder-filter ${type === opt.key ? "selected" : ""}`} onClick={() => setType(opt.key)}><span>{opt.icon}</span><strong>{opt.label}</strong><small>{opt.key === "all" ? "সব প্রশ্ন থেকে" : opt.key === "favorites" ? "আপনার revision list" : opt.key === "wrong" ? "যেগুলো ভুল হয়েছে" : opt.key === "unanswered" ? "এখনও চেষ্টা করেননি" : opt.key === "right" ? "সঠিক করা প্রশ্ন" : "শুধু exam প্রশ্ন"}</small></button>)}</div></div>
    <div className="builder-card"><div className="section-heading-row"><div><span className="eyebrow">STEP 02</span><h2>কোন বিষয় থেকে?</h2></div><span className="selection-count">{selectedSubjects.length ? `${selectedSubjects.length}টি নির্বাচিত` : "সব বিষয়"}</span></div><div className="subject-select-grid compact">{subjects.map((s) => <button key={s.id} className={`subject-select-card ${selectedSubjects.includes(s.id) ? "selected" : ""}`} onClick={() => toggleSubject(s.id)}><span>{s.icon}</span><strong>{s.name_bn}</strong><small>{selectedSubjects.includes(s.id) ? "✓ নির্বাচিত" : "নির্বাচন করুন"}</small></button>)}</div></div>
    <div className="builder-card"><div className="section-heading-row"><div><span className="eyebrow">STEP 03</span><h2>Quiz-এর সেটিংস</h2></div></div><div className="form-grid-2"><label className="modern-field"><span>প্রশ্ন সংখ্যা</span><input type="number" min="5" max="100" value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}/><small>সর্বোচ্চ ১০০টি</small></label><label className="modern-field"><span>সময়সীমা (মিনিট)</span><input type="number" min="1" max="180" value={minutes} onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}/><small>প্রতি প্রশ্নে গড়ে {Math.max(1, Math.round((minutes * 60) / count))} সেকেন্ড</small></label></div><div className="builder-summary"><span>আপনার Quiz</span><strong>{count} প্রশ্ন</strong><span>•</span><strong>{minutes} মিনিট</strong><button className="cta-primary cta-large" disabled={loading} onClick={handleGenerate}>{loading ? "তৈরি হচ্ছে..." : "Quiz শুরু করুন →"}</button></div></div>
  </section>;
}
