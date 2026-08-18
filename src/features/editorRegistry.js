// ============================================================
// EDITOR TAB REGISTRY
//
// These tabs are usable by BOTH admins and editors — content
// (subjects/topics/exams/questions), not admin-only settings.
// adminRegistry.js includes this same list plus admin-only tabs.
//
// TO REMOVE A TAB FROM EDITOR ACCESS: delete its entry below.
// ============================================================

import SubjectsTab from "../components/admin/SubjectsTab";
import TopicsTab from "../components/admin/TopicsTab";
import ExamsTab from "../components/admin/ExamsTab";
import QuestionsTab from "../components/admin/QuestionsTab";

export const editorTabs = [
  { key: "subjects", label: "বিষয়", component: SubjectsTab },
  { key: "topics", label: "টপিক", component: TopicsTab },
  { key: "exams", label: "প্রশ্নপত্র", component: ExamsTab },
  { key: "questions", label: "প্রশ্ন", component: QuestionsTab }
];

export default editorTabs;
