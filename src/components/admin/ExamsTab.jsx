import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const EXAM_SAMPLE_JSON = `[
  { "name": "৪৪তম বিসিএস প্রিলিমিনারি", "organization": "BPSC", "year": 2024, "slug": "bcs-44-preli" },
  { "name": "সহকারী শিক্ষক নিয়োগ পরীক্ষা", "organization": "DPE", "year": 2023, "slug": "primary-teacher-2023" }
]`;

export default function ExamsTab({ exams, refreshAll, flash }) {
  const [form, setForm] = useState({ name: "", organization: "", year: "", slug: "" });
  const [jsonText, setJsonText] = useState(EXAM_SAMPLE_JSON);
  const [uploading, setUploading] = useState(false);

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

  async function bulkUploadExams() {
    setUploading(true);
    try {
      const items = JSON.parse(jsonText);
      if (!Array.isArray(items)) throw new Error("JSON অবশ্যই একটা array হতে হবে");

      const rows = [];
      const skipped = [];
      items.forEach((item, i) => {
        if (!item.name || !item.slug) { skipped.push(`#${i + 1}: name বা slug অনুপস্থিত`); return; }
        rows.push({
          name: item.name,
          organization: item.organization || null,
          year: item.year ? Number(item.year) : null,
          slug: item.slug
        });
      });

      if (rows.length) {
        const { error } = await supabase.from("exams").upsert(rows, { onConflict: "slug" });
        if (error) throw error;
      }

      flash(
        skipped.length ? "err" : "ok",
        `${rows.length}টি প্রশ্নপত্র যোগ/আপডেট হয়েছে।` + (skipped.length ? ` ${skipped.length}টি বাদ পড়েছে: ${skipped.join("; ")}` : "")
      );
      refreshAll();
    } catch (err) {
      flash("err", "JSON পড়তে সমস্যা: " + err.message);
    } finally {
      setUploading(false);
    }
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

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <h3>Bulk Upload (JSON)</h3>
      <p className="mode-desc">
        একসাথে অনেক প্রশ্নপত্র (previous year exam) যোগ করতে নিচের ফরম্যাটে JSON বসান।
        একই <code>slug</code> আগে থেকে থাকলে সেটা আপডেট হয়ে যাবে (নতুন করে তৈরি হবে না)।
      </p>
      <div className="form-field">
        <textarea style={{ minHeight: 160 }} value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
      </div>
      <button className="cta-primary" disabled={uploading} onClick={bulkUploadExams} style={{ marginTop: 10 }}>
        {uploading ? "আপলোড হচ্ছে..." : "JSON আপলোড করুন"}
      </button>
    </div>
  );
}
