import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const SAMPLE_JSON = `[
  {
    "question_type": "mcq",
    "subject_slug": "bangla",
    "topic_name_en": "Grammar",
    "exam_slug": "",
    "question_text": "প্রশ্নটি এখানে লিখুন",
    "option_a": "ক", "option_b": "খ", "option_c": "গ", "option_d": "ঘ",
    "correct_option": "a",
    "explanation": "ব্যাখ্যা (ঐচ্ছিক)"
  },
  {
    "question_type": "mcq",
    "exam_slug": "bcs-44-preli",
    "question_text": "এটা একটা exam-only প্রশ্ন — subject_slug ছাড়াই, শুধু exam_slug দিয়ে যুক্ত",
    "option_a": "ক", "option_b": "খ", "option_c": "গ", "option_d": "ঘ",
    "correct_option": "b",
    "explanation": ""
  },
  {
    "question_type": "short",
    "exam_slug": "bcs-44-preli",
    "question_text": "বাংলাদেশের রাজধানীর নাম কী?",
    "short_answer": "ঢাকা",
    "explanation": ""
  }
]`;

const EMPTY_QUESTION_FORM = {
  subject_id: "", topic_id: "", exam_id: "", question_type: "mcq",
  question_text: "", option_a: "", option_b: "", option_c: "", option_d: "",
  correct_option: "a", short_answer: "", explanation: ""
};

