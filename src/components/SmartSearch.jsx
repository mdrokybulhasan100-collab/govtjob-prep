import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { useApp } from "../lib/AppContext";

const PAGE_SIZE = 50;

export default function SmartSearch() {
  const { user } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const debounceRef = useRef(null);

  useEffect(() => {
    loadFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(0), 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function loadFavoriteIds() {
    const { data } = await supabase.from("favorites").select("question_id").eq("user_id", user.id);
    setFavoriteIds(new Set((data || []).map((f) => f.question_id)));
  }

  async function runSearch(nextPage) {
    setLoading(true);
    setSearched(true);
    setPage(nextPage);
    const { data, error } = await supabase.rpc("smart_search_questions", {
      p_search: query.trim(),
      p_limit: PAGE_SIZE,
      p_offset: nextPage * PAGE_SIZE
    });
    if (!error) setResults(data || []);
    setLoading(false);
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

  return (
    <section className="view">
      <h2 className="section-title">🔍 কুইক সার্চ</h2>
      <p className="mode-desc">
        যেকোনো শব্দ, টপিক বা বিষয় লিখুন — ভুল বানানেও প্রাসঙ্গিক প্রশ্ন খুঁজে দেবে।
      </p>

      <input
        type="text"
        className="smart-search-input"
        placeholder="যেমন: সংবিধান, Grammar, রাজধানী..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {loading && <p className="mode-desc" style={{ marginTop: 16 }}>খোঁজা হচ্ছে...</p>}

      {!loading && searched && results.length === 0 && (
        <p className="mode-desc" style={{ marginTop: 16 }}>কোনো প্রশ্ন পাওয়া যায়নি — অন্য শব্দ দিয়ে চেষ্টা করুন।</p>
      )}

      {!loading && results.length > 0 && (
        <>
          <p className="mode-desc" style={{ marginTop: 16 }}>{toBn(results.length)}টি ফলাফল</p>
          <div className="search-results">
            {results.map((q) => (
              <SearchResultCard
                key={q.id}
                q={q}
                isFav={favoriteIds.has(q.id)}
                onToggleFavorite={() => toggleFavorite(q.id)}
              />
            ))}
          </div>

          <div className="quiz-nav" style={{ justifyContent: "space-between" }}>
            <button className="cta-ghost" disabled={page === 0} onClick={() => runSearch(page - 1)}>← আগের পাতা</button>
            <button className="cta-ghost" disabled={results.length < PAGE_SIZE} onClick={() => runSearch(page + 1)}>পরবর্তী পাতা →</button>
          </div>
        </>
      )}
    </section>
  );
}

export function SearchResultCard({ q, isFav, onToggleFavorite }) {
  return (
    <div className="search-card">
      <div className="search-card-top">
        <div className="search-card-tags">
          {q.subject_name && <span className="chip chip-level" style={{ padding: "4px 10px", fontSize: 12 }}>{q.subject_name}</span>}
          {q.topic_name && <span className="chip chip-level" style={{ padding: "4px 10px", fontSize: 12 }}>{q.topic_name}</span>}
          {q.exam_name && <span className="chip chip-streak" style={{ padding: "4px 10px", fontSize: 12 }}>{q.exam_name}</span>}
        </div>
        <button className={`fav-btn ${isFav ? "active" : ""}`} onClick={onToggleFavorite} title="ফেভারিট করুন">
          {isFav ? "★" : "☆"}
        </button>
      </div>

      <p className="search-card-question">{q.question_text}</p>

      {q.question_type === "short" ? (
        <p className="search-card-answer">
          ✅ সঠিক উত্তর: <strong>{(q.short_answer || "").split(",")[0].trim()}</strong>
          {q.short_answer && q.short_answer.includes(",") && (
            <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}> (এবং আরও গ্রহণযোগ্য বানান)</span>
          )}
        </p>
      ) : (
        <div className="search-card-options">
          {["a", "b", "c", "d"].map((key) => (
            <span key={key} className={`search-option ${q.correct_option === key ? "correct" : ""}`}>
              {key.toUpperCase()}) {q["option_" + key]}
            </span>
          ))}
        </div>
      )}

      {q.explanation && <p className="search-card-explanation">💡 {q.explanation}</p>}
    </div>
  );
}
