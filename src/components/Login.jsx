import { supabase } from "../lib/supabaseClient";

export default function Login() {
  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="stamp-badge">সরকারি<br />চাকরি</div>
        <h1 className="brand-title">সরকারি চাকরি প্রস্তুতি</h1>
        <p className="brand-sub">
          বিসিএস · ব্যাংক জব · শিক্ষক নিবন্ধন — বিষয়ভিত্তিক ও পূর্ববর্তী বছরের
          প্রশ্নপত্র দিয়ে প্র্যাকটিস করুন, নিজের অগ্রগতি ট্র্যাক করুন।
        </p>
        <div className="privacy-note">
          🔒 আপনার প্র্যাকটিস ডেটা শুধু আপনিই দেখতে পাবেন — অন্য কারো একাউন্টে
          আপনার তথ্য যাবে না, আপনার একাউন্টেও অন্য কারো তথ্য আসবে না।
        </div>
        <button className="google-btn" onClick={handleGoogleLogin}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3 16 3 9 7.9 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.8 14.1-4.9l-6.5-5.5C29.4 36.2 26.9 37 24 37c-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9 41 16 45 24 45z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5C41.4 36 45 30.5 45 24c0-1.2-.1-2.4-.4-3.5z" />
          </svg>
          <span>Gmail দিয়ে লগইন করুন</span>
        </button>
        <p className="login-note">প্রথমবার লগইন করলেই আপনার প্রাইভেট প্রোফাইল তৈরি হয়ে যাবে।</p>
      </div>
    </div>
  );
}
