import { toBn } from "../lib/utils";
import { useApp } from "../lib/AppContext";

export default function PracticeFinished() {
  const { practiceResult, setView } = useApp();
  const reviewed = practiceResult?.reviewed || 0;
  const minutes = practiceResult?.minutes || 0;

  return (
    <section className="view">
      <div className="result-card">
        <div className="result-seal">📖</div>
        <h2>প্র্যাকটিস সম্পন্ন হয়েছে!</h2>
        <p className="result-score">{toBn(reviewed)}টি প্রশ্ন পর্যালোচনা করেছেন</p>
        <p className="result-xp">{toBn(minutes)} মিনিট পড়াশোনা করেছেন</p>
        <div className="result-actions">
          <button className="cta-primary" onClick={() => setView("practice")}>আবার প্র্যাকটিস করুন</button>
          <button className="cta-ghost" onClick={() => setView("dashboard")}>ড্যাশবোর্ডে ফিরুন</button>
        </div>
      </div>
    </section>
  );
}
