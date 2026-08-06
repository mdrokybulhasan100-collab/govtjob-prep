import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { SearchResultCard } from "./SmartSearch";
import { useApp } from "../lib/AppContext";

export default function ExamsList() {
  const { user, exams, startQuiz: onStart } = useApp();
  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [unattendedOnly, setUnattendedOnly] = useState(false);
  const [attendedExamIds, setAttendedExamIds] = useState(new Set());
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [previewExam, setPreviewExam] = useState(null); // { id, name } or null
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    loadAttendedStatus();
    loadFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFavoriteIds() {
    const { data } = await supabase.from("favorites").select("question_id").eq("user_id", user.id);
    setFavoriteIds(new Set((data || []).map((f) => f.question_id)));
  }

  async function toggleFavorite(questionId) {
    const isFav = favoriteIds.has(questionId);
    const next = new Set(favoriteIds);
    if (isFav) {
      next.delete(questionId);
      setFavoriteIds(next);
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("question_id", questionId);
    } else {
      next.add(questionId);
      setFavoriteIds(next);
      await supabase.from("favorites").insert({ user_id: user.id, question_id: questionId });
    }
  }

  async function loadAttendedStatus() {
    setLoadingStatus(true);
    const { data } = await supabase
      .from("practice_sessions")
      .select("exam_id")
      .eq("user_id", user.id)
      .eq("mode", "exam")
      .not("completed_at", "is", null)
      .not("exam_id", "is", null);
    setAttendedExamIds(new Set((data || []).map((s) => s.exam_id)));
    setLoadingStatus(false);
  }

  async function openPreview(exam) {
    setPreviewExam(exam);
    setLoadingPreview(true);
    const { data } = await supabase
      .from("questions")
      .select("*, subjects(name_bn), topics(name_bn), exams(name)")
      .eq("exam_id", exam.id);
    const mapped = (data || []).map((q) => ({
      ...q,
      subject_name: q.subjects?.name_bn,
      topic_name: q.topics?.name_bn,
      exam_name: q.exams?.name
    }));
    setPreviewQuestions(mapped);
    setLoadingPreview(false);
  }

  const organizations = [...new Set(exams.map((e) => e.organization).filter(Boolean))];

  const filteredExams = exams.filter((e) => {
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = `${e.name} ${e.organization || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (orgFilter && e.organization !== orgFilter) return false;
    if (unattendedOnly && attendedExamIds.has(e.id)) return false;
    return true;
  });

  if (previewExam) {
    return (
      <section className="view">
        <button className="cta-ghost" onClick={() => setPreviewExam(null)} style={{ marginBottom: 16 }}>← তালিকায় ফিরুন</button>
        <h2 className="section-title" style={{ marginTop: 0 }}>{previewExam.name}</h2>
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
            <button className="cta-primary" style={{ marginTop: 18 }} onClick={() => onStart({ mode: "exam", examId: previewExam.id })}>
              এই প্রশ্নপত্র দিয়ে প্র্যাকটিস শুরু করুন →
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="view">
      <h2 className="section-title">পরীক্ষা আর্কাইভ</h2>
      <p className="mode-desc">পূর্ববর্তী বছরের সব প্রশ্নপত্র এক জায়গায় — খুঁজুন, ফিল্টার করুন, দিন যেকোনো সময়।</p>

      <input
        type="text"
        className="smart-search-input"
        placeholder="পরীক্ষার নাম বা প্রতিষ্ঠান দিয়ে খুঁজুন..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="admin-form" style={{ marginTop: 14, marginBottom: 4 }}>
        <div className="form-field" style={{ maxWidth: 220 }}>
          <label>প্রতিষ্ঠান</label>
          <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
            <option value="">সব</option>
            {organizations.map((org) => <option key={org} value={org}>{org}</option>)}
          </select>
        </div>
        <label className="unique-toggle" style={{ alignSelf: "center", marginTop: 18 }}>
          <input type="checkbox" checked={unattendedOnly} onChange={(e) => setUnattendedOnly(e.target.checked)} />
          শুধু যেগুলো এখনো দেওয়া হয়নি
        </label>
      </div>

      {exams.length === 0 ? (
        <p className="mode-desc">
          এখনো কোনো প্রশ্নপত্র যোগ করা হয়নি। Admin Panel থেকে যোগ করুন।
        </p>
      ) : filteredExams.length === 0 ? (
        <p className="mode-desc">এই ফিল্টারে কোনো পরীক্ষা পাওয়া যায়নি।</p>
      ) : (
        <>
          <p className="mode-desc">{toBn(filteredExams.length)}টি পরীক্ষা</p>
          <div className="exam-list">
            {filteredExams.map((exam) => {
              const attended = attendedExamIds.has(exam.id);
              return (
                <div className="exam-item" key={exam.id}>
                  <div>
                    <div className="ei-name">
                      {exam.name}{" "}
                      {!loadingStatus && (
                        <span className={`attend-tag ${attended ? "attended" : "unattended"}`}>
                          {attended ? "✓ দেওয়া হয়েছে" : "দেওয়া হয়নি"}
                        </span>
                      )}
                    </div>
                    <div className="ei-meta">{exam.organization || ""} {exam.year ? `· ${exam.year}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="cta-ghost" onClick={() => openPreview(exam)}>প্রশ্ন দেখুন</button>
                    <button className="cta-primary" onClick={() => onStart({ mode: "exam", examId: exam.id })}>
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
