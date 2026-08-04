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

## নিজের প্রশ্ন যোগ করা

`schema.sql`-এ কয়েকটা নমুনা প্রশ্ন আছে শুধু টেস্ট করার জন্য। আসল প্রশ্ন যোগ করতে
Supabase Dashboard-এর **Table Editor → questions** এ গিয়ে সরাসরি রো যোগ করতে পারেন,
অথবা CSV import করতে পারেন। প্রতিটা প্রশ্নে `subject_id`, `topic_id` (ঐচ্ছিক),
`exam_id` (ঐচ্ছিক — পূর্ববর্তী বছরের প্রশ্নপত্রের অংশ হলে) বসাতে হবে।

## প্রজেক্ট স্ট্রাকচার

```
src/
  App.jsx              — মূল রাউটিং ও কুইজ সেশন লজিক
  components/
    Login.jsx           — Google লগইন স্ক্রিন
    TopBar.jsx           — নেভিগেশন বার
    Dashboard.jsx        — ব্যক্তিগত প্রোগ্রেস (শুধু নিজের ডেটা)
    PracticeSetup.jsx    — সব বিষয়/একটা বিষয়/একটা টপিক বেছে নেওয়া
    Quiz.jsx             — OMR বাবল-শিট স্টাইলে প্রশ্ন-উত্তর
    Result.jsx           — সেশন শেষে ফলাফল
    ExamsList.jsx        — পূর্ববর্তী বছরের প্রশ্নপত্রের তালিকা
  lib/
    supabaseClient.js
    utils.js
schema.sql              — ডাটাবেজ স্কিমা + RLS প্রাইভেসি নিয়ম
```
