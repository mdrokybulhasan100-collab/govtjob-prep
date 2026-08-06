import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { SearchResultCard } from "./SmartSearch";
import { useApp } from "../lib/AppContext";

export default function TopicGuru() {
  const { user, subjects, topics, startQuiz: onStartQuiz } = useApp();
  const [subjectId, setSubjectId] = useState(null);
  const [pathIds, setPathIds] = useState([]); // breadcrumb of topic ids, root-first
  const [readTopicIds, setReadTopicIds] = useState(new Set());
  const [studyTopic, setStudyTopic] = useState(null); // { id, name } or null
  const [studyQuestions, setStudyQuestions] = useState([]);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [uniqueOnly, setUniqueOnly] = useState(true);
  const [examOnly, setExamOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all"); // all | mcq | short
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    loadReadTopics();
    loadFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReadTopics() {
    const { data } = await supabase.from("topic_reads").select("topic_id").eq("user_id", user.id);
    setReadTopicIds(new Set((data || []).map((r) => r.topic_id)));
  }

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

  function childrenOf(parentId) {
    return topics
      .filter((t) => t.subject_id === subjectId && (t.parent_topic_id || null) === (parentId || null))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function hasChildren(topicId) {
    return topics.some((t) => t.parent_topic_id === topicId);
  }

  function descendantIds(topicId) {
    const ids = [topicId];
    let frontier = [topicId];
    let guard = 0;
    while (frontier.length && guard < 20) {
      const next = topics.filter((t) => frontier.includes(t.parent_topic_id)).map((t) => t.id);
      ids.push(...next);
      frontier = next;
      guard++;
    }
    return ids;
  }

  const currentTopicId = pathIds[pathIds.length - 1] || null;
  const currentSubject = subjects.find((s) => s.id === subjectId);
  const crumbTopics = pathIds.map((id) => topics.find((t) => t.id === id)).filter(Boolean);

  function goToSubjectList() {
    setSubjectId(null);
    setPathIds([]);
    setStudyTopic(null);
  }
  function selectSubject(id) {
    setSubjectId(id);
    setPathIds([]);
    setStudyTopic(null);
  }
  function drillInto(topicId) {
    setPathIds([...pathIds, topicId]);
    setStudyTopic(null);
  }
  function jumpToCrumb(index) {
    // index -1 = subject root
    setPathIds(index < 0 ? [] : pathIds.slice(0, index + 1));
    setStudyTopic(null);
  }

  async function openStudyMode(topicId, topicName) {
    setLoadingStudy(true);
    setStudyTopic({ id: topicId, name: topicName });

    const ids = descendantIds(topicId);
    const { data } = await supabase
      .from("questions")
      .select("*, subjects(name_bn), topics(name_bn), exams(name)")
      .in("topic_id", ids);

    const mapped = (data || []).map((q) => ({
      ...q,
      subject_name: q.subjects?.name_bn,
      topic_name: q.topics?.name_bn,
      exam_name: q.exams?.name
    }));
    setStudyQuestions(mapped);
    setLoadingStudy(false);

    if (!readTopicIds.has(topicId)) {
      await supabase.from("topic_reads").upsert({ user_id: user.id, topic_id: topicId }, { onConflict: "user_id,topic_id" });
      setReadTopicIds((prev) => new Set(prev).add(topicId));
    }
  }

  const filteredQuestions = studyQuestions
    .filter((q) => (examOnly ? !!q.exam_id : true))
    .filter((q) => (typeFilter === "all" ? true : q.question_type === typeFilter));

  const displayedQuestions = uniqueOnly
    ? Array.from(new Map(filteredQuestions.map((q) => [q.question_text, q])).values())
    : filteredQuestions;

  if (studyTopic) {
    return (
      <section className="view">
        <button className="cta-ghost" onClick={() => setStudyTopic(null)} style={{ marginBottom: 16 }}>← টপিকে ফিরুন</button>
        <h2 className="section-title" style={{ marginTop: 0 }}>{studyTopic.name}</h2>

        <div className="topic-guru-toolbar">
          <label className="unique-toggle">
            <input type="checkbox" checked={uniqueOnly} onChange={(e) => setUniqueOnly(e.target.checked)} />
            শুধু Unique প্রশ্ন দেখান
          </label>
          <label className="unique-toggle">
            <input type="checkbox" checked={examOnly} onChange={(e) => setExamOnly(e.target.checked)} />
            শুধু পরীক্ষায় আসা প্রশ্ন
          </label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid var(--line)", background: "var(--bg)" }}>
            <option value="all">সব ধরনের প্রশ্ন</option>
            <option value="mcq">শুধু MCQ</option>
            <option value="short">শুধু Short Answer</option>
          </select>
          <button className="cta-primary" onClick={() => onStartQuiz({ mode: "topic", topicId: studyTopic.id })}>
            🎲 Random Quiz দিন
          </button>
        </div>

        {loadingStudy && <p className="mode-desc">লোড হচ্ছে...</p>}
        {!loadingStudy && displayedQuestions.length === 0 && (
          <p className="mode-desc">এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি।</p>
        )}
        {!loadingStudy && displayedQuestions.length > 0 && (
          <>
            <p className="mode-desc">{toBn(displayedQuestions.length)}টি প্রশ্ন</p>
            <div className="search-results">
              {displayedQuestions.map((q) => (
                <SearchResultCard
                  key={q.id}
                  q={q}
                  isFav={favoriteIds.has(q.id)}
                  onToggleFavorite={() => toggleFavorite(q.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>
    );
  }

  if (!subjectId) {
    return (
      <section className="view">
        <h2 className="section-title">🧭 টপিক ট্রি</h2>
        <p className="mode-desc">একটা বিষয় বেছে নিন, তারপর টপিক ধরে ধরে গভীরে গিয়ে পড়ুন।</p>
        <div className="subject-grid">
          {subjects.map((s) => (
            <button key={s.id} className="subject-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => selectSubject(s.id)}>
              <span className="sc-name">{s.icon} {s.name_bn}</span>
              <span className="sc-meta">{topics.filter((t) => t.subject_id === s.id && !t.parent_topic_id).length} টা মূল টপিক</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const children = childrenOf(currentTopicId);

  return (
    <section className="view">
      <div className="tg-breadcrumb">
        <button onClick={goToSubjectList}>বিষয় তালিকা</button>
        <span>/</span>
        <button onClick={() => jumpToCrumb(-1)} className={pathIds.length === 0 ? "active" : ""}>
          {currentSubject?.icon} {currentSubject?.name_bn}
        </button>
        {crumbTopics.map((t, i) => (
          <span key={t.id} style={{ display: "contents" }}>
            <span>/</span>
            <button onClick={() => jumpToCrumb(i)} className={i === crumbTopics.length - 1 ? "active" : ""}>{t.name_bn}</button>
          </span>
        ))}
      </div>

      {currentTopicId && (
        <div className="tg-current-actions">
          {readTopicIds.has(currentTopicId) && <span className="chip chip-level" style={{ padding: "4px 10px", fontSize: 12 }}>✓ পঠিত</span>}
          <button className="cta-primary" onClick={() => openStudyMode(currentTopicId, crumbTopics[crumbTopics.length - 1]?.name_bn)}>
            📖 এই টপিকের সব প্রশ্ন পড়ুন
          </button>
        </div>
      )}

      {children.length === 0 ? (
        <p className="mode-desc" style={{ marginTop: 16 }}>
          {currentTopicId ? "এই টপিকের কোনো সাব-টপিক নেই — উপরের বাটনে ক্লিক করে প্রশ্ন পড়ুন।" : "এই বিষয়ে এখনো কোনো টপিক যোগ করা হয়নি।"}
        </p>
      ) : (
        <div className="pick-list" style={{ marginTop: 16 }}>
          {children.map((t) => (
            <button key={t.id} className="pick-item" onClick={() => drillInto(t.id)}>
              <span style={{ flex: 1 }}>{t.name_bn}</span>
              {readTopicIds.has(t.id) && <span title="পঠিত">✓</span>}
              {hasChildren(t.id) ? <span style={{ color: "var(--ink-soft)" }}>›</span> : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
