# সরকারি চাকরি প্রস্তুতি (Govt Job Prep App)

React + Supabase দিয়ে বানানো একটা প্রাইভেট প্র্যাকটিস অ্যাপ — Gmail দিয়ে লগইন,
বিষয়ভিত্তিক/টপিকভিত্তিক MCQ প্র্যাকটিস, পূর্ববর্তী বছরের প্রশ্নপত্র, এবং
প্রতিটা ইউজারের নিজস্ব প্রাইভেট প্রোগ্রেস ট্র্যাকিং।

**ডেটা প্রাইভেসি:** Supabase-এর Row Level Security (RLS) ব্যবহার করে নিশ্চিত করা
হয়েছে যে প্রতিটা ইউজার শুধু নিজের প্র্যাকটিস হিস্টোরি দেখতে/লিখতে পারবে। কোনো
ইউজারের ডেটা আরেকজনের একাউন্টে কখনো দেখা যাবে না — এটা কোড-লেভেল ফিল্টার না,
ডেটাবেজ-লেভেল নিয়ম (`schema.sql` ফাইলের RLS policies দেখুন), তাই বাইপাস করা যায় না।

সম্পূর্ণ ফ্রি টায়ারেই চলবে: Supabase ফ্রি প্ল্যান + Vercel/Netlify ফ্রি হোস্টিং।

---

## ধাপ ১: Supabase প্রজেক্ট বানান (ফ্রি, কার্ড লাগে না)

1. https://supabase.com এ গিয়ে সাইন আপ করুন
2. "New Project" ক্লিক করুন — একটা নাম দিন (যেমন `govtjob-prep`), একটা ডাটাবেজ পাসওয়ার্ড সেট করুন, রিজিয়ন হিসেবে **Singapore (ap-southeast-1)** বেছে নিন (বাংলাদেশ থেকে সবচেয়ে কাছে)
3. প্রজেক্ট তৈরি হতে ১-২ মিনিট লাগবে

## ধাপ ২: ডাটাবেজ টেবিল বানান

1. Supabase Dashboard-এ বাম পাশের মেনু থেকে **SQL Editor** এ যান
2. **New query** ক্লিক করুন
3. এই রিপোর দিয়ে আসা `schema.sql` ফাইলের **পুরো কনটেন্ট** কপি করে পেস্ট করুন
4. **Run** ক্লিক করুন — এতে সব টেবিল, প্রাইভেসি নিয়ম (RLS), এবং কিছু নমুনা প্রশ্ন তৈরি হয়ে যাবে

## ধাপ ৩: Google লগইন চালু করুন

