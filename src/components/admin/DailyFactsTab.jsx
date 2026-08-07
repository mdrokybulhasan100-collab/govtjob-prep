import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function DailyFactsTab({ flash }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fact_bn: "", category: "" });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("daily_facts").select("*").order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  async function addItem() {
    if (!form.fact_bn) return flash("err", "ফ্যাক্টের লেখা আবশ্যক");
    const { error } = await supabase.from("daily_facts").insert(form);
    if (error) return flash("err", error.message);
    flash("ok", "ফ্যাক্ট যোগ হয়েছে");
    setForm({ fact_bn: "", category: "" });
    load();
  }

  async function deleteItem(id) {
    if (!confirm("এই ফ্যাক্ট মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("daily_facts").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "মুছে ফেলা হয়েছে");
    load();
  }

  return (
    <div>
      <p className="mode-desc">
        এখানে যা যোগ করবেন সবাই তাদের ড্যাশবোর্ডে "আজকের ফ্যাক্ট" কার্ডে (ঘুরিয়ে ঘুরিয়ে) দেখতে পাবে।
      </p>
      <div className="admin-form">
        <div className="form-field" style={{ minWidth: "70%" }}><label>ফ্যাক্ট</label>
          <textarea value={form.fact_bn} onChange={(e) => setForm({ ...form, fact_bn: e.target.value })} placeholder="যেমন: বাংলাদেশের জাতীয় ফুল শাপলা।" />
        </div>
        <div className="form-field" style={{ maxWidth: 200 }}><label>ক্যাটাগরি (ঐচ্ছিক)</label>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="বাংলাদেশ বিষয়াবলি" />
        </div>
      </div>
      <button className="cta-primary" onClick={addItem}>+ যোগ করুন</button>

      <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <table className="admin-table">
        <thead><tr><th>ফ্যাক্ট</th><th>ক্যাটাগরি</th><th></th></tr></thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={3}>লোড হচ্ছে...</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={3}>এখনো কিছু যোগ করা হয়নি।</td></tr>
          ) : (
            items.map((f) => (
              <tr key={f.id}>
                <td style={{ maxWidth: 400 }}>{f.fact_bn}</td>
                <td>{f.category}</td>
                <td><button className="cta-danger" onClick={() => deleteItem(f.id)}>মুছুন</button></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
