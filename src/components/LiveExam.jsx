import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { useApp } from "../lib/AppContext";

export default function LiveExam() {
  const { user, startLiveExam: onStartLiveExam } = useApp();
  const [liveExams, setLiveExams] = useState([]);
  const [attendedIds, setAttendedIds] = useState(new Set());
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [leaderboardFor, setLeaderboardFor] = useState(null); // { id, title } or null
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);

  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: exams }, { data: sessions }] = await Promise.all([
      supabase.from("live_exams").select("*").order("start_at", { ascending: true }),
      supabase.from("practice_sessions").select("live_exam_id").eq("user_id", user.id).eq("mode", "live").not("live_exam_id", "is", null).not("completed_at", "is", null)
    ]);
    setLiveExams(exams || []);
    setAttendedIds(new Set((sessions || []).map((s) => s.live_exam_id)));
    setLoading(false);
  }

  async function openLeaderboard(le) {
    setLeaderboardFor({ id: le.id, title: le.title });
    setLoadingBoard(true);
    const { data, error } = await supabase.rpc("live_exam_leaderboard", { p_live_exam_id: le.id });
    if (!error) setLeaderboardRows(data || []);
    setLoadingBoard(false);
  }

  function statusOf(le) {
    const start = new Date(le.start_at).getTime();
    const end = start + le.duration_minutes * 60 * 1000;
    if (now < start) return "upcoming";
    if (now < end) return "ongoing";
    return "ended";
  }

  async function handleJoin(le) {
    const start = new Date(le.start_at).getTime();
    const end = start + le.duration_minutes * 60 * 1000;
    const secondsLeftInWindow = Math.max(30, Math.floor((end - now) / 1000));
    const timeLimitSeconds = Math.min(le.duration_minutes * 60, secondsLeftInWindow);
    await onStartLiveExam(le, timeLimitSeconds);
  }

  if (leaderboardFor) {
    return (
      <section className="view">
        <button className="cta-ghost" onClick={() => setLeaderboardFor(null)} style={{ marginBottom: 16 }}>← তালিকায় ফিরুন</button>
        <h2 className="section-title" style={{ marginTop: 0 }}>🏅 {leaderboardFor.title}</h2>
        <p className="mode-desc">সবার নাম ও স্কোর সহ পূর্ণ র‍্যাংকিং।</p>

        {loadingBoard && <p className="mode-desc">লোড হচ্ছে...</p>}
        {!loadingBoard && leaderboardRows.length === 0 && (
          <p className="mode-desc">এখনো কেউ এই পরীক্ষা সম্পন্ন করেনি।</p>
        )}
        {!loadingBoard && leaderboardRows.length > 0 && (
          <table className="leader-table">
            <thead><tr><th>র‍্যাংক</th><th>নাম</th><th>স্কোর</th></tr></thead>
            <tbody>
              {leaderboardRows.map((row) => (
                <tr key={row.rank} className={row.is_me ? "leader-me" : ""}>
                  <td>{toBn(row.rank)}</td>
                  <td>{row.full_name} {row.is_me && <span className="chip chip-level" style={{ padding: "3px 10px", fontSize: 11, marginLeft: 6 }}>আপনি</span>}</td>
                  <td>{toBn(row.correct_answers)} / {toBn(row.total_questions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  }

  return (
    <section className="view">
      <h2 className="section-title">🔴 লাইভ পরীক্ষা</h2>
      <p className="mode-desc">নির্ধারিত সময়ে সবাই একসাথে পরীক্ষা দিন, শেষে সবার সাথে র‍্যাংক তুলনা করুন — এই লিডারবোর্ডে নাম দেখা যায় (আপনার সাধারণ প্র্যাকটিস ডেটা এতে প্রভাবিত হয় না, সেটা আগের মতোই প্রাইভেট)।</p>

      {loading && <p className="mode-desc">লোড হচ্ছে...</p>}
      {!loading && liveExams.length === 0 && (
        <p className="mode-desc">এখনো কোনো লাইভ পরীক্ষা নির্ধারণ করা হয়নি।</p>
      )}

      {!loading && liveExams.length > 0 && (
        <div className="exam-list">
          {liveExams.map((le) => {
            const status = statusOf(le);
            const attended = attendedIds.has(le.id);
            return (
              <div className="exam-item" key={le.id}>
                <div>
                  <div className="ei-name">
                    {le.title}{" "}
                    <span className={`attend-tag ${status === "ongoing" ? "attended" : "unattended"}`}>
                      {status === "upcoming" && "শীঘ্রই শুরু হবে"}
                      {status === "ongoing" && "🔴 লাইভ চলছে"}
                      {status === "ended" && "শেষ হয়েছে"}
                    </span>
                  </div>
                  <div className="ei-meta">
                    শুরু: {new Date(le.start_at).toLocaleString("bn-BD")} · {toBn(le.duration_minutes)} মিনিট · {toBn(le.question_count)}টি প্রশ্ন
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {status === "ongoing" && !attended && (
                    <button className="cta-primary" onClick={() => handleJoin(le)}>পরীক্ষায় যোগ দিন</button>
                  )}
                  {(status === "ended" || attended) && (
                    <button className="cta-ghost" onClick={() => openLeaderboard(le)}>🏅 র‍্যাংকিং দেখুন</button>
                  )}
                  {status === "upcoming" && (
                    <button className="cta-primary" disabled>অপেক্ষা করুন</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