1. Supabase Dashboard-এ **Authentication → Providers** এ যান
2. **Google** খুঁজে বের করে Enable করুন
3. Google Cloud Console (https://console.cloud.google.com) এ গিয়ে একটা OAuth Client ID বানাতে হবে:
   - **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs-এ Supabase-এর দেওয়া callback URL বসান (Supabase-এর Google provider পেজেই এটা দেখানো থাকবে, যেমন `https://xxxxx.supabase.co/auth/v1/callback`)
4. Google থেকে পাওয়া **Client ID** ও **Client Secret** Supabase-এর Google provider সেটিংসে বসিয়ে Save করুন

## ধাপ ৪: প্রজেক্টের Key কপি করুন

Supabase Dashboard-এ **Project Settings → API** এ যান, সেখান থেকে কপি করুন:
- **Project URL**
- **anon public** key

## ধাপ ৫: লোকালি চালান

```bash
npm install
cp .env.example .env
```

`.env` ফাইলটা খুলে ধাপ ৪ থেকে পাওয়া মান বসান:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxx
```

তারপর:
```bash
npm run dev
```

ব্রাউজারে `http://localhost:5173` খুলুন।

## ধাপ ৬: ফ্রি হোস্টিং-এ ডিপ্লয় করুন

**Vercel** (সবচেয়ে সহজ):
1. এই কোড GitHub-এ পুশ করুন
2. https://vercel.com এ গিয়ে GitHub রিপো import করুন
3. Environment Variables-এ `VITE_SUPABASE_URL` ও `VITE_SUPABASE_ANON_KEY` যোগ করুন
4. Deploy করুন

Deploy হওয়ার পর যে URL পাবেন (যেমন `https://your-app.vercel.app`), সেটা Supabase-এর
Authentication → URL Configuration-এ **Site URL** ও **Redirect URLs**-এ যোগ করে দিন,
নাহলে লাইভ সাইটে Google লগইন কাজ করবে না। একই কাজ Netlify দিয়েও করা যায়।

## নিজেকে Admin বানানো (Admin Panel ব্যবহার করতে)

Admin Panel এখন মূল অ্যাপের ভেতরে কোনো ট্যাব হিসেবে না — বরং **আলাদা URL**-এ থাকে:

```
https://your-app.vercel.app/admin
```

সাধারণ ইউজাররা এই লিংক জানলেও ভেতরে ঢুকতে পারবে না — Admin না হলে "এই পাতা শুধু
Admin-দের জন্য" মেসেজ দেখাবে। Subject, Topic, Exam (পূর্ববর্তী বছরের প্রশ্নপত্র),
Question যোগ/মুছা এবং প্রশ্ন **JSON দিয়ে bulk upload** — সবকিছু এখান থেকেই হয়।

**নিজেকে Admin বানানোর ধাপ:**
1. প্রথমে আপনার লাইভ সাইটে গিয়ে Gmail দিয়ে অন্তত একবার লগইন করুন (এতে আপনার প্রোফাইল রো তৈরি হবে)
2. Supabase Dashboard → **SQL Editor** → **New query**
3. এই রিপোর `admin_migration.sql` ফাইলের **পুরো কনটেন্ট** কপি-পেস্ট করে **Run** করুন
   (এটা `is_admin` কলাম ও Admin-only write নিয়ম তৈরি করবে)
4. ফাইলের একদম নিচে এই লাইনটা খেয়াল করুন:
   ```sql
   -- update public.profiles set is_admin = true where email = 'your-email@gmail.com';
   ```
   এটা **নতুন query** হিসেবে আলাদা করে চালান — শুরুর `--` কমেন্ট চিহ্ন সরিয়ে দিয়ে,
   আর `your-email@gmail.com` জায়গায় আপনার নিজের Gmail বসিয়ে **Run** করুন
5. এখন `https://your-app.vercel.app/admin` এ যান, Gmail দিয়ে লগইন করুন (যদি আগে থেকে
   লগইন না থাকে) — Admin Panel খুলে যাবে

⚠️ যাকে Admin বানাবেন সে Subject/Topic/Exam/Question যোগ-মুছা করতে পারবে — এটা শুধু
বিশ্বস্ত কাউকে (যেমন নিজেকে) দিন। এই Admin ক্ষমতা দিয়ে অন্য কারো ব্যক্তিগত
প্র্যাকটিস ডেটা/স্কোর দেখা যায় না — শুধু প্রশ্ন ব্যাংক এডিট করা যায়।

**টেকনিক্যাল নোট:** `/admin` একটা React route (client-side), সার্ভারে আলাদা কোনো
ফাইল/ফোল্ডার না। `vercel.json`-এ একটা rewrite rule দেওয়া আছে যাতে সরাসরি
`/admin` লিংকে গেলে বা রিফ্রেশ করলেও পেজ ঠিকভাবে লোড হয় — এটা এমনিতেই কাজ করবে,
আলাদা কিছু সেটাপ করতে হবে না।

## প্রশ্নের ধরন আপডেট (MCQ + Short Answer) — বিদ্যমান ডাটাবেজ থাকলে

যদি আপনি আগেই `schema.sql` ও `admin_migration.sql` চালিয়ে থাকেন, প্রশ্নে এখন দুই
ধরনের সাপোর্ট যোগ করতে একটা নতুন migration লাগবে:

1. Supabase Dashboard → **SQL Editor** → **New query**
2. এই রিপোর `questions_upgrade_migration.sql` ফাইলের পুরো কনটেন্ট কপি-পেস্ট করে **Run** করুন

এটা করবে:
- `question_type` কলাম যোগ করবে (`mcq` অথবা `short`, বিদ্যমান সব প্রশ্ন `mcq` থেকে যাবে)
- `short_answer` কলাম যোগ করবে (short-answer প্রশ্নের সঠিক উত্তর টেক্সট আকারে রাখার জন্য)
- MCQ-এর অপশন/সঠিক-উত্তর কলামগুলো আর বাধ্যতামূলক থাকবে না (short-answer প্রশ্নে এগুলো ফাঁকা থাকে)
- `difficulty` কলাম সম্পূর্ণ মুছে ফেলবে (আর ব্যবহার হয় না)

নতুনভাবে (fresh) সেটআপ করলে `schema.sql`-এই এসব থাকবে, আলাদা কিছু চালাতে হবে না।

## প্রশ্ন যোগ করা

**একটা একটা করে:** `/admin` পেজের "প্রশ্ন" ট্যাবে উপরে "প্রশ্নের ধরন" থেকে **MCQ** (৪টা
অপশন) অথবা **Short Answer** (সরাসরি টেক্সট উত্তর, যেমন "বাংলাদেশের রাজধানীর নাম কী?"
→ "ঢাকা") বেছে নিয়ে ফর্ম পূরণ করুন।

**একসাথে অনেকগুলো (JSON Bulk Upload):** `/admin` পেজের "প্রশ্ন" ট্যাবের নিচে একটা
textarea আছে, সেখানে এই ফরম্যাটে JSON বসিয়ে "JSON আপলোড করুন" চাপুন:

```json
[
  {
    "question_type": "mcq",
    "subject_slug": "bangla",
    "topic_name_en": "Grammar",
    "exam_slug": "",
    "question_text": "প্রশ্নটি এখানে লিখুন",
    "option_a": "ক",
    "option_b": "খ",
    "option_c": "গ",
    "option_d": "ঘ",
    "correct_option": "a",
    "explanation": "ব্যাখ্যা (ঐচ্ছিক)"
  },
  {
    "question_type": "short",
    "subject_slug": "gk",
    "topic_name_en": "Bangladesh Affairs",
    "exam_slug": "",
    "question_text": "বাংলাদেশের রাজধানীর নাম কী?",
    "short_answer": "ঢাকা",
    "explanation": ""
  }
]
```

- `question_type` — `mcq` অথবা `short`; না দিলে `mcq` ধরে নেওয়া হবে
- `subject_slug` — আবশ্যক, Admin Panel-এর "বিষয়" ট্যাবে যে slug দিয়েছেন সেটাই বসাতে হবে
- `topic_name_en` — ঐচ্ছিক, না দিলে টপিক ছাড়াই প্রশ্নটা যোগ হবে
- `exam_slug` — ঐচ্ছিক, দিলে প্রশ্নটা সেই প্রশ্নপত্রের অংশ হিসেবে গণ্য হবে
- MCQ হলে: `option_a`–`option_d` ও `correct_option` (`a`/`b`/`c`/`d`) আবশ্যক
- Short Answer হলে: `short_answer` আবশ্যক (এটাই সঠিক উত্তর হিসেবে মিলিয়ে দেখা হবে)

আপলোডের পর কোনো প্রশ্ন বাদ পড়লে (যেমন ভুল `subject_slug`) সেটার কারণ মেসেজে দেখানো হবে।

## পূর্ববর্তী বছরের প্রশ্নপত্র (Exam) Bulk Upload

শুধু প্রশ্ন না, **Exam-ও এখন JSON দিয়ে একসাথে অনেকগুলো যোগ করা যায়** — `/admin`
পেজের "প্রশ্নপত্র" ট্যাবের নিচে:

```json
[
  { "name": "৪৪তম বিসিএস প্রিলিমিনারি", "organization": "BPSC", "year": 2024, "slug": "bcs-44-preli" },
  { "name": "সহকারী শিক্ষক নিয়োগ পরীক্ষা", "organization": "DPE", "year": 2023, "slug": "primary-teacher-2023" }
]
```

একই `slug` আগে থেকে থাকলে সেটার তথ্য আপডেট হয়ে যাবে (ডুপ্লিকেট তৈরি হবে না)। এরপর
প্রশ্ন bulk upload করার সময় সংশ্লিষ্ট `exam_slug` ব্যবহার করে প্রশ্নগুলোকে এই
প্রশ্নপত্রের সাথে যুক্ত করতে পারবেন।

## ভবিষ্যতে নতুন ফিচার যোগ করা

কোনো নতুন ফিচার লাগলে (নতুন পেজ, ডিজাইন পরিবর্তন, নতুন কুইজ মোড, ইত্যাদি) — Claude-কে
বললেই কোড লিখে দেবে। এরপর:
1. যেসব ফাইল বদলেছে সেগুলো GitHub-এ পুরনোটার জায়গায় নতুন করে আপলোড করুন (Add file → Upload files, একই নামে থাকলে GitHub নিজে থেকেই ওভাররাইট করবে)
2. Vercel স্বয়ংক্রিয়ভাবে নতুন ভার্সন ডিপ্লয় করে দেবে (১-২ মিনিট)
3. কোনো টার্মিনাল/কমান্ড লাগবে না

## প্রজেক্ট স্ট্রাকচার

```
src/
  App.jsx              — রাউটার রুট ("/" → MainApp, "/admin" → AdminPage)
  MainApp.jsx           — মূল ইউজার-ফেসিং অ্যাপ ও কুইজ সেশন লজিক
  pages/
    AdminPage.jsx        — /admin রুট: নিজস্ব লগইন-চেক ও admin-গার্ড
  components/
    Login.jsx           — Google লগইন স্ক্রিন
    TopBar.jsx           — মূল অ্যাপের নেভিগেশন বার (admin লিংক নেই, ইচ্ছাকৃতভাবে গোপন)
    Dashboard.jsx        — ব্যক্তিগত প্রোগ্রেস + streak/level/badges (শুধু নিজের ডেটা)
    PracticeSetup.jsx    — সব বিষয়/একটা বিষয়/একটা টপিক বেছে নেওয়া
    Quiz.jsx             — OMR বাবল-শিট স্টাইলে প্রশ্ন-উত্তর
    Result.jsx           — সেশন শেষে ফলাফল (celebration + XP)
    ExamsList.jsx        — পূর্ববর্তী বছরের প্রশ্নপত্রের তালিকা
    Admin.jsx            — Admin Panel-এর মূল CRUD UI (AdminPage থেকে ব্যবহৃত হয়)
  lib/
    supabaseClient.js
    utils.js
schema.sql              — ডাটাবেজ স্কিমা + RLS প্রাইভেসি নিয়ম
admin_migration.sql      — is_admin কলাম ও Admin-only write নিয়ম (schema.sql-এর পরে চালান)
questions_upgrade_migration.sql — MCQ+Short Answer সাপোর্ট, difficulty বাদ (বিদ্যমান DB থাকলে চালান)
vercel.json              — SPA rewrite (যাতে সরাসরি /admin লিংক কাজ করে)
```
