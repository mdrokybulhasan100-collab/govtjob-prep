// CentralArchive.jsx - সম্পূর্ণ নতুন কোড (কোনো কনটেক্সট ছাড়া)
import React, { useState, useEffect } from 'react';
import { supabase } from './src/lib/supabaseClient';

const CentralArchive = () => {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [subjects, setSubjects] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);

  // ইউজার চেক করা (কোনো কনটেক্সট ছাড়া)
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    getUser();
  }, []);

  // ডাটা লোড করা
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (questionsError) {
        console.error('Error:', questionsError);
        setLoading(false);
        return;
      }

      setQuestions(questionsData || []);
      setFilteredQuestions(questionsData || []);

      const uniqueSubjects = [...new Set(questionsData?.map(q => q.subject) || [])];
      setSubjects(uniqueSubjects);

      const { data: answersData } = await supabase
        .from('user_answers')
        .select('question_id')
        .eq('user_id', user.id);

      setUserAnswers(answersData?.map(a => a.question_id) || []);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  // ফিল্টার
  useEffect(() => {
    let result = [...questions];
    if (searchTerm) {
      result = result.filter(q =>
        q.question_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.subject?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedSubject !== 'all') {
      result = result.filter(q => q.subject === selectedSubject);
    }
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

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">দয়া করে লগইন করুন</h2>
        <a href="/" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg">
          হোমপেজে যান
        </a>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">📚 সেন্ট্রাল আর্কাইভ</h1>

      {/* সার্চ ও ফিল্টার */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="বিষয় বা প্রশ্ন খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2 border rounded-lg"
          />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="p-2 border rounded-lg"
          >
            <option value="all">সব বিষয়</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="p-2 border rounded-lg"
          >
            <option value="all">সব</option>
            <option value="attended">শুধু Attended</option>
            <option value="unattended">শুধু Unattended</option>
          </select>
        </div>
      </div>

      {/* প্রশ্নের তালিকা */}
      {filteredQuestions.length === 0 ? (
        <div className="text-center py-10 text-gray-500">কোন প্রশ্ন খুঁজে পাওয়া যায়নি।</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuestions.map((q) => {
            const attended = userAnswers.includes(q.id);
            return (
              <div key={q.id} className="bg-white rounded-lg shadow-md p-6 border">
                <div className="flex justify-between items-start mb-3">
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    {q.subject || 'বিষয়হীন'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${attended ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                    {attended ? '✅ Attended' : '⏳ Unattended'}
                  </span>
                </div>
                <p className="text-gray-800 font-medium mb-4 line-clamp-2">
                  {q.question_text || 'প্রশ্ন নেই'}
                </p>
                <a href={`/question/${q.id}`} className="text-sm text-blue-600 hover:underline">
                  প্রশ্ন দেখুন →
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CentralArchive;
