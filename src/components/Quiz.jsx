import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";

const OPTION_KEYS = ["a", "b", "c", "d"];

export default function Quiz({ sessionId, questions, onFinish }) {
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState(null); // selected option key for current question
  const [saving, setSaving] = useState(false);

  const q = questions[index];
  const isLast = index === questions.length - 1;

  async function selectAnswer(key) {
    if (picked) return;
    setPicked(key);
    setSaving(true);

    const isCorrect = key === q.correct_option;
    if (isCorrect) setCorrectCount((c) => c + 1);

    await supabase.from("session_answers").insert({
      session_id: sessionId,
      question_id: q.id,
      selected_option: key,
      is_correct: isCorrect
    });
    setSaving(false);
  }

  async function handleNext() {
    if (!isLast) {
      setIndex((i) => i + 1);
      setPicked(null);
      return;
    }
    const finalCorrect = correctCount; // already includes this question's result via state
    await supabase
      .from("practice_sessions")
      .update({ correct_answers: finalCorrect, completed_at: new Date().toISOString() })
      .eq("id", sessionId);
    onFinish(finalCorrect, questions.length);
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

        <div className="omr-options">
          {OPTION_KEYS.map((key) => {
            const classes = ["omr-option"];
            if (picked) {
              classes.push("disabled");
              if (key === q.correct_option) classes.push("correct", "correct-label");
              if (key === picked && key !== q.correct_option) classes.push("wrong");
              if (key === picked) classes.push("picked");
            }
            return (
              <button key={key} className={classes.join(" ")} onClick={() => selectAnswer(key)}>
                <span className="omr-bubble">{key.toUpperCase()}</span>
                <span>{q["option_" + key]}</span>
              </button>
            );
          })}
        </div>

        {picked && q.explanation && (
          <div className="omr-explanation">{q.explanation}</div>
        )}
      </div>

      <div className="quiz-nav">
        <button className="cta-primary" disabled={!picked || saving} onClick={handleNext}>
          {isLast ? "ফলাফল দেখুন →" : "পরবর্তী প্রশ্ন →"}
        </button>
      </div>
    </section>
  );
}
