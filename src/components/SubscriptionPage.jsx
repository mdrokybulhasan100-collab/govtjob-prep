import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { PACKAGES, packageByKey } from "../lib/packages";
import { useApp } from "../lib/AppContext";

export default function SubscriptionPage() {
  const { user } = useApp();
  const [settings, setSettings] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPackage, setSelectedPackage] = useState(PACKAGES[0].key);
  const [transactionId, setTransactionId] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: subs }] = await Promise.all([
      supabase.from("payment_settings").select("*").eq("id", 1).single(),
      supabase.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
    ]);
    setSettings(s);
    setSubscriptions(subs || []);
    setLoading(false);
  }

  const activeSub = subscriptions.find((s) => s.status === "approved" && new Date(s.expires_at) > new Date());
  const pendingSub = subscriptions.find((s) => s.status === "pending");

  async function handleSubmit() {
    if (!transactionId.trim() || !contactNumber.trim()) {
      alert("Transaction ID ও Contact Number দুটোই আবশ্যক");
      return;
    }
    const pkg = packageByKey(selectedPackage);
    setSubmitting(true);
    const { error } = await supabase.from("subscriptions").insert({
      user_id: user.id,
      package: pkg.key,
      amount: pkg.price,
      transaction_id: transactionId.trim(),
      contact_number: contactNumber.trim()
    });
    setSubmitting(false);
    if (error) {
      alert("সমস্যা হয়েছে: " + error.message);
      return;
    }
    await supabase.from("profiles").update({ contact_number: contactNumber.trim() }).eq("id", user.id);
    setTransactionId("");
    load();
  }

  if (loading) return <section className="view"><p className="mode-desc">লোড হচ্ছে...</p></section>;

  return (
    <section className="view">
      <h2 className="section-title">💳 সাবস্ক্রিপশন</h2>
      <p className="mode-desc">
        সাবস্ক্রিপশন শুধু কিছু বিশেষ (পেইড হিসেবে চিহ্নিত) 🔴 লাইভ পরীক্ষার জন্য প্রয়োজন —
        বাকি সব ফিচার (প্র্যাকটিস, কুইজ বিল্ডার, আর্কাইভ, সার্চ ইত্যাদি) সবসময় ফ্রি।
      </p>

      {activeSub && (
        <div className="chart-card" style={{ background: "var(--emerald-soft)" }}>
          <strong>✅ সক্রিয় সাবস্ক্রিপশন</strong>
          <p style={{ margin: "6px 0 0" }}>
            মেয়াদ শেষ হবে: {new Date(activeSub.expires_at).toLocaleDateString("bn-BD")}
            {" "}({toBn(Math.max(0, Math.ceil((new Date(activeSub.expires_at) - new Date()) / 86400000)))} দিন বাকি)
          </p>
        </div>
      )}

      {pendingSub && !activeSub && (
        <div className="chart-card" style={{ background: "var(--amber-soft)" }}>
          <strong>⏳ যাচাইয়ের অপেক্ষায়</strong>
          <p style={{ margin: "6px 0 0" }}>
            আপনার {packageByKey(pendingSub.package)?.label} প্যাকেজের পেমেন্ট (Transaction ID: {pendingSub.transaction_id})
            অ্যাডমিন যাচাই করার অপেক্ষায় আছে।
          </p>
        </div>
      )}

      {!pendingSub && (
        <>
          <h3 className="chart-card-title" style={{ margin: "20px 0 10px" }}>১. প্যাকেজ বেছে নিন</h3>
          <div className="pick-list">
            {PACKAGES.map((p) => (
              <button
                key={p.key}
                className={`pick-item ${selectedPackage === p.key ? "selected" : ""}`}
                onClick={() => setSelectedPackage(p.key)}
              >
                {p.label} — ৳{toBn(p.price)}
              </button>
            ))}
          </div>

          <h3 className="chart-card-title" style={{ margin: "24px 0 10px" }}>২. পেমেন্ট করুন</h3>
          <div className="chart-card">
            {settings?.bkash_number && <p>📱 <strong>bKash:</strong> {settings.bkash_number} (Send Money)</p>}
            {settings?.nagad_number && <p>📱 <strong>Nagad:</strong> {settings.nagad_number} (Send Money)</p>}
            <p style={{ fontWeight: 700 }}>পাঠানোর পরিমাণ: ৳{toBn(packageByKey(selectedPackage)?.price)}</p>
            {settings?.instructions && <p className="mode-desc">{settings.instructions}</p>}
          </div>

          <h3 className="chart-card-title" style={{ margin: "24px 0 10px" }}>৩. তথ্য জমা দিন</h3>
          <div className="admin-form">
            <div className="form-field"><label>Transaction ID</label>
              <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="যেমন: 8N7A2B9XYZ" />
            </div>
            <div className="form-field"><label>যোগাযোগ নম্বর</label>
              <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
          </div>
          <button className="cta-primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "জমা হচ্ছে..." : "জমা দিন"}
          </button>
        </>
      )}

      {subscriptions.length > 0 && (
        <>
          <h3 className="chart-card-title" style={{ margin: "28px 0 10px" }}>ইতিহাস</h3>
          <table className="admin-table">
            <thead><tr><th>প্যাকেজ</th><th>Transaction ID</th><th>স্ট্যাটাস</th><th>তারিখ</th></tr></thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id}>
                  <td>{packageByKey(s.package)?.label}</td>
                  <td>{s.transaction_id}</td>
                  <td>
                    {s.status === "approved" && "✅ অনুমোদিত"}
                    {s.status === "pending" && "⏳ অপেক্ষমান"}
                    {s.status === "rejected" && "❌ বাতিল"}
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString("bn-BD")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
