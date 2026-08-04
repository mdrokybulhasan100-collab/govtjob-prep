import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";

const OPTION_KEYS = ["a", "b", "c", "d"];

function normalize(str) {
  return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default function Quiz({ sessionId, questions, onFinish }) {
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState(null); // mcq: option key
  const [shortInput, setShortInput] = useState("");
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [saving, setSaving] = useState(false);

  const q = questions[index];
  const isLast = index === questions.length - 1;
  const isShort = q.question_type === "short";

  async function selectMcqAnswer(key) {
    if (answered) return;
    setPicked(key);
    setAnswered(true);
    setSaving(true);

    const isCorrect = key === q.correct_option;
    setWasCorrect(isCorrect);
    if (isCorrect) setCorrectCount((c) => c + 1);

    await supabase.from("session_answers").insert({
      session_id: sessionId,
      question_id: q.id,
      selected_option: key,
      is_correct: isCorrect
    });
    setSaving(false);
  }

  async function submitShortAnswer() {
    if (answered || !shortInput.trim()) return;
    setAnswered(true);
    setSaving(true);

    const isCorrect = normalize(shortInput) === normalize(q.short_answer);
    setWasCorrect(isCorrect);
    if (isCorrect) setCorrectCount((c) => c + 1);

    await supabase.from("session_answers").insert({
      session_id: sessionId,
      question_id: q.id,
      selected_option: null,
      is_correct: isCorrect
    });
    setSaving(false);
  }

  async function handleNext() {
    if (!isLast) {
      setIndex((i) => i + 1);
      setPicked(null);
      setShortInput("");
      setAnswered(false);
      setWasCorrect(false);
      return;
    }
    await supabase
      .from("practice_sessions")
      .update({ correct_answers: correctCount, completed_at: new Date().toISOString() })
      .eq("id", sessionId);
    onFinish(correctCount, questions.length);
  }

  return (
    <section className="view">
      <div className="quiz-header">
        <span>প্রশ্ন {toBn(index + 1)} / {toBn(questions.length)}</span>
        <div className="quiz-progress-track">
          <div className="quiz-progress-bar" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
        <span>{toBn(correctCount)} সঠিক</span>
      </div>

      <div className="omr-sheet">
        <div className="omr-qnum">{toBn(index + 1).padStart(2, "0")}</div>
        <p className="omr-question">{q.question_text}</p>

        {!isShort && (
          <div className="omr-options">
            {OPTION_KEYS.map((key) => {
              const classes = ["omr-option"];
              if (answered) {
                classes.push("disabled");
                if (key === q.correct_option) classes.push("correct", "correct-label");
                if (key === picked && key !== q.correct_option) classes.push("wrong");
                if (key === picked) classes.push("picked");
              }
              return (
                <button key={key} className={classes.join(" ")} onClick={() => selectMcqAnswer(key)}>
                  <span className="omr-bubble">{key.toUpperCase()}</span>
                  <span>{q["option_" + key]}</span>
                </button>
              );
            })}
          </div>
        )}

        {isShort && (
          <div className="short-answer-block">
            <input
              type="text"
              className="short-answer-input"
              placeholder="আপনার উত্তর লিখুন..."
              value={shortInput}
              disabled={answered}
              onChange={(e) => setShortInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitShortAnswer()}
            />
            {!answered && (
              <button className="cta-primary" disabled={!shortInput.trim()} onClick={submitShortAnswer}>
                উত্তর জমা দিন
              </button>
            )}
            {answered && (
              <div className={`short-answer-feedback ${wasCorrect ? "ok" : "err"}`}>
                {wasCorrect ? "✅ সঠিক!" : `❌ সঠিক উত্তর: ${q.short_answer}`}
              </div>
            )}
          </div>
        )}

        {answered && q.explanation && (
          <div className="omr-explanation">{q.explanation}</div>
        )}
      </div>

      <div className="quiz-nav">
        <button className="cta-primary" disabled={!answered || saving} onClick={handleNext}>
          {isLast ? "ফলাফল দেখুন →" : "পরবর্তী প্রশ্ন →"}
        </button>
      </div>
    </section>
  );
}
