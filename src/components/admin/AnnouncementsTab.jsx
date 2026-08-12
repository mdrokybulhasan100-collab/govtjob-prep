import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AnnouncementsTab({ flash }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", url: "", source: "", published_at: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("announcements").select("*").order("published_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  async function addItem() {
    if (!form.title) return flash("err", "শিরোনাম আবশ্যক");
    const { error } = await supabase.from("announcements").insert(form);
    if (error) return flash("err", error.message);
    flash("ok", "বিজ্ঞপ্তি যোগ হয়েছে");
    setForm({ ...form, title: "", url: "" });
    load();
  }

  async function deleteItem(id) {
    if (!confirm("এই বিজ্ঞপ্তি মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "মুছে ফেলা হয়েছে");
    load();
  }

  return (
    <div>
      <p className="mode-desc">
        এখানে যা যোগ করবেন সবাই তাদের ড্যাশবোর্ডে "সাম্প্রতিক বিজ্ঞপ্তি" উইজেটে দেখতে পাবে।
      </p>
      <div className="admin-form">
        <div className="form-field" style={{ minWidth: 260 }}><label>শিরোনাম</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="৪৫তম বিসিএস বিজ্ঞপ্তি প্রকাশ" />
        </div>
        <div className="form-field" style={{ minWidth: 220 }}><label>লিংক (ঐচ্ছিক)</label>
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://bpsc.gov.bd/..." />
        </div>
        <div className="form-field"><label>উৎস (ঐচ্ছিক)</label>
          <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="BPSC" />
        </div>
        <div className="form-field" style={{ maxWidth: 170 }}><label>তারিখ</label>
          <input type="date" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} />
        </div>
        <button className="cta-primary" onClick={addItem}>+ যোগ করুন</button>
      </div>

      <table className="admin-table">
        <thead><tr><th>শিরোনাম</th><th>উৎস</th><th>তারিখ</th><th></th></tr></thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4}>লোড হচ্ছে...</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={4}>এখনো কিছু যোগ করা হয়নি।</td></tr>
          ) : (
            items.map((a) => (
              <tr key={a.id}>
                <td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a> : a.title}</td>
                <td>{a.source}</td>
                <td>{a.published_at}</td>
                <td><button className="cta-danger" onClick={() => deleteItem(a.id)}>মুছুন</button></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
