import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function TopicsTab({ subjects, topics, refreshAll, flash }) {
  const [form, setForm] = useState({ subject_id: "", parent_topic_id: "", name_bn: "", name_en: "" });

  const parentOptionsForSubject = topics.filter((t) => t.subject_id === form.subject_id);

  async function addTopic() {
    if (!form.subject_id || !form.name_bn) return flash("err", "বিষয় ও নাম আবশ্যক");
    const payload = { ...form, parent_topic_id: form.parent_topic_id || null };
    const { error } = await supabase.from("topics").insert(payload);
    if (error) return flash("err", error.message);
    flash("ok", "টপিক যোগ হয়েছে");
    setForm({ subject_id: form.subject_id, parent_topic_id: "", name_bn: "", name_en: "" });
    refreshAll();
  }

  async function deleteTopic(id) {
    if (!confirm("এই টপিক ও এর সব সাব-টপিক মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("topics").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "মুছে ফেলা হয়েছে");
    refreshAll();
  }

  const subjectName = (id) => subjects.find((s) => s.id === id)?.name_bn || "—";

  // depth of a topic in its subtopic tree, for indentation in the table
  function depthOf(topic) {
    let d = 0;
    let cur = topic;
    const guard = new Set();
    while (cur?.parent_topic_id && !guard.has(cur.id)) {
      guard.add(cur.id);
      cur = topics.find((t) => t.id === cur.parent_topic_id);
      d++;
      if (d > 10) break;
    }
    return d;
  }

  // sort so subtopics appear right under their parent
  function sortedTopics() {
    const bySubject = {};
    topics.forEach((t) => { (bySubject[t.subject_id] ||= []).push(t); });
    const out = [];
    Object.values(bySubject).forEach((list) => {
      const byParent = {};
      list.forEach((t) => { (byParent[t.parent_topic_id || "root"] ||= []).push(t); });
      function walk(parentKey) {
        (byParent[parentKey] || []).forEach((t) => {
          out.push(t);
          walk(t.id);
        });
      }
      walk("root");
    });
    return out;
  }

  return (
    <div>
      <div className="admin-form">
        <div className="form-field"><label>বিষয়</label>
          <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, parent_topic_id: "" })}>
            <option value="">বেছে নিন</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_bn}</option>)}
          </select>
        </div>
        <div className="form-field"><label>প্যারেন্ট টপিক (ঐচ্ছিক)</label>
          <select value={form.parent_topic_id} onChange={(e) => setForm({ ...form, parent_topic_id: e.target.value })}>
            <option value="">কোনোটা না (মূল টপিক)</option>
            {parentOptionsForSubject.map((t) => <option key={t.id} value={t.id}>{t.name_bn}</option>)}
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
      <p className="mode-desc">
        প্যারেন্ট টপিক ছাড়া যোগ করলে সেটা মূল টপিক হবে (যেমন "বাংলা সাহিত্য")। কোনো টপিককে
        প্যারেন্ট হিসেবে বেছে নিলে সেটা তার সাব-টপিক হবে (যেমন "বাংলা সাহিত্য" → "আধুনিক যুগ")
        — এভাবে যত ইচ্ছা গভীরে নেস্ট করা যাবে (Topic Guru-এর ট্রি স্ট্রাকচার)।
      </p>

      <table className="admin-table">
        <thead><tr><th>বিষয়</th><th>টপিক</th><th></th></tr></thead>
        <tbody>
          {sortedTopics().map((t) => (
            <tr key={t.id}>
              <td>{subjectName(t.subject_id)}</td>
              <td style={{ paddingLeft: 12 + depthOf(t) * 20 }}>
                {depthOf(t) > 0 && "↳ "}{t.name_bn} <span style={{ color: "var(--ink-soft)" }}>({t.name_en})</span>
              </td>
              <td><button className="cta-danger" onClick={() => deleteTopic(t.id)}>মুছুন</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
