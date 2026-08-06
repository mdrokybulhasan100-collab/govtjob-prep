export default function ConfigNotice() {
  return (
    <div className="login-wrap">
      <div className="config-card">
        <div className="seal">⚠</div>
        <h1>সেটআপ বাকি আছে</h1>
        <p>
          এই অ্যাপ চালাতে <code>.env</code> ফাইলে আপনার Supabase URL ও anon key
          বসাতে হবে (<code>.env.example</code> দেখুন)। বিস্তারিত ধাপে ধাপে নির্দেশনা{" "}
          <code>README.md</code> ফাইলে আছে।
        </p>
      </div>
    </div>
  );
}
