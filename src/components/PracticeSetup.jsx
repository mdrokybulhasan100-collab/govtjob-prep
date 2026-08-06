import { useState } from "react";
import { useApp } from "../lib/AppContext";

export default function PracticeSetup() {
  const { subjects, topics, startQuiz: onStart } = useApp();
  const [mode, setMode] = useState("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);

  const topicsForSelected = topics.filter((t) => t.subject_id === selectedSubjectId);

  return (
    <section className="view">
      <h2 className="section-title">প্র্যাকটিস মোড বেছে নিন</h2>

      <div className="mode-tabs">
        <button className={`mode-tab ${mode === "all" ? "active" : ""}`} onClick={() => setMode("all")}>
          সব বিষয় একসাথে
        </button>
        <button className={`mode-tab ${mode === "subject" ? "active" : ""}`} onClick={() => setMode("subject")}>
          নির্দিষ্ট বিষয়
        </button>
        <button className={`mode-tab ${mode === "topic" ? "active" : ""}`} onClick={() => setMode("topic")}>
          নির্দিষ্ট টপিক
        </button>
      </div>

      {mode === "all" && (
        <div>
          <p className="mode-desc">সবগুলো বিষয় থেকে ২০টি প্রশ্ন এলোমেলোভাবে আসবে — প্রকৃত পরীক্ষার আবহ পেতে এই মোড ব্যবহার করুন।</p>
          <button className="cta-primary" onClick={() => onStart({ mode: "all" })}>শুরু করুন</button>
        </div>
      )}

      {mode === "subject" && (
        <div>
          <p className="mode-desc">একটি বিষয় বেছে নিন — সেই বিষয়ের সবকটি টপিক মিলিয়ে প্রশ্ন আসবে।</p>
          <div className="pick-list">
            {subjects.map((sub) => (
              <button
                key={sub.id}
                className="pick-item"
                onClick={() => onStart({ mode: "subject", subjectId: sub.id })}
              >
                {sub.icon} {sub.name_bn}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "topic" && (
        <div>
          <p className="mode-desc">প্রথমে বিষয়, তারপর টপিক বেছে নিন।</p>
          <div className="pick-list">
            {subjects.map((sub) => (
              <button
                key={sub.id}
                className={`pick-item ${selectedSubjectId === sub.id ? "selected" : ""}`}
                onClick={() => setSelectedSubjectId(sub.id)}
              >
                {sub.icon} {sub.name_bn}
              </button>
            ))}
          </div>
          {selectedSubjectId && (
            <div className="pick-list" style={{ marginTop: 14 }}>
              {topicsForSelected.length === 0 && (
                <p className="mode-desc">এই বিষয়ে এখনো কোনো টপিক যোগ করা হয়নি।</p>
              )}
              {topicsForSelected.map((top) => (
                <button
                  key={top.id}
                  className="pick-item"
                  onClick={() => onStart({ mode: "topic", subjectId: selectedSubjectId, topicId: top.id })}
                >
                  {top.name_bn}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
