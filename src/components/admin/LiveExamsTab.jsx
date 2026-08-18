import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { toBn, shuffle } from "../../lib/utils";

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function LiveExamsTab({ subjects, topics, exams, flash }) {
  const [liveExams, setLiveExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    exam_id: "",
    subject_id: "",
    start_at: toLocalInputValue(new Date(Date.now() + 30 * 60 * 1000)),
    duration_minutes: 30,
    free_for_all: false
  });

  // Composition rows: [{ subject_id, topic_id, count }]. If any rows are
  // added, they take priority over the simple exam_id/subject_id fields.
  const [composition, setComposition] = useState([]);
  const [rowSubject, setRowSubject] = useState("");
  const [rowTopic, setRowTopic] = useState("");
  const [rowCount, setRowCount] = useState(10);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("live_exams").select("*").order("start_at", { ascending: false });
    setLiveExams(data || []);
    setLoading(false);
  }

  function addCompositionRow() {
    if (!rowSubject || !rowCount) return;
    setComposition((prev) => [...prev, { subject_id: rowSubject, topic_id: rowTopic || null, count: Number(rowCount) }]);
    setRowSubject("");
    setRowTopic("");
    setRowCount(10);
  }

  function removeCompositionRow(i) {
    setComposition((prev) => prev.filter((_, idx) => idx !== i));
  }

  function subjectName(id) {
    return subjects.find((s) => s.id === id)?.name_bn || "—";
  }
  function topicName(id) {
    return topics.find((t) => t.id === id)?.name_bn || "";
  }

  const totalCompositionCount = composition.reduce((a, r) => a + r.count, 0);

  // Resolve and freeze the final question set (fixed, same for everyone).
  async function resolveQuestionIds() {
    if (composition.length > 0) {
      const picked = [];
      for (const row of composition) {
        let query = supabase.from("questions").select("id").eq("subject_id", row.subject_id);
        if (row.topic_id) query = query.eq("topic_id", row.topic_id);
        const { data } = await query;
        const pool = shuffle(data || []).slice(0, row.count);
        picked.push(...pool.map((q) => q.id));
      }
      return shuffle(picked);
    }
    if (form.exam_id) {
      const { data } = await supabase.from("questions").select("id").eq("exam_id", form.exam_id);
      return shuffle(data || []).map((q) => q.id);
    }
    if (form.subject_id) {
      const { data } = await supabase.from("questions").select("id").eq("subject_id", form.subject_id);
      return shuffle(data || []).slice(0, 20).map((q) => q.id);
    }
    const { data } = await supabase.from("questions").select("id");
    return shuffle(data || []).slice(0, 20).map((q) => q.id);
  }

  async function addLiveExam() {
    if (!form.title || !form.start_at) return flash("err", "শিরোনাম ও শুরুর সময় আবশ্যক");
    setCreating(true);
    const questionIds = await resolveQuestionIds();
    setCreating(false);

    if (!questionIds.length) {
      return flash("err", "এই সিলেকশনে কোনো প্রশ্ন পাওয়া যায়নি — বিষয়/চ্যাপ্টার/Exam-এ প্রশ্ন আছে কিনা দেখুন।");
    }

    const { error } = await supabase.from("live_exams").insert({
      title: form.title,
      exam_id: composition.length ? null : form.exam_id || null,
      subject_id: composition.length ? null : form.subject_id || null,
      start_at: new Date(form.start_at).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 30,
      question_count: questionIds.length,
      question_ids: questionIds,
      composition: composition.length ? composition : null,
      free_for_all: form.free_for_all
    });
    if (error) return flash("err", error.message);
    flash("ok", `লাইভ পরীক্ষা তৈরি হয়েছে — ${toBn(questionIds.length)}টি প্রশ্ন ফিক্সড করা হয়েছে (সবাই একই সেট পাবে)`);
    setForm({ ...form, title: "", exam_id: "", subject_id: "" });
    setComposition([]);
    load();
  }

  async function toggleFree(le) {
    const { error } = await supabase.from("live_exams").update({ free_for_all: !le.free_for_all }).eq("id", le.id);
    if (error) return flash("err", error.message);
    flash("ok", le.free_for_all ? "এখন থেকে এটা প্রিমিয়াম" : "এখন থেকে এটা ফ্রি");
    load();
  }

  async function toggleArchive(le) {
    const { error } = await supabase.from("live_exams").update({ archived: !le.archived }).eq("id", le.id);
    if (error) return flash("err", error.message);
    flash("ok", le.archived ? "আর্কাইভ থেকে সরানো হয়েছে" : "📁 পরীক্ষা আর্কাইভে পাঠানো হয়েছে");
    load();
  }

  async function deleteLiveExam(id) {
    if (!confirm("এই লাইভ পরীক্ষা মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("live_exams").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "মুছে ফেলা হয়েছে");
    load();
  }

  const topicsForRowSubject = topics.filter((t) => t.subject_id === rowSubject);

  return (
    <div>
      <p className="mode-desc">
        নির্দিষ্ট একটা সময়ে সব ইউজার একসাথে এই পরীক্ষা দিতে পারবে, শেষে নাম ও স্কোর সহ
        পূর্ণ র‍্যাংকিং দেখা যাবে। প্রশ্ন তৈরি হওয়ার সময়ই একবার ফিক্সড হয়ে যায় — সবাই
        (লাইভে বা পরে আর্কাইভ থেকে) ঠিক একই প্রশ্ন-সেট পাবে।
      </p>

      <div className="admin-form">
        <div className="form-field" style={{ minWidth: 220 }}><label>শিরোনাম</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="যেমন: রবিবারের লাইভ মডেল টেস্ট" />
        </div>
        <div className="form-field"><label>শুরুর সময়</label>
          <input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
        </div>
        <div className="form-field" style={{ maxWidth: 160 }}><label>সময়সীমা (মিনিট)</label>
          <input type="number" min="5" max="180" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
        </div>
        <label className="unique-toggle" style={{ alignSelf: "center", marginTop: 18 }}>
          <input type="checkbox" checked={form.free_for_all} onChange={(e) => setForm({ ...form, free_for_all: e.target.checked })} />
          🆓 ফ্রি ইউজারদের জন্যও উন্মুক্ত
        </label>
      </div>

      <h3 style={{ marginBottom: 6 }}>প্রশ্নের উৎস — যেকোনো একটা পদ্ধতি ব্যবহার করুন</h3>

      <p className="mode-desc" style={{ marginBottom: 6 }}><strong>পদ্ধতি ১:</strong> সরাসরি এক Exam বা এক বিষয় থেকে (নিচে কম্পোজিশন ফাঁকা থাকলে এটা ব্যবহৃত হবে)</p>
      <div className="admin-form">
        <div className="form-field"><label>Exam থেকে</label>
          <select value={form.exam_id} onChange={(e) => setForm({ ...form, exam_id: e.target.value, subject_id: "" })}>
            <option value="">কোনোটা না</option>
            {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <div className="form-field"><label>অথবা বিষয় থেকে (২০টা random)</label>
          <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, exam_id: "" })}>
            <option value="">কোনোটা না</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_bn}</option>)}
          </select>
        </div>
      </div>

      <p className="mode-desc" style={{ marginBottom: 6, marginTop: 18 }}>
        <strong>পদ্ধতি ২ (কাস্টম কম্পোজিশন):</strong> একাধিক বিষয়/চ্যাপ্টার থেকে সংখ্যা দিয়ে মিশিয়ে নিন
        (যেমন বাংলা ২৫ + ইংরেজি ২৫ + GK ২৫ = মোট ৭৫)
      </p>
      <div className="admin-form">
        <div className="form-field"><label>বিষয়</label>
          <select value={rowSubject} onChange={(e) => { setRowSubject(e.target.value); setRowTopic(""); }}>
            <option value="">বেছে নিন</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_bn}</option>)}
          </select>
        </div>
        <div className="form-field"><label>চ্যাপ্টার (ঐচ্ছিক)</label>
          <select value={rowTopic} onChange={(e) => setRowTopic(e.target.value)}>
            <option value="">সব চ্যাপ্টার মিলিয়ে</option>
            {topicsForRowSubject.map((t) => <option key={t.id} value={t.id}>{t.name_bn}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ maxWidth: 140 }}><label>সংখ্যা</label>
          <input type="number" min="1" max="100" value={rowCount} onChange={(e) => setRowCount(e.target.value)} />
        </div>
        <button className="cta-small" onClick={addCompositionRow}>+ যোগ করুন</button>
      </div>

      {composition.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {composition.map((row, i) => (
            <span key={i} className="chip chip-level" style={{ marginRight: 8, marginBottom: 8, display: "inline-flex" }}>
              {subjectName(row.subject_id)}{row.topic_id ? ` (${topicName(row.topic_id)})` : ""} × {toBn(row.count)}
              <button onClick={() => removeCompositionRow(i)} style={{ background: "none", border: "none", marginLeft: 6, cursor: "pointer", color: "var(--rose)" }}>✕</button>
            </span>
          ))}
          <p className="mode-desc" style={{ margin: "6px 0 0" }}>মোট: {toBn(totalCompositionCount)}টি প্রশ্ন</p>
        </div>
      )}

      <button className="cta-primary" disabled={creating} onClick={addLiveExam}>
        {creating ? "প্রশ্ন ফিক্সড করা হচ্ছে..." : "+ লাইভ পরীক্ষা তৈরি করুন"}
      </button>

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <h3 style={{ marginTop: 0 }}>সব লাইভ পরীক্ষা</h3>
      {loading ? (
        <p className="mode-desc">লোড হচ্ছে...</p>
      ) : liveExams.length === 0 ? (
        <p className="mode-desc">এখনো কোনো লাইভ পরীক্ষা তৈরি করা হয়নি।</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>শিরোনাম</th><th>শুরু</th><th>সময়সীমা</th><th>প্রশ্ন</th><th>অ্যাক্সেস</th><th>আর্কাইভ</th><th></th></tr></thead>
          <tbody>
            {liveExams.map((le) => (
              <tr key={le.id}>
                <td>{le.title}</td>
                <td>{new Date(le.start_at).toLocaleString("bn-BD")}</td>
                <td>{le.duration_minutes} মিনিট</td>
                <td>{le.question_count}</td>
                <td>
                  <button className="cta-small" onClick={() => toggleFree(le)}>
                    {le.free_for_all ? "🆓 ফ্রি" : "💳 প্রিমিয়াম"}
                  </button>
                </td>
                <td>
                  <button className="cta-small" onClick={() => toggleArchive(le)}>
                    {le.archived ? "📁 আর্কাইভে আছে" : "→ আর্কাইভে পাঠান"}
                  </button>
                </td>
                <td><button className="cta-danger" onClick={() => deleteLiveExam(le.id)}>মুছুন</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
