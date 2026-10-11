import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ProfileSettingsTab({ user, flash }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [createdAt, setCreatedAt] = useState(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!user?.id) { setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, contact_number, created_at, role")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        flash?.("err", "প্রোফাইল তথ্য লোড করা যায়নি: " + error.message);
      } else {
        setFullName(data?.full_name || user.user_metadata?.full_name || "");
        setContactNumber(data?.contact_number || "");
        setCreatedAt(data?.created_at || user.created_at || null);
      }
      setLoading(false);
    }
    loadProfile();
    return () => { active = false; };
  }, [user, flash]);

  async function saveProfile(event) {
    event.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        contact_number: contactNumber.trim() || null
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      flash?.("err", "প্রোফাইল সেভ হয়নি: " + error.message);
      return;
    }
    flash?.("ok", "প্রোফাইল সেটিংস সেভ হয়েছে।");
  }

  async function sendPasswordReset() {
    if (!user?.email) return;
    setPasswordBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setPasswordBusy(false);
    if (error) {
      flash?.("err", "পাসওয়ার্ড রিসেট ইমেইল পাঠানো যায়নি: " + error.message);
    } else {
      flash?.("ok", "পাসওয়ার্ড রিসেটের নির্দেশনা ইমেইলে পাঠানো হয়েছে।");
    }
  }

  if (loading) return <div className="admin-empty-state">প্রোফাইল লোড হচ্ছে…</div>;

  return (
    <div className="admin-profile-settings">
      <div className="admin-profile-intro">
        <div className="admin-profile-avatar">{(fullName || user?.email || "A").trim().charAt(0).toUpperCase()}</div>
        <div>
          <h3>প্রোফাইল সেটিংস</h3>
          <p>আপনার নিজের অ্যাকাউন্টের তথ্য এখানে আপডেট করুন।</p>
        </div>
      </div>

      <form className="admin-profile-form" onSubmit={saveProfile}>
        <label>
          <span>পূর্ণ নাম</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} placeholder="আপনার নাম লিখুন" required />
        </label>
        <label>
          <span>ইমেইল</span>
          <input value={user?.email || ""} readOnly disabled />
          <small>লগইন ইমেইল এখানে শুধু দেখা যাবে; পরিবর্তন করা যাবে না।</small>
        </label>
        <label>
          <span>মোবাইল নম্বর</span>
          <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} maxLength={30} inputMode="tel" placeholder="মোবাইল নম্বর (ঐচ্ছিক)" />
        </label>
        <label>
          <span>অ্যাকাউন্ট তৈরি</span>
          <input value={createdAt ? new Date(createdAt).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" }) : "—"} readOnly disabled />
        </label>
        <div className="admin-profile-actions">
          <button className="admin-profile-save" type="submit" disabled={saving}>
            {saving ? "সেভ হচ্ছে…" : "পরিবর্তন সেভ করুন"}
          </button>
        </div>
      </form>

      <section className="admin-profile-security">
        <div>
          <h4>অ্যাকাউন্ট নিরাপত্তা</h4>
          <p>পাসওয়ার্ড ভুলে গেলে বা পরিবর্তন করতে চাইলে ইমেইলে রিসেট লিংক পাঠাতে পারো।</p>
        </div>
        <button type="button" className="admin-profile-reset" onClick={sendPasswordReset} disabled={passwordBusy || !user?.email}>
          {passwordBusy ? "পাঠানো হচ্ছে…" : "পাসওয়ার্ড রিসেট ইমেইল"}
        </button>
      </section>
    </div>
  );
}
