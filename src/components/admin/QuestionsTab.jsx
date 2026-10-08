import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { banglaToLatin } from "../../lib/utils";

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
    "short_answer": "ঢাকা, Dhaka, dhaka",
    "explanation": ""
  }
]`;

const EMPTY_QUESTION_FORM = {
  subject_id: "", topic_id: "", exam_id: "", question_type: "mcq",
  question_text: "", option_a: "", option_b: "", option_c: "", option_d: "",
  correct_option: "a", short_answer: "", explanation: ""
};

const QUESTION_DRAFT_KEY = "govtjobprep:question-import-draft:v1";
const QUESTION_IMAGES_KEY = "govtjobprep:question-import-images:v1";

function safeReadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function safeWriteStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

function dataUrlFromBase64(mimeType, data) {
  return `data:${mimeType || "image/jpeg"};base64,${data}`;
}

export default function QuestionsTab({ subjects, topics, exams, flash }) {
  const [form, setForm] = useState(EMPTY_QUESTION_FORM);
  const [editingId, setEditingId] = useState(null);
  const [jsonText, setJsonText] = useState(SAMPLE_JSON);
  const [uploading, setUploading] = useState(false);
  const [bookImages, setBookImages] = useState([]);
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [extracting, setExtracting] = useState(false);

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

  // Restore in-progress question-import work after a browser tab/page reload.
  useEffect(() => {
    const draft = safeReadStorage(QUESTION_DRAFT_KEY, null);
    if (draft) {
      if (Array.isArray(draft.extractedQuestions)) setExtractedQuestions(draft.extractedQuestions);
      if (draft.form) setForm({ ...EMPTY_QUESTION_FORM, ...draft.form });
      if (typeof draft.jsonText === "string") setJsonText(draft.jsonText);
      if (typeof draft.filterSubject === "string") setFilterSubject(draft.filterSubject);
      if (typeof draft.filterExam === "string") setFilterExam(draft.filterExam);
      if (typeof draft.editingId === "string" || draft.editingId === null) setEditingId(draft.editingId);
    }

    const savedImages = safeReadStorage(QUESTION_IMAGES_KEY, []);
    if (Array.isArray(savedImages) && savedImages.length) {
      setBookImages(savedImages.map((img) => ({
        ...img,
        previewUrl: dataUrlFromBase64(img.mimeType, img.data)
      })));
    }
  }, []);

  // Persist all editable question-import state so switching tabs or an unexpected
  // page reload does not erase extracted questions/metadata.
  useEffect(() => {
    safeWriteStorage(QUESTION_DRAFT_KEY, {
      extractedQuestions, form, jsonText, filterSubject, filterExam, editingId
    });
  }, [extractedQuestions, form, jsonText, filterSubject, filterExam, editingId]);

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
    if (editingId === id) cancelEdit();
    loadQuestions();
  }

  const filteredQuestions = questions.filter((q) => {
    if (filterSubject && q.subject_id !== filterSubject) return false;
    if (filterExam && q.exam_id !== filterExam) return false;
    return true;
  });

  function startEdit(q) {
    setEditingId(q.id);
    setForm({
      subject_id: q.subject_id || "",
      topic_id: q.topic_id || "",
      exam_id: q.exam_id || "",
      question_type: q.question_type,
      question_text: q.question_text,
      option_a: q.option_a || "",
      option_b: q.option_b || "",
      option_c: q.option_c || "",
      option_d: q.option_d || "",
      correct_option: q.correct_option || "a",
      short_answer: q.short_answer || "",
      explanation: q.explanation || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_QUESTION_FORM);
  }

  async function saveQuestion() {
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

    if (editingId) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editingId);
      if (error) return flash("err", error.message);
      flash("ok", "প্রশ্ন আপডেট হয়েছে");
      setEditingId(null);
      setForm(EMPTY_QUESTION_FORM);
    } else {
      const { error } = await supabase.from("questions").insert(payload);
      if (error) return flash("err", error.message);
      flash("ok", "প্রশ্ন যোগ হয়েছে");
      setForm({ ...form, question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", short_answer: "", explanation: "" });
    }
    loadQuestions();
  }

  function compressImage(file, maxSide = 1800, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("ছবি পড়তে সমস্যা হয়েছে"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("ছবিটি পড়া যায়নি"));
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error("ছবি compress করা যায়নি"));
            const r = new FileReader();
            r.onload = () => resolve({
              mimeType: "image/jpeg",
              data: String(r.result).split(",")[1],
              previewUrl: URL.createObjectURL(blob),
              name: file.name
            });
            r.onerror = () => reject(new Error("ছবি প্রস্তুত করা যায়নি"));
            r.readAsDataURL(blob);
          }, "image/jpeg", quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleBookImages(e) {
    const files = Array.from(e.target.files || []).slice(0, 10);
    if (!files.length) return;
    setExtractedQuestions([]);
    try {
      const prepared = [];
      for (const file of files) prepared.push(await compressImage(file));
      setBookImages(prepared);
      safeWriteStorage(QUESTION_IMAGES_KEY, prepared.map(({ mimeType, data, name }) => ({ mimeType, data, name })));
    } catch (err) {
      flash("err", err.message);
    } finally {
      e.target.value = "";
    }
  }

  async function extractFromBook() {
    if (!bookImages.length) return flash("err", "আগে বইয়ের ছবি নির্বাচন করুন");
    setExtracting(true);
    try {
      const all = [];
      for (let i = 0; i < bookImages.length; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Session expired. আবার login করুন।");
        const res = await fetch("/api/extract-questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ image: { mimeType: bookImages[i].mimeType, data: bookImages[i].data } })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`পৃষ্ঠা ${i + 1}: ${data.error || "extract failed"}`);
        all.push(...(data.questions || []).map((q) => ({ ...q, _sourcePage: i + 1 })));
      }
      setExtractedQuestions(all.map((q) => ({
        ...q,
        subject_id: "",
        topic_id: "",
        exam_id: "",
        question_type: q.question_type === "short" ? "short" : "mcq"
      })));
      flash("ok", `${all.length}টি প্রশ্ন extract হয়েছে। এখন প্রতিটি প্রশ্নের বিষয়, টপিক, প্রশ্নপত্র ও ধরন আলাদাভাবে সেট করুন।`);
    } catch (err) {
      flash("err", err.message);
    } finally {
      setExtracting(false);
    }
  }

  function updateExtracted(index, key, value) {
    setExtractedQuestions((prev) => prev.map((q, i) => i === index ? { ...q, [key]: value } : q));
  }

  function removeExtracted(index) {
    setExtractedQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadExtractedQuestions() {
    if (!extractedQuestions.length) return flash("err", "আগে প্রশ্ন extract করুন");
    setUploading(true);
    try {
      const rows = [];
      const skipped = [];
      extractedQuestions.forEach((q, i) => {
        const type = q.question_type === "short" ? "short" : "mcq";
        if (!q.question_text) { skipped.push(`#${i + 1}: প্রশ্ন নেই`); return; }
        if (type === "short" && !q.short_answer) { skipped.push(`#${i + 1}: সঠিক উত্তর নেই`); return; }
        if (type === "mcq" && (!q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option)) {
          skipped.push(`#${i + 1}: ৪টি অপশন ও সঠিক উত্তর দিন`); return;
        }
        rows.push({
          subject_id: q.subject_id || null,
          topic_id: q.topic_id || null,
          exam_id: q.exam_id || null,
          question_type: type,
          question_text: q.question_text.trim(),
          option_a: type === "mcq" ? q.option_a : null,
          option_b: type === "mcq" ? q.option_b : null,
          option_c: type === "mcq" ? q.option_c : null,
          option_d: type === "mcq" ? q.option_d : null,
          correct_option: type === "mcq" ? q.correct_option : null,
          short_answer: type === "short" ? q.short_answer : null,
          explanation: q.explanation || null
        });
      });
      if (!rows.length) throw new Error("Upload করার মতো valid প্রশ্ন নেই।");
      const { error } = await supabase.from("questions").insert(rows);
      if (error) throw error;
      flash("ok", `${rows.length}টি প্রশ্ন সফলভাবে যোগ হয়েছে।` + (skipped.length ? ` ${skipped.length}টি বাদ গেছে।` : ""));
      setExtractedQuestions([]);
      setBookImages([]);
      try { localStorage.removeItem(QUESTION_DRAFT_KEY); } catch (_) {}
      try { localStorage.removeItem(QUESTION_IMAGES_KEY); } catch (_) {}
      loadQuestions();
    } catch (err) {
      flash("err", "প্রশ্ন upload করতে সমস্যা: " + err.message);
    } finally {
      setUploading(false);
    }
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
      <h3 style={{ marginTop: 0 }}>{editingId ? "প্রশ্ন এডিট করুন" : "একটা প্রশ্ন যোগ করুন"}</h3>
      {editingId && (
        <div className="admin-msg" style={{ background: "var(--indigo-soft)", color: "var(--indigo-deep)" }}>
          ✏️ এডিট মোড — পরিবর্তন শেষে Save চাপুন, অথবা Cancel করুন
        </div>
      )}
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
          <div className="form-field" style={{ minWidth: 280 }}><label>সঠিক উত্তর (একাধিক গ্রহণযোগ্য বানান কমা দিয়ে দিতে পারেন)</label>
            <input value={form.short_answer} onChange={(e) => setForm({ ...form, short_answer: e.target.value })} placeholder="যেমন: ঢাকা, Dhaka, dhaka" />
            {form.short_answer && (
              <span className="translit-hint">
                🔤 ইংরেজি উত্তর এমনিতেই স্বয়ংক্রিয়ভাবে গ্রহণযোগ্য হবে (আনুমানিক বানান:{" "}
                <strong>{banglaToLatin(form.short_answer.split(",")[0].trim())}</strong>)।
                বানান ভুল মনে হলে{" "}
                <button
                  type="button"
                  className="translit-add-btn"
                  onClick={() => setForm({ ...form, short_answer: `${form.short_answer}, ${banglaToLatin(form.short_answer.split(",")[0].trim())}` })}
                >
                  এখানে যোগ করে ঠিক করে নিন
                </button>
              </span>
            )}
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

      <button className="cta-primary" onClick={saveQuestion}>{editingId ? "✓ Save করুন" : "+ প্রশ্ন যোগ করুন"}</button>
      {editingId && <button className="cta-ghost" onClick={cancelEdit} style={{ marginLeft: 8 }}>Cancel</button>}

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
                <td className="admin-row-actions">
                  <button className="cta-small" onClick={() => startEdit(q)}>এডিট</button>
                  <button className="cta-danger" onClick={() => deleteQuestion(q.id)}>মুছুন</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <h3>📷 বইয়ের ছবি থেকে প্রশ্ন যোগ করুন</h3>
      <p className="mode-desc">
        বইয়ের পরিষ্কার page-এর ছবি দিন। AI শুধু প্রশ্ন, অপশন ও উত্তর extract করবে।
        <strong> Extract হওয়ার পরে প্রতিটি প্রশ্ন আলাদাভাবে যাচাই করে বিষয়, টপিক, প্রশ্নপত্র ও প্রশ্নের ধরন সেট করতে পারবেন।</strong>
        সর্বোচ্চ ১০টি page একসাথে নেওয়া যাবে।
      </p>
      <div className="form-field">
        <label>বইয়ের পেজের ছবি</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleBookImages} />
      </div>
      {bookImages.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
          {bookImages.map((img, i) => (
            <div key={i} style={{ width: 110, fontSize: 12 }}>
              <img src={img.previewUrl} alt={`পৃষ্ঠা ${i + 1}`} style={{ width: 100, height: 130, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
              <div>পৃষ্ঠা {i + 1}</div>
            </div>
          ))}
        </div>
      )}
      <button className="cta-primary" disabled={extracting || !bookImages.length} onClick={extractFromBook}>
        {extracting ? "AI দিয়ে প্রশ্ন বের হচ্ছে..." : "📷 ছবি থেকে প্রশ্ন Extract করুন"}
      </button>

      {extractedQuestions.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <div>
              <h4 style={{ margin: 0 }}>Extracted প্রশ্ন ({extractedQuestions.length})</h4>
              <p className="mode-desc" style={{ margin: "5px 0 0" }}>
                প্রতিটি প্রশ্নের metadata আলাদাভাবে সেট করুন। তারপর সবগুলো একসাথে database-এ upload হবে।
              </p>
            </div>
          </div>

          {extractedQuestions.map((q, i) => {
            const questionTopics = topics.filter((t) => t.subject_id === q.subject_id);
            const isExtractedShort = q.question_type === "short";
            return (
              <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--surface, #fff)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <strong>#{i + 1} · পৃষ্ঠা {q._sourcePage}</strong>
                  <button className="cta-danger" onClick={() => removeExtracted(i)}>বাদ দিন</button>
                </div>

                <div className="admin-form">
                  <div className="form-field">
                    <label>প্রশ্নের ধরন</label>
                    <select
                      value={q.question_type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setExtractedQuestions((prev) => prev.map((item, idx) => idx === i ? {
                          ...item,
                          question_type: nextType,
                          ...(nextType === "short" ? { option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "" } : { short_answer: "" })
                        } : item));
                      }}
                    >
                      <option value="mcq">MCQ (৪টা অপশন)</option>
                      <option value="short">Short Answer</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>বিষয়</label>
                    <select
                      value={q.subject_id || ""}
                      onChange={(e) => setExtractedQuestions((prev) => prev.map((item, idx) => idx === i ? { ...item, subject_id: e.target.value, topic_id: "" } : item))}
                    >
                      <option value="">বিষয় নির্বাচন করুন</option>
                      {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name_bn}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>টপিক</label>
                    <select
                      value={q.topic_id || ""}
                      onChange={(e) => updateExtracted(i, "topic_id", e.target.value)}
                      disabled={!q.subject_id}
                    >
                      <option value="">টপিক নির্বাচন করুন</option>
                      {questionTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name_bn}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>প্রশ্নপত্র</label>
                    <select value={q.exam_id || ""} onChange={(e) => updateExtracted(i, "exam_id", e.target.value)}>
                      <option value="">প্রশ্নপত্র নির্বাচন করুন</option>
                      {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-field">
                  <label>প্রশ্ন</label>
                  <textarea value={q.question_text} onChange={(e) => updateExtracted(i, "question_text", e.target.value)} />
                </div>

                {isExtractedShort ? (
                  <div className="admin-form">
                    <div className="form-field">
                      <label>সঠিক উত্তর</label>
                      <input value={q.short_answer || ""} onChange={(e) => updateExtracted(i, "short_answer", e.target.value)} />
                    </div>
                    <div className="form-field">
                      <label>ব্যাখ্যা (ঐচ্ছিক)</label>
                      <input value={q.explanation || ""} onChange={(e) => updateExtracted(i, "explanation", e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-form">
                      {['a','b','c','d'].map((o) => (
                        <div className="form-field" key={o}>
                          <label>অপশন {o.toUpperCase()}</label>
                          <input value={q[`option_${o}`] || ""} onChange={(e) => updateExtracted(i, `option_${o}`, e.target.value)} />
                        </div>
                      ))}
                    </div>
                    <div className="admin-form">
                      <div className="form-field" style={{ maxWidth: 180 }}>
                        <label>সঠিক উত্তর</label>
                        <select value={q.correct_option || ""} onChange={(e) => updateExtracted(i, "correct_option", e.target.value)}>
                          <option value="">নির্বাচন করুন</option>
                          <option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label>ব্যাখ্যা (ঐচ্ছিক)</label>
                        <input value={q.explanation || ""} onChange={(e) => updateExtracted(i, "explanation", e.target.value)} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          <button className="cta-primary" disabled={uploading} onClick={uploadExtractedQuestions}>
            {uploading ? "Database-এ যোগ হচ্ছে..." : `✓ ${extractedQuestions.length}টি প্রশ্ন Upload করুন`}
          </button>
        </div>
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
