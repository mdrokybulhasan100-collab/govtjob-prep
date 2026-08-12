import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { toBn } from "../../lib/utils";
import { packageByKey } from "../../lib/packages";

const ROLE_LABELS = { user: "ইউজার", editor: "এডিটর", admin: "অ্যাডমিন" };

export default function UserManagementTab({ flash }) {
  const [users, setUsers] = useState([]);
  const [subsByUser, setSubsByUser] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: subs }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*").eq("status", "approved").order("expires_at", { ascending: false })
    ]);
    if (error) flash("err", error.message);
    setUsers(data || []);
    const byUser = {};
    (subs || []).forEach((s) => {
      if (!byUser[s.user_id]) byUser[s.user_id] = s; // first = latest (already sorted desc)
    });
    setSubsByUser(byUser);
    setLoading(false);
  }

  async function changeRole(id, role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "রোল আপডেট হয়েছে");
    load();
  }

  async function approveEditor(id) {
    const { error } = await supabase.from("profiles").update({ role: "editor", editor_status: "approved" }).eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "এডিটর হিসেবে অনুমোদন দেওয়া হয়েছে");
    load();
  }

  async function rejectEditor(id) {
    const { error } = await supabase.from("profiles").update({ editor_status: "rejected" }).eq("id", id);
    if (error) return flash("err", error.message);
    flash("ok", "আবেদন প্রত্যাখ্যান করা হয়েছে");
    load();
  }

  const pendingApplicants = users.filter((u) => u.editor_status === "pending");
  const otherUsers = users.filter((u) => u.editor_status !== "pending");

  if (loading) return <p className="mode-desc">লোড হচ্ছে...</p>;

  return (
    <div>
      {pendingApplicants.length > 0 && (
        <>
          <h3 style={{ marginTop: 0 }}>⏳ এডিটর আবেদনকারী ({pendingApplicants.length})</h3>
          <p className="mode-desc">
            এরা <code>/editor</code> লিংক থেকে সাইনআপ করেছেন, এখনো অনুমোদনের অপেক্ষায়।
          </p>
          <table className="admin-table" style={{ marginBottom: 28 }}>
            <thead><tr><th>নাম</th><th>ইমেইল</th><th>আবেদনের সময়</th><th></th></tr></thead>
            <tbody>
              {pendingApplicants.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name || "—"}</td>
                  <td>{u.email}</td>
                  <td>{u.editor_requested_at ? new Date(u.editor_requested_at).toLocaleDateString("bn-BD") : "—"}</td>
                  <td className="admin-row-actions">
                    <button className="cta-small" onClick={() => approveEditor(u.id)}>✓ অনুমোদন</button>
                    <button className="cta-danger" onClick={() => rejectEditor(u.id)}>✗ বাতিল</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 style={{ marginTop: 0 }}>সব ইউজার ({otherUsers.length})</h3>
      <table className="admin-table">
        <thead><tr><th>নাম</th><th>ইমেইল</th><th>যোগাযোগ</th><th>রোল</th><th>সাবস্ক্রিপশন</th><th>যোগদান</th></tr></thead>
        <tbody>
          {otherUsers.map((u) => {
            const sub = subsByUser[u.id];
            const daysLeft = sub ? Math.ceil((new Date(sub.expires_at) - new Date()) / 86400000) : null;
            const isExpiringSoon = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
            const isExpired = daysLeft !== null && daysLeft < 0;
            return (
              <tr key={u.id}>
                <td>
                  {u.full_name || "—"}
                  {u.editor_status === "rejected" && (
                    <span className="attend-tag unattended" style={{ marginLeft: 6 }}>এডিটর আবেদন বাতিল হয়েছে</span>
                  )}
                </td>
                <td>{u.email}</td>
                <td>{u.contact_number || "—"}</td>
                <td>
                  <select value={u.role || "user"} onChange={(e) => changeRole(u.id, e.target.value)}>
                    <option value="user">{ROLE_LABELS.user}</option>
                    <option value="editor">{ROLE_LABELS.editor}</option>
                    <option value="admin">{ROLE_LABELS.admin}</option>
                  </select>
                </td>
                <td>
                  {!sub && <span style={{ color: "var(--ink-soft)" }}>—</span>}
                  {sub && (
                    <span className={`attend-tag ${isExpired ? "unattended" : isExpiringSoon ? "unattended" : "attended"}`}>
                      {packageByKey(sub.package)?.label} · {isExpired ? "মেয়াদ শেষ" : `${toBn(daysLeft)} দিন বাকি`}
                    </span>
                  )}
                </td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString("bn-BD") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
