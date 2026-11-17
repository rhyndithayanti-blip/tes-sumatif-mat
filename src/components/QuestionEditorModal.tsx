import React, { useState, useEffect } from 'react';
import {
  Question,
  OptionItem,
  StatementItem,
  Difficulty,
  CognitiveLevel,
  ElementType,
} from '../types';
import { X, Save, Edit3 } from 'lucide-react';

interface QuestionEditorModalProps {
  question: Question | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedQuestion: Question) => void;
}

const ELEMENT_OPTIONS: ElementType[] = [
  'Bilangan',
  'Aljabar',
  'Pengukuran',
  'Geometri',
  'Analisis Data dan Peluang',
];

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  question,
  isOpen,
  onClose,
  onSave,
}) => {
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [element, setElement] = useState<ElementType>('Bilangan');
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>('L1');
  const [difficulty, setDifficulty] = useState<Difficulty>('Mudah');
  const [weight, setWeight] = useState<number>(2);
  const [indicator, setIndicator] = useState('');
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<string | string[]>('A');
  const [acceptedAnswersText, setAcceptedAnswersText] = useState('');
  const [statements, setStatements] = useState<StatementItem[]>([]);

  useEffect(() => {
    if (question) {
      setText(question.text);
      setTopic(question.topic);
      setElement(question.element || 'Bilangan');
      setCognitiveLevel(question.cognitiveLevel || 'L1');
      setDifficulty(question.difficulty);
      setWeight(question.weight ?? 2);
      setIndicator(question.indicator || '');
      setExplanation(question.explanation);
      setOptions(question.options ? JSON.parse(JSON.stringify(question.options)) : []);
      setCorrectAnswer(
        question.correctAnswer ?? (question.type === 'pgk' ? [] : question.type === 'isian' ? '' : 'A')
      );
      setAcceptedAnswersText((question.acceptedAnswers || []).join(', '));
      setStatements(question.statements ? JSON.parse(JSON.stringify(question.statements)) : []);
    }
  }, [question]);

  if (!isOpen || !question) return null;

  const handleOptionTextChange = (idx: number, newText: string) => {
    const updated = [...options];
    updated[idx].text = newText;
    setOptions(updated);
  };

  const handleTogglePgkCorrect = (optId: string) => {
    const currentList = Array.isArray(correctAnswer) ? [...correctAnswer] : [];
    if (currentList.includes(optId)) {
      setCorrectAnswer(currentList.filter((id) => id !== optId));
    } else {
      setCorrectAnswer([...currentList, optId]);
    }
  };

  const handleStatementTextChange = (idx: number, newText: string) => {
    const updated = [...statements];
    updated[idx].text = newText;
    setStatements(updated);
  };

  const handleStatementAnswerChange = (idx: number, val: boolean) => {
    const updated = [...statements];
    updated[idx].correctAnswer = val;
    setStatements(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAccepted =
      question.type === 'isian'
        ? acceptedAnswersText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const updated: Question = {
      ...question,
      text: text.trim(),
      topic: topic.trim(),
      element,
      cognitiveLevel,
      difficulty,
      weight: Math.max(1, Number(weight) || 1),
      indicator: indicator.trim(),
      explanation: explanation.trim(),
      options: question.type === 'pg' || question.type === 'pgk' ? options : undefined,
      statements: question.type === 'pgk_kategori' ? statements : undefined,
      correctAnswer: question.type !== 'pgk_kategori' ? correctAnswer : undefined,
      acceptedAnswers: parsedAccepted,
    };

    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Edit Soal Nomor {question.id}
              </h3>
              <p className="text-xs text-slate-500">
                Tipe: {question.type.toUpperCase()} • {question.topic}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 pr-1 text-xs sm:text-sm">
          {/* Topik, Elemen, Level Kognitif, Kesulitan, Bobot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lingkup Materi / Topik
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Elemen / Kompetensi
              </label>
              <select
                value={element}
                onChange={(e) => setElement(e.target.value as ElementType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {ELEMENT_OPTIONS.map((el) => (
                  <option key={el} value={el}>
                    {el}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Level Kognitif
              </label>
              <select
                value={cognitiveLevel}
                onChange={(e) => setCognitiveLevel(e.target.value as CognitiveLevel)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="L1">L1 (Pemahaman)</option>
                <option value="L2">L2 (Penerapan)</option>
                <option value="L3">L3 (Penalaran)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tingkat Kesukaran
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Mudah">Mudah</option>
                <option value="Sedang">Sedang</option>
                <option value="Sukar">Sukar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bobot Skor
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Indikator Soal (Kisi-kisi) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Indikator Soal (untuk Kisi-Kisi)
            </label>
            <input
              type="text"
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Teks Pertanyaan Soal */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Teks Butir Soal
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              required
            />
          </div>

          {/* Opsi Jawaban untuk PG */}
          {question.type === 'pg' && (
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                Pilihan Jawaban &amp; Tentukan Kunci Jawaban (Pilih Radio)
              </label>
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-opt-pg"
                    id={`opt-radio-${opt.id}`}
                    checked={correctAnswer === opt.id}
                    onChange={() => setCorrectAnswer(opt.id)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="w-6 font-bold text-slate-700 text-xs">{opt.id}.</span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              ))}
            </div>
          )}

          {/* Opsi Jawaban untuk PGK */}
          {question.type === 'pgk' && (
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                Pilihan Jawaban &amp; Tentukan Kunci Jawaban (Centang yang Benar)
              </label>
              {options.map((opt, idx) => {
                const currentArr = Array.isArray(correctAnswer) ? correctAnswer : [];
                const isChecked = currentArr.includes(opt.id);

                return (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`opt-check-${opt.id}`}
                      checked={isChecked}
                      onChange={() => handleTogglePgkCorrect(opt.id)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="w-6 font-bold text-slate-700 text-xs">{opt.id}.</span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Pernyataan untuk PGK Kategori */}
          {question.type === 'pgk_kategori' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                {statements.length} Deskripsi Pernyataan &amp; Respons Benar / Salah
              </label>
              {statements.map((st, idx) => (
                <div key={st.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">
                      Pernyataan #{idx + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name={`statement-${st.id}`}
                          checked={st.correctAnswer === true}
                          onChange={() => handleStatementAnswerChange(idx, true)}
                        />
                        <span className="text-emerald-700 font-bold">Benar</span>
                      </label>
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name={`statement-${st.id}`}
                          checked={st.correctAnswer === false}
                          onChange={() => handleStatementAnswerChange(idx, false)}
                        />
                        <span className="text-rose-700 font-bold">Salah</span>
                      </label>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={st.text}
                    onChange={(e) => handleStatementTextChange(idx, e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              ))}
            </div>
          )}

          {/* Kunci Jawaban untuk Isian */}
          {question.type === 'isian' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kunci Jawaban Utama (Isian Singkat)
                </label>
                <input
                  type="text"
                  value={typeof correctAnswer === 'string' ? correctAnswer : ''}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Variasi Jawaban Diterima (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={acceptedAnswersText}
                  onChange={(e) => setAcceptedAnswersText(e.target.value)}
                  placeholder="Contoh: 750, Rp750"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Pembahasan Soal */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pembahasan Soal
            </label>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
