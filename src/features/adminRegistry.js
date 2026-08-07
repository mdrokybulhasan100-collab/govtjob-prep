// ============================================================
// ADMIN TAB REGISTRY
//
// TO REMOVE AN ADMIN TAB: delete its entry below (and its import).
// TO ADD ONE: build a component under src/components/admin/ that
//   accepts { subjects, topics, exams, refreshAll, flash } as needed,
//   then add an entry below.
// ============================================================

import SubjectsTab from "../components/admin/SubjectsTab";
import TopicsTab from "../components/admin/TopicsTab";
import ExamsTab from "../components/admin/ExamsTab";
import QuestionsTab from "../components/admin/QuestionsTab";
import LiveExamsTab from "../components/admin/LiveExamsTab";
import AnnouncementsTab from "../components/admin/AnnouncementsTab";
import DailyFactsTab from "../components/admin/DailyFactsTab";

const adminTabs = [
  { key: "subjects", label: "বিষয়", component: SubjectsTab },
  { key: "topics", label: "টপিক", component: TopicsTab },
  { key: "exams", label: "প্রশ্নপত্র", component: ExamsTab },
  { key: "questions", label: "প্রশ্ন", component: QuestionsTab },
  { key: "liveexams", label: "🔴 লাইভ পরীক্ষা", component: LiveExamsTab },
  { key: "announcements", label: "📢 বিজ্ঞপ্তি", component: AnnouncementsTab },
  { key: "dailyfacts", label: "💡 দৈনিক ফ্যাক্ট", component: DailyFactsTab }
];

export default adminTabs;
