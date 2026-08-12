import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { SearchResultCard } from "./SmartSearch";
import { useApp } from "../lib/AppContext";

export default function Favorites() {
  const { user, setView, startPractice } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("question_knowledge")
      .select("question_id, questions(*, subjects(name_bn), topics(name_bn), exams(name))")
      .eq("user_id", user.id)
      .eq("status", "unknown")
      .order("updated_at", { ascending: false });

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
    await supabase.from("question_knowledge").delete().eq("user_id", user.id).eq("question_id", questionId);
    setItems((prev) => prev.filter((q) => q.id !== questionId));
  }

  function practiceThese() {
    if (startPractice) startPractice({ mode: "unknown" });
  }

  return (
    <section className="view">
      <h2 className="section-title">🔖 রিভিশন লিস্ট</h2>
      <p className="mode-desc">যে প্রশ্নগুলো কঠিন মনে হয়েছে বা "জানতাম না" মার্ক করেছেন, সেগুলো এখানে দেখুন — বারবার প্র্যাকটিস করার জন্য।</p>

      {loading && <p className="mode-desc">লোড হচ্ছে...</p>}

      {!loading && items.length === 0 && (
        <p className="mode-desc">
          এখনো কোনো প্রশ্ন এখানে নেই। প্র্যাকটিসের সময় "জানতাম না" চাপলে, বা কুইক সার্চে ★ চিহ্নে ক্লিক করলে এখানে যোগ হবে।
        </p>
      )}

      {!loading && items.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <p className="mode-desc" style={{ margin: 0 }}>{toBn(items.length)}টি প্রশ্ন</p>
            <button className="cta-primary" onClick={practiceThese}>🔁 এগুলো প্র্যাকটিস করুন</button>
          </div>
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
