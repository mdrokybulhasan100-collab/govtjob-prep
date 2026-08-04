export default function ExamsList({ exams, onStart }) {
  return (
    <section className="view">
      <h2 className="section-title">পূর্ববর্তী বছরের প্রশ্নপত্র</h2>
      <p className="mode-desc">আসল প্রশ্নপত্র হুবহু প্র্যাকটিস করুন — যেমনটা পরীক্ষার হলে আসবে।</p>

      {exams.length === 0 ? (
        <p className="mode-desc">
          এখনো কোনো প্রশ্নপত্র যোগ করা হয়নি। Supabase-এর "exams" ও "questions" টেবিলে ডেটা যোগ করুন।
        </p>
      ) : (
        <div className="exam-list">
          {exams.map((exam) => (
            <div className="exam-item" key={exam.id}>
              <div>
                <div className="ei-name">{exam.name}</div>
                <div className="ei-meta">{exam.organization || ""} {exam.year ? `· ${exam.year}` : ""}</div>
              </div>
              <button className="cta-primary" onClick={() => onStart({ mode: "exam", examId: exam.id })}>
                শুরু করুন
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
