import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function LiveExamsTab({ subjects, exams, flash }) {
  const [liveExams, setLiveExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    exam_id: "",
    subject_id: "",
    start_at: toLocalInputValue(new Date(Date.now() + 30 * 60 * 1000)),
    duration_minutes: 30,
    question_count: 20
  });

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

  async function addLiveExam() {
    if (!form.title || !form.start_at) return flash("err", "শিরোনাম ও শুরুর সময় আবশ্যক");
    const { error } = await supabase.from("live_exams").insert({
      title: form.title,
      exam_id: form.exam_id || null,
      subject_id: form.subject_id || null,
      start_at: new Date(form.start_at).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 30,
      question_count: Number(form.question_count) || 20
    });
    if (error) return flash("err", error.message);
    flash("ok", "লাইভ পরীক্ষা তৈরি হয়েছে");
    setForm({ ...form, title: "" });
    load();
  }

  async function deleteLiveExam(id) {
    if (!confirm("এই লাইভ পরীক্ষা মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("live_exams").delete().eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "মুছে ফেলা হয়েছে");
    load();
  }

  return (
    <div>
      <p className="mode-desc">
        নির্দিষ্ট একটা সময়ে সব ইউজার একসাথে এই পরীক্ষা দিতে পারবে, শেষে র‍্যাংকিং দেখা যাবে
        (কারো নাম/পরিচয় প্রকাশ হয় না, শুধু র‍্যাংক ও স্কোর)। প্রশ্ন হয় কোনো একটা বিদ্যমান
        Exam থেকে আসবে, অথবা কোনো একটা বিষয় থেকে র‍্যান্ডম বেছে নেওয়া হবে।
      </p>

      <div className="admin-form">
        <div className="form-field" style={{ minWidth: 220 }}><label>শিরোনাম</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="যেমন: রবিবারের লাইভ মডেল টেস্ট" />
        </div>
        <div className="form-field"><label>প্রশ্ন আসবে (Exam থেকে, ঐচ্ছিক)</label>
          <select value={form.exam_id} onChange={(e) => setForm({ ...form, exam_id: e.target.value, subject_id: "" })}>
            <option value="">কোনোটা না</option>
            {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <div className="form-field"><label>অথবা বিষয় থেকে (ঐচ্ছিক)</label>
          <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, exam_id: "" })}>
            <option value="">কোনোটা না</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_bn}</option>)}
          </select>
        </div>
      </div>
      <div className="admin-form">
        <div className="form-field"><label>শুরুর সময়</label>
          <input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
        </div>
        <div className="form-field" style={{ maxWidth: 160 }}><label>সময়সীমা (মিনিট)</label>
          <input type="number" min="5" max="180" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
        </div>
        <div className="form-field" style={{ maxWidth: 160 }}><label>প্রশ্ন সংখ্যা</label>
          <input type="number" min="5" max="100" value={form.question_count} onChange={(e) => setForm({ ...form, question_count: e.target.value })} />
        </div>
      </div>
      <button className="cta-primary" onClick={addLiveExam}>+ লাইভ পরীক্ষা তৈরি করুন</button>

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <h3 style={{ marginTop: 0 }}>সব লাইভ পরীক্ষা</h3>
      {loading ? (
        <p className="mode-desc">লোড হচ্ছে...</p>
      ) : liveExams.length === 0 ? (
        <p className="mode-desc">এখনো কোনো লাইভ পরীক্ষা তৈরি করা হয়নি।</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>শিরোনাম</th><th>শুরু</th><th>সময়সীমা</th><th>প্রশ্ন</th><th></th></tr></thead>
          <tbody>
            {liveExams.map((le) => (
              <tr key={le.id}>
                <td>{le.title}</td>
                <td>{new Date(le.start_at).toLocaleString("bn-BD")}</td>
                <td>{le.duration_minutes} মিনিট</td>
                <td>{le.question_count}</td>
                <td><button className="cta-danger" onClick={() => deleteLiveExam(le.id)}>মুছুন</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
