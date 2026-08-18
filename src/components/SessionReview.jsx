import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { SearchResultCard } from "./SmartSearch";
import { useApp } from "../lib/AppContext";

export default function SessionReview() {
  const { user, lastResult, setView } = useApp();
  const sessionId = lastResult?.sessionId;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    load();
    loadFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("session_answers")
      .select("is_correct, selected_option, questions(*, subjects(name_bn), topics(name_bn), exams(name))")
      .eq("session_id", sessionId)
      .or("is_correct.eq.false,is_correct.is.null");

    const mapped = (data || [])
      .filter((row) => row.questions)
      .map((row) => ({
        ...row.questions,
        subject_name: row.questions.subjects?.name_bn,
        topic_name: row.questions.topics?.name_bn,
        exam_name: row.questions.exams?.name,
        wasSkipped: row.is_correct === null
      }));
    setItems(mapped);
    setLoading(false);
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

  return (
    <section className="view">
      <button className="cta-ghost" onClick={() => setView("dashboard")} style={{ marginBottom: 16 }}>← ড্যাশবোর্ডে ফিরুন</button>
      <h2 className="section-title" style={{ marginTop: 0 }}>❌ ভুল ও বাদ পড়া প্রশ্ন</h2>
      <p className="mode-desc">এই সেশনে যা ভুল হয়েছে বা এড়িয়ে গিয়েছিলেন, শুধু সেগুলোই এখানে।</p>

      {loading && <p className="mode-desc">লোড হচ্ছে...</p>}
      {!loading && items.length === 0 && (
        <p className="mode-desc">দারুণ! এই সেশনে কোনো ভুল বা বাদ পড়া প্রশ্ন নেই।</p>
      )}
      {!loading && items.length > 0 && (
        <>
          <p className="mode-desc">{toBn(items.length)}টি প্রশ্ন</p>
          <div className="search-results">
            {items.map((q) => (
              <div key={q.id} className="session-review-item">
                <span className={`attend-tag ${q.wasSkipped ? "unattended" : ""}`} style={{ marginBottom: 8, display: "inline-block" }}>
                  {q.wasSkipped ? "❔ এড়িয়ে গিয়েছিলেন" : "❌ ভুল হয়েছিল"}
                </span>
                <SearchResultCard q={q} isFav={favoriteIds.has(q.id)} onToggleFavorite={() => toggleFavorite(q.id)} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
