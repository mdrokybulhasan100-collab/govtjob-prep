import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { SearchResultCard } from "./SmartSearch";
import { useApp } from "../lib/AppContext";

export default function ExamsList() {
  const { user, startArchivedExam } = useApp();
  const [archivedExams, setArchivedExams] = useState([]);
  const [query, setQuery] = useState("");
  const [attendedIds, setAttendedIds] = useState(new Set());
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [previewExam, setPreviewExam] = useState(null); // { id, title } or null
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    load();
    loadFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoadingStatus(true);
    const [{ data: exams }, { data: sessions }] = await Promise.all([
      supabase.from("live_exams").select("*").eq("archived", true).order("start_at", { ascending: false }),
      supabase.from("practice_sessions").select("live_exam_id").eq("user_id", user.id).eq("mode", "examarchive").not("live_exam_id", "is", null).not("completed_at", "is", null)
    ]);
    setArchivedExams(exams || []);
    setAttendedIds(new Set((sessions || []).map((s) => s.live_exam_id)));
    setLoadingStatus(false);
  }

  async function loadFavoriteIds() {
    const { data } = await supabase.from("question_knowledge").select("question_id").eq("user_id", user.id).eq("status", "unknown");
    setFavoriteIds(new Set((data || []).map((f) => f.question_id)));
  }

  async function toggleFavorite(questionId) {
    const isFav = favoriteIds.has(questionId);
    const next = new Set(favoriteIds);
    if (isFav) {
      next.delete(questionId);
      setFavoriteIds(next);
      await supabase.from("question_knowledge").delete().eq("user_id", user.id).eq("question_id", questionId);
    } else {
      next.add(questionId);
      setFavoriteIds(next);
      await supabase.from("question_knowledge").upsert({ user_id: user.id, question_id: questionId, status: "unknown" });
    }
  }

  async function openPreview(exam) {
    setPreviewExam(exam);
    setLoadingPreview(true);
    const { data } = await supabase
      .from("questions")
      .select("*, subjects(name_bn), topics(name_bn), exams(name)")
      .in("id", exam.question_ids || []);
    const mapped = (data || []).map((q) => ({
      ...q,
      subject_name: q.subjects?.name_bn,
      topic_name: q.topics?.name_bn,
      exam_name: q.exams?.name
    }));
    setPreviewQuestions(mapped);
    setLoadingPreview(false);
  }

  const filteredExams = archivedExams.filter((e) => {
    if (!query.trim()) return true;
    return e.title.toLowerCase().includes(query.trim().toLowerCase());
  });

  if (previewExam) {
    return (
      <section className="view">
        <button className="cta-ghost" onClick={() => setPreviewExam(null)} style={{ marginBottom: 16 }}>← তালিকায় ফিরুন</button>
        <h2 className="section-title" style={{ marginTop: 0 }}>{previewExam.title}</h2>
        <p className="mode-desc">প্রশ্ন দেখুন — এটা প্র্যাকটিস সেশন না, শুধু প্রিভিউ।</p>

        {loadingPreview && <p className="mode-desc">লোড হচ্ছে...</p>}
        {!loadingPreview && previewQuestions.length === 0 && (
          <p className="mode-desc">এই প্রশ্নপত্রে এখনো কোনো প্রশ্ন যোগ করা হয়নি।</p>
        )}
        {!loadingPreview && previewQuestions.length > 0 && (
          <>
            <div className="search-results">
              {previewQuestions.map((q) => (
                <SearchResultCard
                  key={q.id}
                  q={q}
                  isFav={favoriteIds.has(q.id)}
                  onToggleFavorite={() => toggleFavorite(q.id)}
                />
              ))}
            </div>
            <button className="cta-primary" style={{ marginTop: 18 }} onClick={() => startArchivedExam(previewExam)}>
              এই প্রশ্নপত্র দিয়ে প্র্যাকটিস শুরু করুন →
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="view">
      <h2 className="section-title">📁 পরীক্ষা আর্কাইভ</h2>
      <p className="mode-desc">শেষ হয়ে যাওয়া লাইভ পরীক্ষাগুলো এখানে প্র্যাকটিসের জন্য পাওয়া যায় — সবার জন্য একই ফিক্সড প্রশ্নপত্র।</p>

      <input
        type="text"
        className="smart-search-input"
        placeholder="পরীক্ষার নাম দিয়ে খুঁজুন..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {archivedExams.length === 0 ? (
        <p className="mode-desc" style={{ marginTop: 16 }}>
          এখনো কোনো পরীক্ষা আর্কাইভ করা হয়নি। কোনো লাইভ পরীক্ষা শেষ হলে Admin সেটা আর্কাইভে পাঠালে এখানে দেখা যাবে।
        </p>
      ) : filteredExams.length === 0 ? (
        <p className="mode-desc" style={{ marginTop: 16 }}>এই খোঁজে কোনো পরীক্ষা পাওয়া যায়নি।</p>
      ) : (
        <>
          <p className="mode-desc" style={{ marginTop: 16 }}>{toBn(filteredExams.length)}টি পরীক্ষা</p>
          <div className="exam-list">
            {filteredExams.map((exam) => {
              const attended = attendedIds.has(exam.id);
              return (
                <div className="exam-item" key={exam.id}>
                  <div>
                    <div className="ei-name">
                      {exam.title}{" "}
                      {!loadingStatus && (
                        <span className={`attend-tag ${attended ? "attended" : "unattended"}`}>
                          {attended ? "✓ দেওয়া হয়েছে" : "দেওয়া হয়নি"}
                        </span>
                      )}
                    </div>
                    <div className="ei-meta">
                      {new Date(exam.start_at).toLocaleDateString("bn-BD")} · {toBn(exam.question_count)}টি প্রশ্ন
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="cta-ghost" onClick={() => openPreview(exam)}>প্রশ্ন দেখুন</button>
                    <button className="cta-primary" onClick={() => startArchivedExam(exam)}>
                      শুরু করুন
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
