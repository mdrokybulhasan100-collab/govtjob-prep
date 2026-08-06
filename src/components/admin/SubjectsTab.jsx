import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SubjectsTab({ subjects, refreshAll, flash }) {
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
