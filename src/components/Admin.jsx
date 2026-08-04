import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const TABS = [
  { key: "subjects", label: "বিষয়" },
  { key: "topics", label: "টপিক" },
  { key: "exams", label: "প্রশ্নপত্র" },
  { key: "questions", label: "প্রশ্ন" }
];

export default function Admin({ subjects, topics, exams, refreshAll }) {
  const [tab, setTab] = useState("subjects");
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text }

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <section className="view">
      <h2 className="section-title">Admin Panel</h2>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`admin-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && <div className={`admin-msg ${msg.type}`}>{msg.text}</div>}

      <div className="admin-panel">
        {tab === "subjects" && (
          <SubjectsTab subjects={subjects} refreshAll={refreshAll} flash={flash} />
        )}
        {tab === "topics" && (
          <TopicsTab subjects={subjects} topics={topics} refreshAll={refreshAll} flash={flash} />
        )}
        {tab === "exams" && (
          <ExamsTab exams={exams} refreshAll={refreshAll} flash={flash} />
        )}
        {tab === "questions" && (
          <QuestionsTab subjects={subjects} topics={topics} exams={exams} flash={flash} />
        )}
      </div>
    </section>
  );
}

// ============================================================
// SUBJECTS
// ============================================================
function SubjectsTab({ subjects, refreshAll, flash }) {
  const [form, setForm] = useState({ name_bn: "", name_en: "", slug: "", icon: "📘" });

  async function addSubject() {
    if (!form.name_bn || !form.slug) return flash("err", "নাম ও slug আবশ্যক");
    const { error } = await supabase.from("subjects").insert({ ...form, sort_order: subjects.length + 1 });
    if (error) return flash("err", error.message);
    flash("ok", "বিষয় যোগ হয়েছে");
    setForm({ name_bn: "", name_en: "", slug: "", icon: "📘" });
    refreshAll();
  }

  async function deleteSubject(id) {
    if (!confirm("এই বিষয় ও এর সব টপিক/প্রশ্ন মুছে যাবে। নিশ্চিত?")) return;
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "মুছে ফেলা হয়েছে");
    refreshAll();
  }

  return (
    <div>
      <div className="admin-form">
        <div className="form-field"><label>বাংলা নাম</label>
          <input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} placeholder="যেমন: বাংলা" />
        </div>
        <div className="form-field"><label>English নাম</label>
          <input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="e.g. Bangla" />
        </div>
        <div className="form-field"><label>Slug (unique)</label>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="bangla" />
        </div>
        <div className="form-field" style={{ maxWidth: 80 }}><label>আইকন</label>
          <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
        </div>
        <button className="cta-primary" onClick={addSubject}>+ যোগ করুন</button>
      </div>

      <table className="admin-table">
        <thead><tr><th>আইকন</th><th>নাম</th><th>Slug</th><th></th></tr></thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.id}>
              <td>{s.icon}</td>
              <td>{s.name_bn} <span style={{ color: "var(--ink-soft)" }}>({s.name_en})</span></td>
              <td><code>{s.slug}</code></td>
              <td><button className="cta-danger" onClick={() => deleteSubject(s.id)}>মুছুন</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// TOPICS
// ============================================================
function TopicsTab({ subjects, topics, refreshAll, flash }) {
  const [form, setForm] = useState({ subject_id: "", name_bn: "", name_en: "" });

  async function addTopic() {
    if (!form.subject_id || !form.name_bn) return flash("err", "বিষয় ও নাম আবশ্যক");
    const { error } = await supabase.from("topics").insert(form);
    if (error) return flash("err", error.message);
    flash("ok", "টপিক যোগ হয়েছে");
    setForm({ subject_id: "", name_bn: "", name_en: "" });
    refreshAll();
  }

  async function deleteTopic(id) {
    if (!confirm("এই টপিক মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("topics").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "মুছে ফেলা হয়েছে");
    refreshAll();
  }

  const subjectName = (id) => subjects.find((s) => s.id === id)?.name_bn || "—";

  return (
    <div>
      <div className="admin-form">
        <div className="form-field"><label>বিষয়</label>
          <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
            <option value="">বেছে নিন</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_bn}</option>)}
          </select>
        </div>
        <div className="form-field"><label>বাংলা নাম</label>
          <input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} placeholder="যেমন: ব্যাকরণ" />
        </div>
        <div className="form-field"><label>English নাম</label>
          <input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="e.g. Grammar" />
        </div>
        <button className="cta-primary" onClick={addTopic}>+ যোগ করুন</button>
      </div>

      <table className="admin-table">
        <thead><tr><th>বিষয়</th><th>টপিক</th><th></th></tr></thead>
        <tbody>
          {topics.map((t) => (
            <tr key={t.id}>
              <td>{subjectName(t.subject_id)}</td>
              <td>{t.name_bn} <span style={{ color: "var(--ink-soft)" }}>({t.name_en})</span></td>
              <td><button className="cta-danger" onClick={() => deleteTopic(t.id)}>মুছুন</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// EXAMS
// ============================================================
function ExamsTab({ exams, refreshAll, flash }) {
  const [form, setForm] = useState({ name: "", organization: "", year: "", slug: "" });

  async function addExam() {
    if (!form.name || !form.slug) return flash("err", "নাম ও slug আবশ্যক");
    const { error } = await supabase.from("exams").insert({ ...form, year: form.year ? Number(form.year) : null });
    if (error) return flash("err", error.message);
    flash("ok", "প্রশ্নপত্র যোগ হয়েছে");
    setForm({ name: "", organization: "", year: "", slug: "" });
    refreshAll();
  }

  async function deleteExam(id) {
    if (!confirm("এই প্রশ্নপত্র মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "মুছে ফেলা হয়েছে");
    refreshAll();
  }

  return (
    <div>
      <div className="admin-form">
        <div className="form-field"><label>নাম</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="৪৪তম বিসিএস প্রিলিমিনারি" />
        </div>
        <div className="form-field"><label>প্রতিষ্ঠান</label>
          <input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="BPSC" />
        </div>
        <div className="form-field" style={{ maxWidth: 100 }}><label>বছর</label>
          <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024" />
        </div>
        <div className="form-field"><label>Slug (unique)</label>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="bcs-44-preli" />
        </div>
        <button className="cta-primary" onClick={addExam}>+ যোগ করুন</button>
      </div>

      <table className="admin-table">
        <thead><tr><th>নাম</th><th>প্রতিষ্ঠান</th><th>বছর</th><th>Slug</th><th></th></tr></thead>
        <tbody>
          {exams.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>{e.organization}</td>
              <td>{e.year}</td>
              <td><code>{e.slug}</code></td>
              <td><button className="cta-danger" onClick={() => deleteExam(e.id)}>মুছুন</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// QUESTIONS (single add + JSON bulk upload)
// ============================================================
const SAMPLE_JSON = `[
  {
    "subject_slug": "bangla",
    "topic_name_en": "Grammar",
    "exam_slug": "",
    "question_text": "প্রশ্নটি এখানে লিখুন",
    "option_a": "ক", "option_b": "খ", "option_c": "গ", "option_d": "ঘ",
    "correct_option": "a",
    "explanation": "ব্যাখ্যা (ঐচ্ছিক)",
    "difficulty": "easy"
  }
]`;

function QuestionsTab({ subjects, topics, exams, flash }) {
  const [form, setForm] = useState({
    subject_id: "", topic_id: "", exam_id: "",
    question_text: "", option_a: "", option_b: "", option_c: "", option_d: "",
    correct_option: "a", explanation: "", difficulty: "medium"
  });
  const [jsonText, setJsonText] = useState(SAMPLE_JSON);
  const [uploading, setUploading] = useState(false);

  const topicsForSubject = topics.filter((t) => t.subject_id === form.subject_id);

  async function addQuestion() {
    const required = ["subject_id", "question_text", "option_a", "option_b", "option_c", "option_d", "correct_option"];
    if (required.some((k) => !form[k])) return flash("err", "বিষয়, প্রশ্ন, ৪টা অপশন ও সঠিক উত্তর আবশ্যক");
    const payload = { ...form, topic_id: form.topic_id || null, exam_id: form.exam_id || null };
    const { error } = await supabase.from("questions").insert(payload);
    if (error) return flash("err", error.message);
    flash("ok", "প্রশ্ন যোগ হয়েছে");
    setForm({ ...form, question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", explanation: "" });
  }

  async function bulkUpload() {
    setUploading(true);
    try {
      const items = JSON.parse(jsonText);
      if (!Array.isArray(items)) throw new Error("JSON অবশ্যই একটা array হতে হবে");

      const rows = [];
      const skipped = [];
      items.forEach((item, i) => {
        const subject = subjects.find((s) => s.slug === item.subject_slug);
        if (!subject) { skipped.push(`#${i + 1}: subject_slug "${item.subject_slug}" পাওয়া যায়নি`); return; }
        let topicId = null;
        if (item.topic_name_en) {
          const topic = topics.find((t) => t.subject_id === subject.id && t.name_en === item.topic_name_en);
          if (topic) topicId = topic.id;
        }
        let examId = null;
        if (item.exam_slug) {
          const exam = exams.find((e) => e.slug === item.exam_slug);
          if (exam) examId = exam.id;
        }
        if (!item.question_text || !item.option_a || !item.option_b || !item.option_c || !item.option_d || !item.correct_option) {
          skipped.push(`#${i + 1}: প্রয়োজনীয় ফিল্ড অনুপস্থিত`);
          return;
        }
        rows.push({
          subject_id: subject.id,
          topic_id: topicId,
          exam_id: examId,
          question_text: item.question_text,
          option_a: item.option_a, option_b: item.option_b, option_c: item.option_c, option_d: item.option_d,
          correct_option: item.correct_option,
          explanation: item.explanation || null,
          difficulty: item.difficulty || "medium"
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
        <div className="form-field"><label>বিষয়</label>
          <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, topic_id: "" })}>
            <option value="">বেছে নিন</option>
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
        <div className="form-field" style={{ maxWidth: 140 }}><label>কঠিনতা</label>
          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
            <option value="easy">সহজ</option><option value="medium">মাঝারি</option><option value="hard">কঠিন</option>
          </select>
        </div>
        <div className="form-field" style={{ minWidth: 240 }}><label>ব্যাখ্যা (ঐচ্ছিক)</label>
          <input value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
        </div>
      </div>
      <button className="cta-primary" onClick={addQuestion}>+ প্রশ্ন যোগ করুন</button>

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <h3>Bulk Upload (JSON)</h3>
      <p className="mode-desc">
        একসাথে অনেক প্রশ্ন যোগ করতে নিচের ফরম্যাটে JSON বসান। <code>subject_slug</code> অবশ্যই Subjects
        ট্যাবে থাকা কোনো slug-এর সাথে মিলতে হবে। <code>topic_name_en</code> ও <code>exam_slug</code> ঐচ্ছিক।
      </p>
      <div className="form-field">
        <textarea
          style={{ minHeight: 220 }}
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