export default function QuestionsTab({ subjects, topics, exams, flash }) {
  const [form, setForm] = useState(EMPTY_QUESTION_FORM);
  const [jsonText, setJsonText] = useState(SAMPLE_JSON);
  const [uploading, setUploading] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterExam, setFilterExam] = useState("");

  const topicsForSubject = topics.filter((t) => t.subject_id === form.subject_id);
  const isShort = form.question_type === "short";

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuestions() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("questions")
      .select("*, subjects(name_bn), topics(name_bn), exams(name)")
      .order("created_at", { ascending: false });
    if (!error) setQuestions(data || []);
    setLoadingList(false);
  }

  async function deleteQuestion(id) {
    if (!confirm("এই প্রশ্ন মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "প্রশ্ন মুছে ফেলা হয়েছে");
    loadQuestions();
  }

  const filteredQuestions = questions.filter((q) => {
    if (filterSubject && q.subject_id !== filterSubject) return false;
    if (filterExam && q.exam_id !== filterExam) return false;
    return true;
  });

  async function addQuestion() {
    if (!form.question_text) return flash("err", "প্রশ্ন আবশ্যক");
    if (isShort && !form.short_answer) return flash("err", "সঠিক উত্তর আবশ্যক");
    if (!isShort && (!form.option_a || !form.option_b || !form.option_c || !form.option_d || !form.correct_option)) {
      return flash("err", "৪টা অপশন ও সঠিক উত্তর আবশ্যক");
    }

    const payload = {
      subject_id: form.subject_id || null,
      topic_id: form.topic_id || null,
      exam_id: form.exam_id || null,
      question_type: form.question_type,
      question_text: form.question_text,
      explanation: form.explanation || null,
      option_a: isShort ? null : form.option_a,
      option_b: isShort ? null : form.option_b,
      option_c: isShort ? null : form.option_c,
      option_d: isShort ? null : form.option_d,
      correct_option: isShort ? null : form.correct_option,
      short_answer: isShort ? form.short_answer : null
    };

    const { error } = await supabase.from("questions").insert(payload);
    if (error) return flash("err", error.message);
    flash("ok", "প্রশ্ন যোগ হয়েছে");
    setForm({ ...form, question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", short_answer: "", explanation: "" });
    loadQuestions();
  }

  async function bulkUpload() {
    setUploading(true);
    try {
      const items = JSON.parse(jsonText);
      if (!Array.isArray(items)) throw new Error("JSON অবশ্যই একটা array হতে হবে");

      const rows = [];
      const skipped = [];
      items.forEach((item, i) => {
        if (!item.question_text) { skipped.push(`#${i + 1}: question_text অনুপস্থিত`); return; }

        let subjectId = null;
        if (item.subject_slug) {
          const subject = subjects.find((s) => s.slug === item.subject_slug);
          if (!subject) { skipped.push(`#${i + 1}: subject_slug "${item.subject_slug}" পাওয়া যায়নি`); return; }
          subjectId = subject.id;
        }

        const type = item.question_type === "short" ? "short" : "mcq";
        if (type === "short" && !item.short_answer) { skipped.push(`#${i + 1}: short_answer অনুপস্থিত`); return; }
        if (type === "mcq" && (!item.option_a || !item.option_b || !item.option_c || !item.option_d || !item.correct_option)) {
          skipped.push(`#${i + 1}: ৪টা অপশন ও correct_option আবশ্যক`);
          return;
        }

        let topicId = null;
        if (item.topic_name_en && subjectId) {
          const topic = topics.find((t) => t.subject_id === subjectId && t.name_en === item.topic_name_en);
          if (topic) topicId = topic.id;
        }
        let examId = null;
        if (item.exam_slug) {
          const exam = exams.find((e) => e.slug === item.exam_slug);
          if (exam) examId = exam.id;
        }

        rows.push({
          subject_id: subjectId,
          topic_id: topicId,
          exam_id: examId,
          question_type: type,
          question_text: item.question_text,
          option_a: type === "mcq" ? item.option_a : null,
          option_b: type === "mcq" ? item.option_b : null,
          option_c: type === "mcq" ? item.option_c : null,
          option_d: type === "mcq" ? item.option_d : null,
          correct_option: type === "mcq" ? item.correct_option : null,
          short_answer: type === "short" ? item.short_answer : null,
          explanation: item.explanation || null
        });
      });

      if (rows.length) {
        const { error } = await supabase.from("questions").insert(rows);
        if (error) throw error;
      }

      flash(
        skipped.length ? "err" : "ok",
        `${rows.length}টি প্রশ্ন যোগ হয়েছে।` + (skipped.length ? ` ${skipped.length}টি বাদ পড়েছে: ${skipped.join("; ")}` : "")
      );
      loadQuestions();
    } catch (err) {
      flash("err", "JSON পড়তে সমস্যা: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>একটা প্রশ্ন যোগ করুন</h3>
      <div className="admin-form">
        <div className="form-field" style={{ maxWidth: 180 }}><label>প্রশ্নের ধরন</label>
          <select value={form.question_type} onChange={(e) => setForm({ ...form, question_type: e.target.value })}>
            <option value="mcq">MCQ (৪টা অপশন)</option>
            <option value="short">Short Answer (সরাসরি উত্তর)</option>
          </select>
        </div>
        <div className="form-field"><label>বিষয় (ঐচ্ছিক)</label>
          <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, topic_id: "" })}>
            <option value="">কোনোটা না (শুধু exam-এর সাথে যুক্ত)</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_bn}</option>)}
          </select>
        </div>
        <div className="form-field"><label>টপিক (ঐচ্ছিক)</label>
          <select value={form.topic_id} onChange={(e) => setForm({ ...form, topic_id: e.target.value })}>
            <option value="">কোনোটা না</option>
            {topicsForSubject.map((t) => <option key={t.id} value={t.id}>{t.name_bn}</option>)}
          </select>
        </div>
        <div className="form-field"><label>প্রশ্নপত্র (ঐচ্ছিক)</label>
          <select value={form.exam_id} onChange={(e) => setForm({ ...form, exam_id: e.target.value })}>
            <option value="">কোনোটা না</option>
            {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
      </div>
      <div className="admin-form">
        <div className="form-field" style={{ minWidth: "100%" }}><label>প্রশ্ন</label>
          <textarea value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} />
        </div>
      </div>

      {isShort ? (
        <div className="admin-form">
          <div className="form-field" style={{ minWidth: 280 }}><label>সঠিক উত্তর</label>
            <input value={form.short_answer} onChange={(e) => setForm({ ...form, short_answer: e.target.value })} placeholder="যেমন: ঢাকা" />
          </div>
          <div className="form-field" style={{ minWidth: 240 }}><label>ব্যাখ্যা (ঐচ্ছিক)</label>
            <input value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          </div>
        </div>
      ) : (
        <>
          <div className="admin-form">
            <div className="form-field"><label>অপশন A</label><input value={form.option_a} onChange={(e) => setForm({ ...form, option_a: e.target.value })} /></div>
            <div className="form-field"><label>অপশন B</label><input value={form.option_b} onChange={(e) => setForm({ ...form, option_b: e.target.value })} /></div>
            <div className="form-field"><label>অপশন C</label><input value={form.option_c} onChange={(e) => setForm({ ...form, option_c: e.target.value })} /></div>
            <div className="form-field"><label>অপশন D</label><input value={form.option_d} onChange={(e) => setForm({ ...form, option_d: e.target.value })} /></div>
          </div>
          <div className="admin-form">
            <div className="form-field" style={{ maxWidth: 140 }}><label>সঠিক উত্তর</label>
              <select value={form.correct_option} onChange={(e) => setForm({ ...form, correct_option: e.target.value })}>
                <option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option>
              </select>
            </div>
            <div className="form-field" style={{ minWidth: 240 }}><label>ব্যাখ্যা (ঐচ্ছিক)</label>
              <input value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
            </div>
          </div>
        </>
      )}

      <button className="cta-primary" onClick={addQuestion}>+ প্রশ্ন যোগ করুন</button>

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <h3 style={{ marginTop: 0 }}>যোগ করা প্রশ্নসমূহ ({filteredQuestions.length})</h3>
      <div className="admin-form">
        <div className="form-field"><label>বিষয় দিয়ে ফিল্টার</label>
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">সব</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_bn}</option>)}
          </select>
        </div>
        <div className="form-field"><label>প্রশ্নপত্র দিয়ে ফিল্টার</label>
          <select value={filterExam} onChange={(e) => setFilterExam(e.target.value)}>
            <option value="">সব</option>
            {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
      </div>

      {loadingList ? (
        <p className="mode-desc">লোড হচ্ছে...</p>
      ) : filteredQuestions.length === 0 ? (
        <p className="mode-desc">কোনো প্রশ্ন পাওয়া যায়নি।</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ধরন</th>
              <th>প্রশ্ন</th>
              <th>বিষয় / টপিক</th>
              <th>প্রশ্নপত্র</th>
              <th>সঠিক উত্তর</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredQuestions.map((q) => (
              <tr key={q.id}>
                <td>{q.question_type === "short" ? "Short" : "MCQ"}</td>
                <td style={{ maxWidth: 280 }}>{q.question_text}</td>
                <td>
                  {q.subjects?.name_bn || "—"}
                  {q.topics?.name_bn ? ` / ${q.topics.name_bn}` : ""}
                </td>
                <td>{q.exams?.name || "—"}</td>
                <td>
                  {q.question_type === "short"
                    ? q.short_answer
                    : `${q.correct_option?.toUpperCase()}) ${q["option_" + q.correct_option] || ""}`}
                </td>
                <td><button className="cta-danger" onClick={() => deleteQuestion(q.id)}>মুছুন</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <h3>Bulk Upload (JSON)</h3>
      <p className="mode-desc">
        একসাথে অনেক প্রশ্ন যোগ করতে নিচের ফরম্যাটে JSON বসান। <code>question_type</code> না দিলে
        ধরে নেওয়া হবে <code>mcq</code>। <code>subject_slug</code> অবশ্যই Subjects ট্যাবে থাকা কোনো
        slug-এর সাথে মিলতে হবে। <code>topic_name_en</code> ও <code>exam_slug</code> ঐচ্ছিক।
      </p>
      <div className="form-field">
        <textarea
          style={{ minHeight: 260 }}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
      </div>
      <button className="cta-primary" disabled={uploading} onClick={bulkUpload} style={{ marginTop: 10 }}>
        {uploading ? "আপলোড হচ্ছে..." : "JSON আপলোড করুন"}
      </button>
    </div>
  );
}
