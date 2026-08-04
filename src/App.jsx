import { useEffect, useState } from "react";
import { supabase, isConfigured } from "./lib/supabaseClient";
import { shuffle } from "./lib/utils";

import ConfigNotice from "./components/ConfigNotice";
import Login from "./components/Login";
import TopBar from "./components/TopBar";
import Dashboard from "./components/Dashboard";
import PracticeSetup from "./components/PracticeSetup";
import Quiz from "./components/Quiz";
import Result from "./components/Result";
import ExamsList from "./components/ExamsList";

const QUESTIONS_PER_SESSION = 20;

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);

  const [view, setView] = useState("dashboard");
  const [activeQuiz, setActiveQuiz] = useState(null); // { sessionId, questions }
  const [lastResult, setLastResult] = useState(null); // { correct, total }

  useEffect(() => {
    if (!isConfigured) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
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
      alert("এই মোডে এখনো কোনো প্রশ্ন যোগ করা হয়নি। Supabase-এর 'questions' টেবিলে প্রশ্ন যোগ করুন।");
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

    setActiveQuiz({ sessionId: sessionRow.id, questions: picked });
    setView("quiz");
  }

  function handleQuizFinish(correct, total) {
    setLastResult({ correct, total });
    setActiveQuiz(null);
    setView("result");
  }

  if (!isConfigured) return <ConfigNotice />;
  if (authLoading) return null;
  if (!user) return <Login />;

  return (
    <div>
      <TopBar view={view} setView={setView} user={user} />
      <main className="main-area">
        {view === "dashboard" && (
          <Dashboard user={user} subjects={subjects} setView={setView} />
        )}
        {view === "practice" && (
          <PracticeSetup subjects={subjects} topics={topics} onStart={startQuiz} />
        )}
        {view === "quiz" && activeQuiz && (
          <Quiz
            sessionId={activeQuiz.sessionId}
            questions={activeQuiz.questions}
            onFinish={handleQuizFinish}
          />
        )}
        {view === "result" && lastResult && (
          <Result correct={lastResult.correct} total={lastResult.total} setView={setView} />
        )}
        {view === "exams" && (
          <ExamsList exams={exams} onStart={startQuiz} />
        )}
      </main>
    </div>
  );
}
