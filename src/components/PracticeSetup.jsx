import { useState } from "react";
import { useApp } from "../lib/AppContext";

const MAIN_MODES = [
  { key: "all", icon: "⚡", label: "সব বিষয়" },
  { key: "subject", icon: "📚", label: "বিষয়ভিত্তিক" },
  { key: "examarchive", icon: "📁", label: "পূর্ববর্তী পরীক্ষা" },
  { key: "known", icon: "✓", label: "জানতাম" },
  { key: "unknown", icon: "✕", label: "জানতাম না" },
  { key: "customize", icon: "⚙", label: "কাস্টমাইজ" }
];

export default function PracticeSetup() {
  const { subjects, topics, exams, startPractice } = useApp();
  const [mainMode, setMainMode] = useState("all");
  const [displayMode, setDisplayMode] = useState("flashcard");
  const [flashcardQuestionType, setFlashcardQuestionType] = useState("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [custSubjectIds, setCustSubjectIds] = useState([]);
  const [custTopicIds, setCustTopicIds] = useState([]);
  const [custCount, setCustCount] = useState(20);
  const [custMinutes, setCustMinutes] = useState(0);
  const topicsForSelected = topics.filter((t) => t.subject_id === selectedSubjectId);
  const custTopicOptions = topics.filter((t) => custSubjectIds.includes(t.subject_id));
  function toggleCustSubject(id) { setCustSubjectIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }
  function toggleCustTopic(id) { setCustTopicIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }
  function go(params) { startPractice({ ...params, displayMode, flashcardQuestionType }); }

  return (
    <section className="view practice-page">
      <div className="page-hero practice-hero">
        <div><span className="eyebrow">PRACTICE CENTER</span><h1>আজ কী শিখবেন?</h1><p>নিজের গতি অনুযায়ী প্রশ্ন অনুশীলন করুন, ভুলগুলো আবার দেখুন এবং প্রতিদিনের প্রস্তুতি ধরে রাখুন।</p></div>
        <div className="hero-icon">⚡</div>
      </div>

      <div className="practice-toolbar">
        <div><span className="field-kicker">প্রশ্ন দেখানোর ধরন</span><div className="segmented-control">
          <button className={displayMode === "flashcard" ? "active" : ""} onClick={() => setDisplayMode("flashcard")}>🃏 Flashcard</button>
          <button className={displayMode === "direct" ? "active" : ""} onClick={() => setDisplayMode("direct")}>📝 Direct MCQ</button>
        </div></div>
        <span className="toolbar-note">{displayMode === "flashcard" ? "উত্তর দেখার আগে নিজে মনে করার সুযোগ পাবেন।" : "অপশন শুরু থেকেই দেখা যাবে।"}</span>
        {displayMode === "flashcard" && <div className="flashcard-type-filter">
          <span className="field-kicker">প্রশ্নের ধরন</span>
          <div className="segmented-control" role="group" aria-label="Flashcard প্রশ্নের ধরন">
            <button type="button" className={flashcardQuestionType === "all" ? "active" : ""} onClick={() => setFlashcardQuestionType("all")}>সব (MCQ + Short)</button>
            <button type="button" className={flashcardQuestionType === "mcq" ? "active" : ""} onClick={() => setFlashcardQuestionType("mcq")}>MCQ</button>
            <button type="button" className={flashcardQuestionType === "short" ? "active" : ""} onClick={() => setFlashcardQuestionType("short")}>Short</button>
          </div>
        </div>}
      </div>

      <div className="section-heading-row"><div><span className="eyebrow">STEP 01</span><h2>প্র্যাকটিসের ধরন বেছে নিন</h2></div></div>
      <div className="feature-grid practice-mode-grid">
        {MAIN_MODES.map((m) => <button key={m.key} className={`feature-choice ${mainMode === m.key ? "selected" : ""}`} onClick={() => { setMainMode(m.key); setSelectedSubjectId(null); }}><span className="choice-icon">{m.icon}</span><span><strong>{m.label}</strong><small>{m.key === "all" ? "সব বিষয় থেকে" : m.key === "subject" ? "একটি বিষয় বা টপিক" : m.key === "examarchive" ? "পুরনো প্রশ্নপত্র" : m.key === "known" ? "যেগুলো জানেন" : m.key === "unknown" ? "যেগুলো কঠিন" : "নিজের মতো সেট করুন"}</small></span><span className="choice-arrow">→</span></button>)}
      </div>

      <div className="practice-content-card">
        {mainMode === "all" && <ActionPanel icon="⚡" title="Quick Practice" text="সব বিষয় থেকে র‍্যান্ডম প্রশ্ন নিয়ে দ্রুত practice শুরু করুন।" button="শুরু করুন" onClick={() => go({ mode: "all" })} />}
        {mainMode === "known" && <ActionPanel icon="✓" title="যেগুলো জানেন" text="আগে ‘জানতাম’ হিসেবে মার্ক করা প্রশ্নগুলো ঝালিয়ে নিন।" button="Practice শুরু করুন" onClick={() => go({ mode: "known" })} />}
        {mainMode === "unknown" && <ActionPanel icon="✕" title="যেগুলো কঠিন" text="আগে ‘জানতাম না’ মার্ক করা প্রশ্নগুলো বারবার অনুশীলন করুন।" button="Revision Practice" onClick={() => go({ mode: "unknown" })} />}

        {mainMode === "subject" && (!selectedSubjectId ? <><div className="content-intro"><h3>একটি বিষয় বেছে নিন</h3><p>বিষয় নির্বাচন করলে পরের ধাপে chapter বা random practice বেছে নিতে পারবেন।</p></div><div className="subject-select-grid">{subjects.map((s) => <button key={s.id} className="subject-select-card" onClick={() => setSelectedSubjectId(s.id)}><span>{s.icon}</span><strong>{s.name_bn}</strong><small>Practice করুন →</small></button>)}</div></> : <><button className="back-link" onClick={() => setSelectedSubjectId(null)}>← বিষয় তালিকায় ফিরুন</button><div className="content-intro"><h3>{subjects.find((s) => s.id === selectedSubjectId)?.name_bn || "বিষয়"}</h3><p>সব chapter থেকে random অথবা নির্দিষ্ট topic বেছে নিন।</p></div><div className="subject-select-grid"><button className="subject-select-card featured" onClick={() => go({ mode: "subject", subjectId: selectedSubjectId })}><span>🎲</span><strong>Random Practice</strong><small>সব chapter থেকে</small></button>{topicsForSelected.map((t) => <button key={t.id} className="subject-select-card" onClick={() => go({ mode: "topic", subjectId: selectedSubjectId, topicId: t.id })}><span>📖</span><strong>{t.name_bn}</strong><small>এই topic practice করুন</small></button>)}</div></>)}

        {mainMode === "examarchive" && <><div className="content-intro"><h3>পূর্ববর্তী প্রশ্নপত্র</h3><p>যে বছরের প্রশ্ন চান সেটি নির্বাচন করুন।</p></div>{exams.length ? <div className="archive-choice-list">{exams.map((ex) => <button key={ex.id} onClick={() => go({ mode: "exam", examId: ex.id })}><span>📄</span><span><strong>{ex.name}</strong><small>প্রশ্নপত্র থেকে practice</small></span><b>→</b></button>)}</div> : <EmptyState title="এখনো কোনো প্রশ্নপত্র নেই" text="Admin Panel থেকে প্রশ্নপত্র যোগ করা হলে এখানে দেখা যাবে।" />}</>}

        {mainMode === "customize" && <div className="custom-builder"><div className="content-intro"><h3>নিজের মতো practice সেট করুন</h3><p>একাধিক বিষয় ও topic নির্বাচন করে প্রশ্নের সংখ্যা ও সময় নির্ধারণ করুন।</p></div><div className="qb-block"><label className="field-kicker">বিষয় নির্বাচন</label><div className="choice-chip-grid">{subjects.map((s) => <button key={s.id} className={custSubjectIds.includes(s.id) ? "selected" : ""} onClick={() => toggleCustSubject(s.id)}>{s.icon} {s.name_bn}</button>)}</div></div>{custSubjectIds.length > 0 && <div className="qb-block"><label className="field-kicker">Topic (ঐচ্ছিক)</label><div className="choice-chip-grid">{custTopicOptions.map((t) => <button key={t.id} className={custTopicIds.includes(t.id) ? "selected" : ""} onClick={() => toggleCustTopic(t.id)}>{t.name_bn}</button>)}</div></div>}<div className="form-grid-2"><label className="modern-field"><span>প্রশ্ন সংখ্যা</span><input type="number" min="5" max="100" value={custCount} onChange={(e) => setCustCount(Math.max(1, Number(e.target.value) || 1))}/></label><label className="modern-field"><span>সময়সীমা (মিনিট)</span><input type="number" min="0" max="180" value={custMinutes} onChange={(e) => setCustMinutes(Math.max(0, Number(e.target.value) || 0))}/></label></div><button className="cta-primary cta-large" disabled={!custSubjectIds.length} onClick={() => go({ mode: "custom", subjectIds: custSubjectIds, topicIds: custTopicIds, count: custCount, timeLimitSeconds: custMinutes * 60 })}>Custom Practice শুরু করুন →</button></div>}
      </div>
    </section>
  );
}

function ActionPanel({ icon, title, text, button, onClick }) { return <div className="action-panel"><div className="action-panel-icon">{icon}</div><div><h3>{title}</h3><p>{text}</p></div><button className="cta-primary" onClick={onClick}>{button} →</button></div>; }
function EmptyState({ title, text }) { return <div className="empty-state"><div>📭</div><h3>{title}</h3><p>{text}</p></div>; }
