import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { packageByKey } from "../../lib/packages";

export default function PaymentsTab({ flash }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [settings, setSettings] = useState({ bkash_number: "", nagad_number: "", instructions: "" });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending"); // pending | approved | rejected | all

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: subs }, { data: s }] = await Promise.all([
      supabase.from("subscriptions").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("payment_settings").select("*").eq("id", 1).single()
    ]);
    setSubscriptions(subs || []);
    if (s) setSettings(s);
    setLoading(false);
  }

  async function saveSettings() {
    const { error } = await supabase
      .from("payment_settings")
      .update({
        bkash_number: settings.bkash_number,
        nagad_number: settings.nagad_number,
        instructions: settings.instructions,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);
    if (error) return flash("err", error.message);
    flash("ok", "পেমেন্ট সেটিংস আপডেট হয়েছে");
  }

  async function approve(sub) {
    const pkg = packageByKey(sub.package);
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + pkg.days * 86400000);
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "approved",
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        reviewed_at: new Date().toISOString()
      })
      .eq("id", sub.id);
    if (error) return flash("err", error.message);
    flash("ok", "সাবস্ক্রিপশন অনুমোদন করা হয়েছে");
    load();
  }

  async function reject(sub) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) return flash("err", error.message);
    flash("ok", "সাবস্ক্রিপশন বাতিল করা হয়েছে");
    load();
  }

  const filtered = filter === "all" ? subscriptions : subscriptions.filter((s) => s.status === filter);
  const pendingCount = subscriptions.filter((s) => s.status === "pending").length;

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>পেমেন্ট নাম্বার সেটিংস</h3>
      <div className="admin-form">
        <div className="form-field"><label>bKash নাম্বার</label>
          <input value={settings.bkash_number || ""} onChange={(e) => setSettings({ ...settings, bkash_number: e.target.value })} placeholder="01XXXXXXXXX" />
        </div>
        <div className="form-field"><label>Nagad নাম্বার</label>
          <input value={settings.nagad_number || ""} onChange={(e) => setSettings({ ...settings, nagad_number: e.target.value })} placeholder="01XXXXXXXXX" />
        </div>
        <div className="form-field" style={{ minWidth: "60%" }}><label>অতিরিক্ত নির্দেশনা (ঐচ্ছিক)</label>
          <input value={settings.instructions || ""} onChange={(e) => setSettings({ ...settings, instructions: e.target.value })} placeholder="যেমন: Send Money অপশনে পাঠাবেন, Payment না" />
        </div>
      </div>
      <button className="cta-primary" onClick={saveSettings}>সেটিংস সেভ করুন</button>

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <h3 style={{ marginTop: 0 }}>সাবস্ক্রিপশন সাবমিশন {pendingCount > 0 && `(${pendingCount}টি অপেক্ষমান)`}</h3>
      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        {["pending", "approved", "rejected", "all"].map((f) => (
          <button key={f} className={`admin-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "pending" ? "অপেক্ষমান" : f === "approved" ? "অনুমোদিত" : f === "rejected" ? "বাতিল" : "সব"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mode-desc">লোড হচ্ছে...</p>
      ) : filtered.length === 0 ? (
        <p className="mode-desc">কিছু পাওয়া যায়নি।</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ইউজার</th><th>প্যাকেজ</th><th>Transaction ID</th><th>যোগাযোগ</th><th>স্ট্যাটাস</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.profiles?.full_name || s.profiles?.email || "—"}</td>
                <td>{packageByKey(s.package)?.label} (৳{s.amount})</td>
                <td>{s.transaction_id}</td>
                <td>{s.contact_number}</td>
                <td>
                  {s.status === "pending" && "⏳ অপেক্ষমান"}
                  {s.status === "approved" && `✅ অনুমোদিত (মেয়াদ: ${new Date(s.expires_at).toLocaleDateString("bn-BD")})`}
                  {s.status === "rejected" && "❌ বাতিল"}
                </td>
                <td className="admin-row-actions">
                  {s.status === "pending" && (
                    <>
                      <button className="cta-small" onClick={() => approve(s)}>✓ অনুমোদন</button>
                      <button className="cta-danger" onClick={() => reject(s)}>✗ বাতিল</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
