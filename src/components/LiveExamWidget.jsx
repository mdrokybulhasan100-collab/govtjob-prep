import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toBn } from "../lib/utils";
import { useApp } from "../lib/AppContext";

function formatCountdown(ms) {
  if (ms <= 0) return "শুরু হয়ে গেছে";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${toBn(d)}দ ${toBn(h)}ঘ ${toBn(m)}মি`;
  if (h > 0) return `${toBn(h)}ঘ ${toBn(m)}মি ${toBn(s)}সে`;
  return `${toBn(m)}মি ${toBn(s)}সে`;
}

export default function LiveExamWidget() {
  const { setView } = useApp();
  const [nextExam, setNextExam] = useState(null);
  const [status, setStatus] = useState(null); // "upcoming" | "ongoing"
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("live_exams").select("*").order("start_at", { ascending: true });
    const rows = data || [];
    const current = Date.now();
    const ongoing = rows.find((le) => {
      const start = new Date(le.start_at).getTime();
      const end = start + le.duration_minutes * 60 * 1000;
      return current >= start && current < end;
    });
    const upcoming = rows.find((le) => new Date(le.start_at).getTime() > current);
    if (ongoing) { setNextExam(ongoing); setStatus("ongoing"); }
    else if (upcoming) { setNextExam(upcoming); setStatus("upcoming"); }
    else { setNextExam(null); setStatus(null); }
    setLoading(false);
  }

  if (loading) return null;
  if (!nextExam) {
    return (
      <div className="widget-card">
        <span className="widget-title">🔴 লাইভ পরীক্ষা</span>
        <p className="mode-desc" style={{ margin: "8px 0 0" }}>এই মুহূর্তে কোনো লাইভ পরীক্ষা নির্ধারিত নেই।</p>
      </div>
    );
  }

  const start = new Date(nextExam.start_at).getTime();
  const end = start + nextExam.duration_minutes * 60 * 1000;
  const remaining = status === "ongoing" ? end - now : start - now;

  return (
    <div className="widget-card widget-live">
      <span className="widget-title">🔴 লাইভ পরীক্ষা</span>
      <p className="widget-live-name">{nextExam.title}</p>
      <p className="widget-live-status">
        {status === "ongoing" ? "এখন চলছে — শেষ হতে বাকি:" : "শুরু হতে বাকি:"}{" "}
        <strong>{formatCountdown(remaining)}</strong>
      </p>
      <button className="cta-small" onClick={() => setView("liveexam")}>
        {status === "ongoing" ? "এখনই যোগ দিন →" : "বিস্তারিত দেখুন →"}
      </button>
    </div>
  );
}
