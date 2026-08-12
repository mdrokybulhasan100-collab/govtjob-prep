// ============================================================
// FEATURE REGISTRY
//
// This is the single source of truth for which student-facing
// features exist and show up in the nav bar.
//
// TO REMOVE A FEATURE: delete its entry below (and its import).
//   That's it — TopBar and MainApp read this list automatically,
//   you never need to touch them.
//
// TO ADD A FEATURE: build a self-contained component under
//   src/components/ that reads everything it needs via
//   `useApp()` from src/lib/AppContext.jsx (no props needed),
//   then add one entry below.
//
// TO REORDER THE NAV: reorder this array.
// ============================================================

import Dashboard from "../components/Dashboard";
import PracticeSetup from "../components/PracticeSetup";
import QuizBuilder from "../components/QuizBuilder";
import LiveExam from "../components/LiveExam";
import SmartSearch from "../components/SmartSearch";
import Favorites from "../components/Favorites";
import ExamsList from "../components/ExamsList";
import SubscriptionPage from "../components/SubscriptionPage";

const features = [
  { key: "dashboard", label: "ড্যাশবোর্ড", component: Dashboard },
  { key: "practice", label: "প্র্যাকটিস", component: PracticeSetup },
  { key: "quizbuilder", label: "🎛️ কুইজ বিল্ডার", component: QuizBuilder },
  { key: "liveexam", label: "🔴 লাইভ পরীক্ষা", component: LiveExam },
  { key: "search", label: "🔍 কুইক সার্চ", component: SmartSearch },
  { key: "favorites", label: "🔖 রিভিশন লিস্ট", component: Favorites },
  { key: "exams", label: "📁 পরীক্ষা আর্কাইভ", component: ExamsList },
  { key: "subscription", label: "💳 সাবস্ক্রিপশন", component: SubscriptionPage }
];

export default features;
