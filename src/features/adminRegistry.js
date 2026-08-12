// ============================================================
// ADMIN TAB REGISTRY
//
// Admin sees EVERYTHING: the shared "editor tabs" (also usable by
// editors, see editorRegistry.js) PLUS admin-only tabs.
//
// TO REMOVE AN ADMIN TAB: delete its entry below (and its import).
// TO ADD ONE: build a component under src/components/admin/ that
//   accepts { subjects, topics, exams, refreshAll, flash } as needed,
//   then add an entry below.
// ============================================================

import { editorTabs } from "./editorRegistry";
import LiveExamsTab from "../components/admin/LiveExamsTab";
import AnnouncementsTab from "../components/admin/AnnouncementsTab";
import DailyFactsTab from "../components/admin/DailyFactsTab";
import UserManagementTab from "../components/admin/UserManagementTab";
import PaymentsTab from "../components/admin/PaymentsTab";

const adminTabs = [
  ...editorTabs,
  { key: "liveexams", label: "🔴 লাইভ পরীক্ষা", component: LiveExamsTab },
  { key: "payments", label: "💳 পেমেন্ট", component: PaymentsTab },
  { key: "announcements", label: "📢 বিজ্ঞপ্তি", component: AnnouncementsTab },
  { key: "dailyfacts", label: "💡 দৈনিক ফ্যাক্ট", component: DailyFactsTab },
  { key: "users", label: "👤 ইউজার ম্যানেজমেন্ট", component: UserManagementTab }
];

export default adminTabs;
