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

export default function ExamStyleQuiz() {
  const { activeExamQuiz, handleExamQuizFinish } = useApp();
  const { sessionId, questions, timeLimitSeconds } = activeExamQuiz;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionKey }
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds);
  const finishedRef = useRef(false);
  const answersRef = useRef({});

  const q = questions[index];
  const isLast = index === questions.length - 1;

  useEffect(() => {
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

  function selectOption(key) {
    const next = { ...answersRef.current, [q.id]: key };
    answersRef.current = next;
    setAnswers(next);
  }

  function goTo(i) {
    setIndex(i);
  }

  function nextQuestion() {
    if (isLast) {
      doFinish();
    } else {
      setIndex((i) => i + 1);
    }
  }

  async function doFinish() {
    if (finishedRef.current) return;
    finishedRef.current = true;

    let correctCount = 0;
    const rows = questions.map((qq) => {
      const selected = answersRef.current[qq.id] || null;
      const isCorrect = selected != null ? selected === qq.correct_option : null;
      if (isCorrect) correctCount++;
      return {
        session_id: sessionId,
        question_id: qq.id,
        selected_option: selected,
        is_correct: selected == null ? null : isCorrect
      };
    });

    await supabase.from("session_answers").insert(rows);
    await supabase
      .from("practice_sessions")
      .update({ correct_answers: correctCount, completed_at: new Date().toISOString() })
      .eq("id", sessionId);

    handleExamQuizFinish(correctCount, questions.length, sessionId);
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <section className="view">
      <div className="quiz-header">
        <span>প্রশ্ন {toBn(index + 1)} / {toBn(questions.length)}</span>
        <div className="quiz-progress-track">
          <div className="quiz-progress-bar" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
        <span className={secondsLeft <= 30 ? "quiz-timer low" : "quiz-timer"}>⏱ {formatTime(secondsLeft)}</span>
        <span>{toBn(answeredCount)}/{toBn(questions.length)} উত্তর দেওয়া হয়েছে</span>
      </div>

      <div className="omr-sheet">
        <div className="omr-qnum">{toBn(index + 1).padStart(2, "0")}</div>
        <p className="omr-question">{q.question_text}</p>

        <div className="omr-options">
          {OPTION_KEYS.map((key) => {
            const picked = answers[q.id] === key;
            return (
              <button
                key={key}
                className={`omr-option ${picked ? "picked" : ""}`}
                onClick={() => selectOption(key)}
              >
                <span className="omr-bubble">{key.toUpperCase()}</span>
                <span>{q["option_" + key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="exam-qnav">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            className={`exam-qnav-dot ${i === index ? "current" : ""} ${answers[qq.id] ? "answered" : ""}`}
            onClick={() => goTo(i)}
          >
            {toBn(i + 1)}
          </button>
        ))}
      </div>

      <div className="quiz-nav">
        <button className="cta-ghost" onClick={doFinish}>এখনই জমা দিন</button>
        <button className="cta-primary" onClick={nextQuestion}>
          {isLast ? "জমা দিন →" : "পরবর্তী প্রশ্ন →"}
        </button>
      </div>
    </section>
  );
}
