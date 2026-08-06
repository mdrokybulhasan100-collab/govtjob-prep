import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { SearchResultCard } from "./SmartSearch";
import { useApp } from "../lib/AppContext";

export default function Favorites() {
  const { user } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("favorites")
      .select("question_id, questions(*, subjects(name_bn), topics(name_bn), exams(name))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const mapped = (data || [])
      .filter((row) => row.questions)
      .map((row) => ({
        ...row.questions,
        subject_name: row.questions.subjects?.name_bn,
        topic_name: row.questions.topics?.name_bn,
        exam_name: row.questions.exams?.name
      }));
    setItems(mapped);
    setLoading(false);
  }

  async function removeFavorite(questionId) {
    await supabase.from("favorites").delete().eq("user_id", user.id).eq("question_id", questionId);
    setItems((prev) => prev.filter((q) => q.id !== questionId));
  }

  return (
    <section className="view">
      <h2 className="section-title">⭐ ফেভারিট প্রশ্ন</h2>
      <p className="mode-desc">যে প্রশ্নগুলো রিভিশনের জন্য মার্ক করেছেন, সেগুলো এখানে দেখুন।</p>

      {loading && <p className="mode-desc">লোড হচ্ছে...</p>}

      {!loading && items.length === 0 && (
        <p className="mode-desc">এখনো কোনো প্রশ্ন ফেভারিট করা হয়নি। কুইক সার্চ থেকে ★ চিহ্নে ক্লিক করে যোগ করুন।</p>
      )}

      {!loading && items.length > 0 && (
        <>
          <p className="mode-desc">{toBn(items.length)}টি প্রশ্ন</p>
          <div className="search-results">
            {items.map((q) => (
              <SearchResultCard key={q.id} q={q} isFav={true} onToggleFavorite={() => removeFavorite(q.id)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
