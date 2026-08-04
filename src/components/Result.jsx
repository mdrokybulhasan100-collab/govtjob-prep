import { toBn } from "../lib/utils";

export default function Result({ correct, total, setView }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const headline = pct >= 80 ? "চমৎকার হয়েছে!" : pct >= 50 ? "ভালো চেষ্টা!" : "আরেকটু চেষ্টা করুন!";

  return (
    <section className="view">
      <div className="result-card">
        <div className="result-seal">সম্পন্ন</div>
        <h2>{headline}</h2>
        <p className="result-score">{toBn(correct)} / {toBn(total)} সঠিক</p>
        <div className="result-actions">
          <button className="cta-primary" onClick={() => setView("practice")}>আবার প্র্যাকটিস করুন</button>
          <button className="cta-ghost" onClick={() => setView("dashboard")}>ড্যাশবোর্ডে ফিরুন</button>
        </div>
      </div>
    </section>
  );
}
