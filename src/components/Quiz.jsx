import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn, banglaToLatin } from "../lib/utils";
import { useApp } from "../lib/AppContext";

const OPTION_KEYS = ["a", "b", "c", "d"];

function normalize(str) {
  return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// short_answer can contain multiple accepted variants separated by commas,
// e.g. "ঢাকা, Dhaka, dhaka" — any one matching (after normalizing) counts.
function acceptedVariants(shortAnswer) {
  return (shortAnswer || "").split(",").map((v) => v.trim()).filter(Boolean);
}

function isShortAnswerCorrect(userInput, shortAnswer) {
  const given = normalize(userInput);
  const variants = acceptedVariants(shortAnswer);
  // 1) exact match against any stored variant (admin-provided, e.g. "ঢাকা, Dhaka")
  if (variants.some((v) => normalize(v) === given)) return true;
  // 2) automatic fallback: transliterate each Bangla variant to Latin and
  //    compare, so English answers work even if the admin only stored Bangla
  return variants.some((v) => normalize(banglaToLatin(v)) === given);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${toBn(m)}:${toBn(String(s).padStart(2, "0"))}`;
}

export default function Quiz() {
  const { activeQuiz, handleQuizFinish } = useApp();
  const { sessionId, questions, timeLimitSeconds = null, mode = "practice" } = activeQuiz;
  const isLiveExam = mode === "live";
  const onFinish = handleQuizFinish;
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState(null); // mcq: option key
  const [shortInput, setShortInput] = useState("");
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds);

  const correctCountRef = useRef(0);
  const finishedRef = useRef(false);

  const q = questions[index];
  const isLast = index === questions.length - 1;
  const isShort = q.question_type === "short";

  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

  useEffect(() => {
    if (timeLimitSeconds == null) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          if (!finishedRef.current) {
            finishedRef.current = true;
            finishQuiz();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectMcqAnswer(key) {
    if (answered) return;
    setPicked(key);
    setAnswered(true);
    setSaving(true);

    if (isLiveExam) {
      const { error } = await supabase.rpc("submit_live_exam_answer", {
        p_session_id: sessionId,
        p_question_id: q.id,
        p_selected_option: key
      });
      if (error) {
        setAnswered(false);
        setPicked(null);
        alert("উত্তর জমা দেওয়া যায়নি: " + error.message);
        setSaving(false);
        return;
      }
      setWasCorrect(false);
      setSaving(false);
      return;
    }

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

    const isCorrect = isShortAnswerCorrect(shortInput, q.short_answer);
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

  async function skipQuestion() {
    if (answered) return;
    setSaving(true);
    if (!isLiveExam) {
      await supabase.from("session_answers").insert({
        session_id: sessionId,
        question_id: q.id,
        selected_option: null,
        is_correct: null
      });
    }
    setSaving(false);
    if (!isLast) {
      setIndex((i) => i + 1);
      setPicked(null);
      setShortInput("");
      setAnswered(false);
      setWasCorrect(false);
    } else {
      if (finishedRef.current) return;
      finishedRef.current = true;
      await finishQuiz();
    }
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
    if (finishedRef.current) return;
    finishedRef.current = true;
    await finishQuiz();
  }

  async function finishQuiz() {
    if (isLiveExam) {
      const { data, error } = await supabase.rpc("finalize_live_exam", { p_session_id: sessionId });
      if (error) {
        finishedRef.current = false;
        alert("পরীক্ষার ফলাফল জমা দেওয়া যায়নি: " + error.message);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      onFinish(row?.correct_answers ?? 0, row?.total_questions ?? questions.length, sessionId);
      return;
    }

    await supabase
      .from("practice_sessions")
      .update({ correct_answers: correctCountRef.current, completed_at: new Date().toISOString() })
      .eq("id", sessionId);
    onFinish(correctCountRef.current, questions.length, sessionId);
  }

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
        <span>{toBn(correctCount)} সঠিক</span>
      </div>

      <div className="omr-sheet">
        <div className="omr-qnum">{toBn(index + 1).padStart(2, "0")}</div>
        <p className="omr-question">{q.question_text}</p>
        {isLiveExam && <p className="mode-desc">লাইভ পরীক্ষায় উত্তর দেওয়ার পর সঠিক/ভুল দেখানো হবে না। ফলাফল পরীক্ষা শেষে প্রকাশ হবে।</p>}

        {!isShort && (
          <div className="omr-options">
            {(q._optionOrder || OPTION_KEYS).map((key, displayIndex) => {
              const classes = ["omr-option"];
              if (answered) {
                classes.push("disabled");
                if (!isLiveExam && key === q.correct_option) classes.push("correct", "correct-label");
                if (!isLiveExam && key === picked && key !== q.correct_option) classes.push("wrong");
                if (key === picked) classes.push("picked");
              }
              return (
                <button key={key} className={classes.join(" ")} onClick={() => selectMcqAnswer(key)}>
                  <span className="omr-bubble">{OPTION_KEYS[displayIndex].toUpperCase()}</span>
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
                {wasCorrect ? "✅ সঠিক!" : `❌ সঠিক উত্তর: ${acceptedVariants(q.short_answer)[0] || q.short_answer}`}
              </div>
            )}
          </div>
        )}

        {answered && !isLiveExam && q.explanation && (
          <div className="omr-explanation">{q.explanation}</div>
        )}
      </div>

      <div className="quiz-nav">
        {!answered && (
          <button className="cta-ghost" disabled={saving} onClick={skipQuestion}>এড়িয়ে যান</button>
        )}
        <button className="cta-primary" disabled={!answered || saving} onClick={handleNext}>
          {isLast ? "ফলাফল দেখুন →" : "পরবর্তী প্রশ্ন →"}
        </button>
      </div>
    </section>
  );
}
