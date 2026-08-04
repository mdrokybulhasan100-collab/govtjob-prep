// src/components/QuestionCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const QuestionCard = ({ question, isAttended }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
      {/* হেডার: বিষয় ও ট্যাগ */}
      <div className="flex justify-between items-start mb-3">
        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
          {question.subject}
        </span>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded ${
            isAttended
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {isAttended ? '✅ Attended' : '⏳ Unattended'}
        </span>
      </div>

      {/* প্রশ্নের টেক্সট (সংক্ষিপ্ত) */}
      <p className="text-gray-800 font-medium mb-4 line-clamp-2">
        {question.question_text}
      </p>

      {/* স্টাডি মেটেরিয়াল */}
      {(question.video_url || question.pdf_url) && (
        <div className="flex gap-2 mb-4">
          {question.video_url && (
            <a
              href={question.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              🎥 ভিডিও ক্লাস
            </a>
          )}
          {question.pdf_url && (
            <a
              href={question.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              📄 PDF লেকচার
            </a>
          )}
        </div>
      )}

      {/* অ্যাকশন বাটন */}
      <div className="flex justify-between items-center mt-2">
        <Link
          to={`/question/${question.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          প্রশ্ন দেখুন →
        </Link>
        {question.exam_date && (
          <span className="text-xs text-gray-400">
            📅 {new Date(question.exam_date).toLocaleDateString('bn-BD')}
          </span>
        )}
      </div>
    </div>
  );
};

export default QuestionCard;
