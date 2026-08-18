import { useEffect, useState } from "react";
import { supabase, isConfigured } from "./lib/supabaseClient";
import { shuffle } from "./lib/utils";
import { ensureProfileExists } from "./lib/ensureProfile";
import { AppContext } from "./lib/AppContext";

import ConfigNotice from "./components/ConfigNotice";
import Login from "./components/Login";
import TopBar from "./components/TopBar";
import Quiz from "./components/Quiz";
import Result from "./components/Result";
import SessionReview from "./components/SessionReview";
import PracticeSession from "./components/PracticeSession";
import PracticeFinished from "./components/PracticeFinished";
import ExamStyleQuiz from "./components/ExamStyleQuiz";
import features from "./features/registry";

const QUESTIONS_PER_SESSION = 20;

// "System views" are part of the core practice flow (not toggleable
// features with a nav button) — they're reached via actions inside a
// feature (starting a quiz, finishing a quiz), not by clicking a tab.
const SYSTEM_VIEWS = {
  quiz: Quiz,
  result: Result,
  sessionreview: SessionReview,
  practicesession: PracticeSession,
  practicefinished: PracticeFinished,
  examquiz: ExamStyleQuiz
};

export default function MainApp() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);

  const [view, setView] = useState("dashboard");
  const [activeQuiz, setActiveQuiz] = useState(null); // { sessionId, questions, timeLimitSeconds }
  const [lastResult, setLastResult] = useState(null); // { correct, total, sessionId }
  const [activePractice, setActivePractice] = useState(null); // { sessionId, questions, displayMode, timeLimitSeconds }
  const [practiceResult, setPracticeResult] = useState(null); // { reviewed, minutes }
  const [activeExamQuiz, setActiveExamQuiz] = useState(null); // { sessionId, questions, timeLimitSeconds }

  useEffect(() => {
    if (!isConfigured) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) await ensureProfileExists(session.user);
      setUser(session?.user || null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) await ensureProfileExists(session.user);
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadStaticData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadStaticData() {
    const [{ data: s }, { data: t }, { data: e }] = await Promise.all([
      supabase.from("subjects").select("*").order("sort_order"),
      supabase.from("topics").select("*").order("sort_order"),
      supabase.from("exams").select("*").order("year", { ascending: false })
    ]);
    setSubjects(s || []);
    setTopics(t || []);
    setExams(e || []);
  }

  async function startQuiz({ mode, subjectId = null, topicId = null, examId = null }) {
    let query = supabase.from("questions").select("*");
    if (mode === "subject") query = query.eq("subject_id", subjectId);
    if (mode === "topic") query = query.eq("topic_id", topicId);
    if (mode === "exam") query = query.eq("exam_id", examId);

    const { data: questions, error } = await query;
    if (error || !questions || !questions.length) {
      alert("এই মোডে এখনো কোনো প্রশ্ন যোগ করা হয়নি। Admin Panel থেকে প্রশ্ন যোগ করুন।");
      return;
    }

    const picked = shuffle(questions).slice(0, QUESTIONS_PER_SESSION);

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        mode,
        subject_id: subjectId,
        topic_id: topicId,
        exam_id: examId,
        total_questions: picked.length
      })
      .select()
      .single();

    if (sessionErr) {
      alert("সেশন শুরু করা যায়নি: " + sessionErr.message);
      return;
    }

    setActiveQuiz({ sessionId: sessionRow.id, questions: picked, timeLimitSeconds: null });
    setView("quiz");
  }

  // Used by Quiz Builder: caller already resolved the exact question list
  // and any custom count/time limit; this just opens a 'custom' session.
  async function startCustomQuiz(questionList, meta, timeLimitSeconds) {
    if (!questionList || !questionList.length) {
      alert("এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।");
      return;
    }
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        mode: "custom",
        subject_id: meta?.subjectId || null,
        total_questions: questionList.length
      })
      .select()
      .single();

    if (sessionErr) {
      alert("সেশন শুরু করা যায়নি: " + sessionErr.message);
      return;
    }

    setActiveExamQuiz({ sessionId: sessionRow.id, questions: questionList, timeLimitSeconds });
    setView("examquiz");
  }

  function handleExamQuizFinish(correct, total, sessionId) {
    setLastResult({ correct, total, sessionId });
    setActiveExamQuiz(null);
    setView("result");
  }

  // Live Exam: pull questions from the linked exam/subject (or all, if
  // neither set), start a 'live' session tied to this live_exam_id.
  async function startLiveExam(liveExam, timeLimitSeconds) {
    let picked;

    if (liveExam.question_ids && liveExam.question_ids.length) {
      // Fixed set — generated once when the exam was created, same for everyone.
      const { data: questionsData, error } = await supabase.from("questions").select("*").in("id", liveExam.question_ids);
      if (error || !questionsData || !questionsData.length) {
        alert("এই লাইভ পরীক্ষার প্রশ্ন লোড করা যায়নি।");
        return;
      }
      const byId = Object.fromEntries(questionsData.map((q) => [q.id, q]));
      picked = liveExam.question_ids.map((id) => byId[id]).filter(Boolean);
    } else {
      // Fallback for older live exams created before fixed sets existed.
      let query = supabase.from("questions").select("*");
      if (liveExam.exam_id) query = query.eq("exam_id", liveExam.exam_id);
      else if (liveExam.subject_id) query = query.eq("subject_id", liveExam.subject_id);
      const { data: questionsData, error } = await query;
      if (error || !questionsData || !questionsData.length) {
        alert("এই লাইভ পরীক্ষার জন্য এখনো কোনো প্রশ্ন যোগ করা হয়নি।");
        return;
      }
      picked = shuffle(questionsData).slice(0, liveExam.question_count || 20);
    }

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        mode: "live",
        live_exam_id: liveExam.id,
        subject_id: liveExam.subject_id || null,
        exam_id: liveExam.exam_id || null,
        total_questions: picked.length
      })
      .select()
      .single();

    if (sessionErr) {
      if (String(sessionErr.message || "").includes("PREMIUM_REQUIRED")) {
        alert("এই লাইভ পরীক্ষায় অংশ নিতে সাবস্ক্রিপশন লাগবে।");
        setView("subscription");
      } else {
        alert("সেশন শুরু করা যায়নি: " + sessionErr.message);
      }
      return;
    }

    setActiveQuiz({ sessionId: sessionRow.id, questions: picked, timeLimitSeconds });
    setView("quiz");
  }

  // Exam Archive: replay an archived Live Exam's fixed question set with
  // full scoring (uses a distinct 'examarchive' mode so it never affects
  // that exam's original live ranking).
  async function startArchivedExam(liveExam) {
    if (!liveExam.question_ids || !liveExam.question_ids.length) {
      alert("এই প্রশ্নপত্রে কোনো প্রশ্ন পাওয়া যায়নি।");
      return;
    }
    const { data: questionsData, error } = await supabase.from("questions").select("*").in("id", liveExam.question_ids);
    if (error || !questionsData || !questionsData.length) {
      alert("প্রশ্ন লোড করা যায়নি।");
      return;
    }
    const byId = Object.fromEntries(questionsData.map((q) => [q.id, q]));
    const picked = liveExam.question_ids.map((id) => byId[id]).filter(Boolean);

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        mode: "examarchive",
        live_exam_id: liveExam.id,
        total_questions: picked.length
      })
      .select()
      .single();

    if (sessionErr) {
      alert("সেশন শুরু করা যায়নি: " + sessionErr.message);
      return;
    }

    setActiveQuiz({ sessionId: sessionRow.id, questions: picked, timeLimitSeconds: null });
    setView("quiz");
  }

  // ============================================================
  // PRACTICE (unified) — flashcard/direct-MCQ, no score saved,
  // only "known/unknown" self-assessment + time tracked.
  // ============================================================
  async function startPractice({ mode, subjectId, topicId, examId, subjectIds, topicIds, count, timeLimitSeconds, displayMode }) {
    let questionsData = null;
    let error = null;

    if (mode === "known" || mode === "unknown") {
      const { data: knowledge } = await supabase
        .from("question_knowledge")
        .select("question_id")
        .eq("user_id", user.id)
        .eq("status", mode);
      const ids = (knowledge || []).map((k) => k.question_id);
      if (!ids.length) {
        alert("এই তালিকায় এখনো কোনো প্রশ্ন নেই।");
        return;
      }
      const res = await supabase.from("questions").select("*").in("id", ids);
      questionsData = res.data;
      error = res.error;
    } else if (mode === "custom") {
      let query = supabase.from("questions").select("*").in("subject_id", subjectIds);
      if (topicIds && topicIds.length) query = query.in("topic_id", topicIds);
      const res = await query;
      questionsData = res.data;
      error = res.error;
    } else {
      let query = supabase.from("questions").select("*");
      if (mode === "subject") query = query.eq("subject_id", subjectId);
      if (mode === "topic") query = query.eq("topic_id", topicId);
      if (mode === "exam") query = query.eq("exam_id", examId);
      const res = await query;
      questionsData = res.data;
      error = res.error;
    }

    if (error || !questionsData || !questionsData.length) {
      alert("এই মোডে এখনো কোনো প্রশ্ন পাওয়া যায়নি।");
      return;
    }

    let picked = shuffle(questionsData);
    if (mode === "custom" && count) picked = picked.slice(0, count);

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        mode: "practice",
        subject_id: subjectId || (subjectIds && subjectIds.length === 1 ? subjectIds[0] : null),
        topic_id: topicId || null,
        exam_id: examId || null,
        total_questions: picked.length
      })
      .select()
      .single();

    if (sessionErr) {
      alert("সেশন শুরু করা যায়নি: " + sessionErr.message);
      return;
    }

    setActivePractice({ sessionId: sessionRow.id, questions: picked, displayMode, timeLimitSeconds: timeLimitSeconds || null });
    setView("practicesession");
  }

  async function finishPractice(sessionId, reviewedCount) {
    const { data: sessionRow } = await supabase.from("practice_sessions").select("started_at").eq("id", sessionId).single();
    const completedAt = new Date();
    await supabase.from("practice_sessions").update({ completed_at: completedAt.toISOString() }).eq("id", sessionId);
    const minutes = sessionRow?.started_at
      ? Math.max(0, Math.round((completedAt - new Date(sessionRow.started_at)) / 60000))
      : 0;
    setPracticeResult({ reviewed: reviewedCount, minutes });
    setActivePractice(null);
    setView("practicefinished");
  }

  function handleQuizFinish(correct, total, sessionId) {
    setLastResult({ correct, total, sessionId });
    setActiveQuiz(null);
    setView("result");
  }

  function handleReviewWrong(sessionId) {
    setLastResult((prev) => ({ ...prev, sessionId }));
    setView("sessionreview");
  }

  if (!isConfigured) return <ConfigNotice />;
  if (authLoading) return null;
  if (!user) return <Login />;

  // Resolve what to render: a system view (quiz/result/review) if active,
  // otherwise whichever registered feature matches the current nav key.
  const SystemView = SYSTEM_VIEWS[view];
  const activeFeature = features.find((f) => f.key === view);
  const FeatureComponent = activeFeature?.component;

  const contextValue = {
    user, subjects, topics, exams,
    view, setView,
    activeQuiz, lastResult,
    activePractice, practiceResult,
    activeExamQuiz,
    startQuiz, startCustomQuiz, startLiveExam, startArchivedExam,
    startPractice, finishPractice,
    handleQuizFinish, handleReviewWrong, handleExamQuizFinish,
    refreshStaticData: loadStaticData
  };

  return (
    <AppContext.Provider value={contextValue}>
      <TopBar />
      <main className="main-area">
        {SystemView
          && (view !== "quiz" || activeQuiz)
          && (view !== "result" || lastResult)
          && (view !== "sessionreview" || lastResult?.sessionId)
          && (view !== "practicesession" || activePractice)
          && (view !== "practicefinished" || practiceResult)
          && (view !== "examquiz" || activeExamQuiz)
          && <SystemView />}
        {!SystemView && FeatureComponent && <FeatureComponent />}
        {!SystemView && !FeatureComponent && <p className="mode-desc">এই পাতাটা পাওয়া যায়নি।</p>}
      </main>
    </AppContext.Provider>
  );
}
