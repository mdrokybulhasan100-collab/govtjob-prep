import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const EMPTY = { name_bn: "", name_en: "", slug: "", icon: "📘" };

export default function SubjectsTab({ subjects, refreshAll, flash }) {
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  function startEdit(s) {
    setEditingId(s.id);
    setForm({ name_bn: s.name_bn, name_en: s.name_en, slug: s.slug, icon: s.icon });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function saveSubject() {
    if (!form.name_bn || !form.slug) return flash("err", "নাম ও slug আবশ্যক");

    if (editingId) {
      const { error } = await supabase.from("subjects").update(form).eq("id", editingId);
      if (error) return flash("err", error.message);
      flash("ok", "বিষয় আপডেট হয়েছে");
    } else {
      const { error } = await supabase.from("subjects").insert({ ...form, sort_order: subjects.length + 1 });
      if (error) return flash("err", error.message);
      flash("ok", "বিষয় যোগ হয়েছে");
    }
    setForm(EMPTY);
    setEditingId(null);
    refreshAll();
  }

  async function deleteSubject(id) {
    if (!confirm("এই বিষয় ও এর সব টপিক/প্রশ্ন মুছে যাবে। নিশ্চিত?")) return;
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "মুছে ফেলা হয়েছে");
    if (editingId === id) cancelEdit();
    refreshAll();
  }

  return (
    <div>
      {editingId && (
        <div className="admin-msg" style={{ background: "var(--indigo-soft)", color: "var(--indigo-deep)" }}>
          ✏️ এডিট মোড — পরিবর্তন শেষে Save চাপুন, অথবা Cancel করুন
        </div>
      )}
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
        <button className="cta-primary" onClick={saveSubject}>{editingId ? "✓ Save করুন" : "+ যোগ করুন"}</button>
        {editingId && <button className="cta-ghost" onClick={cancelEdit}>Cancel</button>}
      </div>

      <table className="admin-table">
        <thead><tr><th>আইকন</th><th>নাম</th><th>Slug</th><th></th></tr></thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.id}>
              <td>{s.icon}</td>
              <td>{s.name_bn} <span style={{ color: "var(--ink-soft)" }}>({s.name_en})</span></td>
              <td><code>{s.slug}</code></td>
              <td className="admin-row-actions">
                <button className="cta-small" onClick={() => startEdit(s)}>এডিট</button>
                <button className="cta-danger" onClick={() => deleteSubject(s.id)}>মুছুন</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
