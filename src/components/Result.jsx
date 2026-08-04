import { toBn } from "../lib/utils";

const CONFETTI_EMOJI = ["🎉", "✨", "🎊", "⭐", "🥳"];

export default function Result({ correct, total, setView }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const headline = pct >= 80 ? "চমৎকার হয়েছে!" : pct >= 50 ? "ভালো চেষ্টা!" : "আরেকটু চেষ্টা করুন!";
  const seal = pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "💪";
  const xpEarned = correct * 10 + total * 2;

  const confetti = pct >= 60
    ? Array.from({ length: 14 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        emoji: CONFETTI_EMOJI[i % CONFETTI_EMOJI.length]
      }))
    : [];

  return (
    <section className="view">
      <div className="result-card">
        {confetti.map((c) => (
          <span
            key={c.id}
            className="confetti-piece"
            style={{ left: `${c.left}%`, animationDelay: `${c.delay}s` }}
          >
            {c.emoji}
          </span>
        ))}
        <div className="result-seal">{seal}</div>
        <h2>{headline}</h2>
        <p className="result-score">{toBn(correct)} / {toBn(total)} সঠিক</p>
        <p className="result-xp">+{toBn(xpEarned)} XP অর্জিত হয়েছে</p>
        <div className="result-actions">
          <button className="cta-primary" onClick={() => setView("practice")}>আবার প্র্যাকটিস করুন</button>
          <button className="cta-ghost" onClick={() => setView("dashboard")}>ড্যাশবোর্ডে ফিরুন</button>
        </div>
      </div>
    </section>
  );
}
