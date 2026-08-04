// src/pages/CentralArchive.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../contexts/UserContext'; // আপনার ইউজার কনটেক্সট অনুযায়ী ইমপোর্ট করুন
import QuestionCard from '../components/QuestionCard';

const CentralArchive = () => {
  const { user } = useUser();
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all, attended, unattended
  const [subjects, setSubjects] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);

  // ১. সব প্রশ্ন ও ইউজারের উত্তর লোড করা
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // প্রশ্ন লোড
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .order('exam_date', { ascending: false });

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        return;
      }

      setQuestions(questionsData || []);
      setFilteredQuestions(questionsData || []);

      // ইউনিক সাবজেক্ট লিস্ট তৈরি
      const uniqueSubjects = [...new Set(questionsData?.map(q => q.subject) || [])];
      setSubjects(uniqueSubjects);

      // ইউজারের উত্তর লোড
      const { data: answersData, error: answersError } = await supabase
        .from('user_answers')
        .select('question_id')
        .eq('user_id', user.id);

      if (answersError) {
        console.error('Error fetching answers:', answersError);
        return;
      }

      setUserAnswers(answersData?.map(a => a.question_id) || []);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  // ২. সার্চ, ফিল্টার ও ট্যাগ অনুযায়ী ডাটা ফিল্টার করা
  useEffect(() => {
    let result = [...questions];

    // সার্চ ফিল্টার
    if (searchTerm) {
      result = result.filter(q =>
        q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.subject.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // সাবজেক্ট ফিল্টার
    if (selectedSubject !== 'all') {
      result = result.filter(q => q.subject === selectedSubject);
    }

    // Attended/Unattended ফিল্টার
    if (filterStatus === 'attended') {
      result = result.filter(q => userAnswers.includes(q.id));
    } else if (filterStatus === 'unattended') {
      result = result.filter(q => !userAnswers.includes(q.id));
    }

    setFilteredQuestions(result);
  }, [searchTerm, selectedSubject, filterStatus, questions, userAnswers]);

  if (loading) {
    return <div className="text-center py-10">লোড হচ্ছে...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">📚 সেন্ট্রাল আর্কাইভ</h1>
      <p className="text-center text-gray-600 mb-8">
        সকল বিষয়ের সব প্রশ্ন এক জায়গায়। খুঁজুন, ফিল্টার করুন এবং প্রস্তুতি নিন।
      </p>

      {/* সার্চ ও ফিল্টার বার */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          {/* সার্চ ইনপুট */}
          <input
            type="text"
            placeholder="বিষয় বা প্রশ্ন খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* সাবজেক্ট ফিল্টার */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">সব বিষয়</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>

          {/* Attended/Unattended ফিল্টার */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">সব (Attended + Unattended)</option>
            <option value="attended">শুধু Attended</option>
            <option value="unattended">শুধু Unattended</option>
          </select>
        </div>

        {/* Go to Date (ঐচ্ছিক) */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            নির্দিষ্ট তারিখের প্রশ্ন দেখুন:
          </label>
          <input
            type="date"
            onChange={(e) => {
              // এখানে আপনার ইমপ্লিমেন্টেশন অনুযায়ী কাজ করবে
              console.log('Selected date:', e.target.value);
            }}
            className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* প্রশ্নের তালিকা */}
      {filteredQuestions.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <p>কোন প্রশ্ন খুঁজে পাওয়া যায়নি।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuestions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              isAttended={userAnswers.includes(question.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CentralArchive;
