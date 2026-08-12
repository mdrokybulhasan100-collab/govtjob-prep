import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { useApp } from "../lib/AppContext";

const OPTION_KEYS = ["a", "b", "c", "d"];

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${toBn(m)}:${toBn(String(s).padStart(2, "0"))}`;
}

export default function PracticeSession() {
  const { user, activePractice, finishPractice } = useApp();
  const { sessionId, questions, displayMode, timeLimitSeconds } = activePractice;

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(displayMode === "direct");
  const [picked, setPicked] = useState(null);
  const [marked, setMarked] = useState(null); // 'known' | 'unknown' | null
  const [reviewedCount, setReviewedCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds);
  const finishedRef = useRef(false);

  const q = questions[index];
  const isShort = q.question_type === "short";
  const isLast = index === questions.length - 1;

  useEffect(() => {
    if (timeLimitSeconds == null) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          if (!finishedRef.current) {
            finishedRef.current = true;
            doFinish();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForNextQuestion() {
    setRevealed(displayMode === "direct");
    setPicked(null);
    setMarked(null);
  }

  function reveal() {
    setRevealed(true);
  }

  function selectOption(key) {
    if (picked) return;
    setPicked(key);
  }

  async function markKnowledge(status) {
    setMarked(status);
    setReviewedCount((c) => c + 1);
    await supabase.from("question_knowledge").upsert({ user_id: user.id, question_id: q.id, status });
  }

  function nextQuestion() {
    if (isLast) {
      doFinish();
      return;
    }
    setIndex((i) => i + 1);
    resetForNextQuestion();
  }

  function skipQuestion() {
    if (isLast) {
      doFinish();
      return;
    }
    setIndex((i) => i + 1);
    resetForNextQuestion();
  }

  async function doFinish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    await finishPractice(sessionId, reviewedCount);
  }

  const canAdvance = marked !== null;

  return (
    <section className="view">
      <div className="quiz-header">
        <span>প্রশ্ন {toBn(index + 1)} / {toBn(questions.length)}</span>
        <div className="quiz-progress-track">
          <div className="quiz-progress-bar" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
        {timeLimitSeconds != null && (
          <span className={secondsLeft <= 30 ? "quiz-timer low" : "quiz-timer"}>⏱ {formatTime(secondsLeft)}</span>
        )}
        <button className="cta-ghost" onClick={doFinish} style={{ padding: "6px 14px" }}>Finish</button>
      </div>

      <div className="omr-sheet">
        <div className="omr-qnum">{toBn(index + 1).padStart(2, "0")}</div>
        <p className="omr-question">{q.question_text}</p>

        {isShort ? (
          <div className="short-answer-block">
            {!revealed && (
              <button className="cta-primary" onClick={reveal}>উত্তর দেখাও</button>
            )}
            {revealed && (
              <div className="short-answer-feedback ok">
                ✅ সঠিক উত্তর: {(q.short_answer || "").split(",")[0].trim()}
              </div>
            )}
          </div>
        ) : (
          <>
            {!revealed && (
              <button className="cta-primary" onClick={reveal} style={{ marginBottom: 8 }}>অপশন দেখাও</button>
            )}
            {revealed && (
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
                    <button key={key} className={classes.join(" ")} onClick={() => selectOption(key)}>
                      <span className="omr-bubble">{key.toUpperCase()}</span>
                      <span>{q["option_" + key]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {revealed && (isShort || picked) && q.explanation && (
          <div className="omr-explanation">{q.explanation}</div>
        )}

        {revealed && (isShort || picked) && (
          <div className="know-buttons">
            <button className={`know-btn known ${marked === "known" ? "active" : ""}`} onClick={() => markKnowledge("known")}>
              ✅ জানতাম
            </button>
            <button className={`know-btn unknown ${marked === "unknown" ? "active" : ""}`} onClick={() => markKnowledge("unknown")}>
              ❌ জানতাম না
            </button>
          </div>
        )}
      </div>

      <div className="quiz-nav">
        {!revealed && !picked && (
          <button className="cta-ghost" onClick={skipQuestion}>এড়িয়ে যান</button>
        )}
        <button className="cta-primary" disabled={!canAdvance} onClick={nextQuestion}>
          {isLast ? "শেষ করুন →" : "পরবর্তী প্রশ্ন →"}
        </button>
      </div>
    </section>
  );
}
