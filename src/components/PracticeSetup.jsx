import { useState } from "react";
import { useApp } from "../lib/AppContext";

const MAIN_MODES = [
  { key: "all", label: "সব বিষয় একসাথে" },
  { key: "subject", label: "নির্দিষ্ট বিষয়" },
  { key: "examarchive", label: "পূর্ববর্তী বছরের পরীক্ষা" },
  { key: "known", label: "✅ শুধু \"জানতাম\" প্রশ্ন" },
  { key: "unknown", label: "❌ শুধু \"জানতাম না\" প্রশ্ন" },
  { key: "customize", label: "🎛️ কাস্টমাইজ" }
];

export default function PracticeSetup() {
  const { subjects, topics, exams, startPractice } = useApp();
  const [mainMode, setMainMode] = useState("all");
  const [displayMode, setDisplayMode] = useState("flashcard"); // flashcard | direct
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);

  // customize state
  const [custSubjectIds, setCustSubjectIds] = useState([]);
  const [custTopicIds, setCustTopicIds] = useState([]);
  const [custCount, setCustCount] = useState(20);
  const [custMinutes, setCustMinutes] = useState(0);

  const topicsForSelected = topics.filter((t) => t.subject_id === selectedSubjectId);
  const custTopicOptions = topics.filter((t) => custSubjectIds.includes(t.subject_id));

  function toggleCustSubject(id) {
    setCustSubjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleCustTopic(id) {
    setCustTopicIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function go(params) {
    startPractice({ ...params, displayMode });
  }

  return (
    <section className="view">
      <h2 className="section-title">প্র্যাকটিস মোড বেছে নিন</h2>

      <div className="display-mode-toggle">
        <span className="qb-label" style={{ marginBottom: 0 }}>দেখানোর ধরন:</span>
        <button className={`mode-tab ${displayMode === "flashcard" ? "active" : ""}`} onClick={() => setDisplayMode("flashcard")}>
          🃏 Flashcard
        </button>
        <button className={`mode-tab ${displayMode === "direct" ? "active" : ""}`} onClick={() => setDisplayMode("direct")}>
          📝 Direct MCQ
        </button>
      </div>
      <p className="mode-desc">
        {displayMode === "flashcard"
          ? "Flashcard মোডে অপশন প্রথমে লুকানো থাকবে, চাপলে দেখা যাবে।"
          : "Direct MCQ মোডে অপশন শুরু থেকেই দেখা যাবে।"}
      </p>

      <div className="mode-tabs" style={{ marginTop: 18 }}>
        {MAIN_MODES.map((m) => (
          <button
            key={m.key}
            className={`mode-tab ${mainMode === m.key ? "active" : ""}`}
            onClick={() => { setMainMode(m.key); setSelectedSubjectId(null); }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mainMode === "all" && (
        <div>
          <p className="mode-desc">সবগুলো বিষয় থেকে প্রশ্ন মিলিয়ে আসবে — যতক্ষণ ইচ্ছা প্র্যাকটিস করুন, Finish চাপলেই শেষ।</p>
          <button className="cta-primary" onClick={() => go({ mode: "all" })}>শুরু করুন</button>
        </div>
      )}

      {mainMode === "subject" && (
        <div>
          {!selectedSubjectId ? (
            <>
              <p className="mode-desc">একটা বিষয় বেছে নিন।</p>
              <div className="pick-list">
                {subjects.map((s) => (
                  <button key={s.id} className="pick-item" onClick={() => setSelectedSubjectId(s.id)}>
                    {s.icon} {s.name_bn}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button className="cta-ghost" onClick={() => setSelectedSubjectId(null)} style={{ marginBottom: 14 }}>← বিষয় তালিকায় ফিরুন</button>
              <p className="mode-desc">একটা নির্দিষ্ট চ্যাপ্টার বেছে নিন, অথবা এই বিষয়ের সবকিছু মিলিয়ে Random প্র্যাকটিস করুন।</p>
              <div className="pick-list">
                <button className="pick-item" onClick={() => go({ mode: "subject", subjectId: selectedSubjectId })}>
                  🎲 Random (সব চ্যাপ্টার)
                </button>
                {topicsForSelected.map((t) => (
                  <button key={t.id} className="pick-item" onClick={() => go({ mode: "topic", subjectId: selectedSubjectId, topicId: t.id })}>
                    {t.name_bn}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {mainMode === "examarchive" && (
        <div>
          <p className="mode-desc">একটা পূর্ববর্তী বছরের পরীক্ষা বেছে নিন।</p>
          {exams.length === 0 ? (
            <p className="mode-desc">এখনো কোনো প্রশ্নপত্র যোগ করা হয়নি।</p>
          ) : (
            <div className="pick-list">
              {exams.map((ex) => (
                <button key={ex.id} className="pick-item" onClick={() => go({ mode: "exam", examId: ex.id })}>
                  {ex.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mainMode === "known" && (
        <div>
          <p className="mode-desc">আগে "জানতাম" হিসেবে মার্ক করা প্রশ্নগুলো ঝালিয়ে নিন।</p>
          <button className="cta-primary" onClick={() => go({ mode: "known" })}>শুরু করুন</button>
        </div>
      )}

      {mainMode === "unknown" && (
        <div>
          <p className="mode-desc">যেসব প্রশ্ন আগে "জানতাম না" মার্ক করেছেন, সেগুলো বারবার প্র্যাকটিস করুন।</p>
          <button className="cta-primary" onClick={() => go({ mode: "unknown" })}>শুরু করুন</button>
        </div>
      )}

      {mainMode === "customize" && (
        <div>
          <div className="qb-block">
            <label className="qb-label">বিষয় বেছে নিন (একাধিক)</label>
            <div className="pick-list">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  className={`pick-item ${custSubjectIds.includes(s.id) ? "selected" : ""}`}
                  onClick={() => toggleCustSubject(s.id)}
                >
                  {s.icon} {s.name_bn}
                </button>
              ))}
            </div>
          </div>

          {custSubjectIds.length > 0 && (
            <div className="qb-block">
              <label className="qb-label">নির্দিষ্ট চ্যাপ্টার (ঐচ্ছিক — কিছু না বেছে নিলে বেছে নেওয়া বিষয়গুলো থেকে Random আসবে)</label>
              <div className="pick-list">
                {custTopicOptions.map((t) => (
                  <button
                    key={t.id}
                    className={`pick-item ${custTopicIds.includes(t.id) ? "selected" : ""}`}
                    onClick={() => toggleCustTopic(t.id)}
                  >
                    {t.name_bn}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="qb-block qb-row">
            <div className="form-field" style={{ maxWidth: 200 }}>
              <label>প্রশ্ন সংখ্যা</label>
              <input type="number" min="5" max="100" value={custCount} onChange={(e) => setCustCount(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div className="form-field" style={{ maxWidth: 220 }}>
              <label>সময়সীমা (মিনিট, ০ = নেই)</label>
              <input type="number" min="0" max="180" value={custMinutes} onChange={(e) => setCustMinutes(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </div>

          <button
            className="cta-primary"
            disabled={custSubjectIds.length === 0}
            onClick={() => go({
              mode: "custom",
              subjectIds: custSubjectIds,
              topicIds: custTopicIds,
              count: custCount,
              timeLimitSeconds: custMinutes > 0 ? custMinutes * 60 : null
            })}
          >
            শুরু করুন
          </button>
        </div>
      )}
    </section>
  );
}
