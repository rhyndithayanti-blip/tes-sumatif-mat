import React, { useMemo, useState } from 'react';
import { CONFIG } from '../config';
import { ExamResult, Question } from '../types';
import { downloadStudentResultPDF } from '../utils/pdfGenerator';
import {
  analyzeStudentPerformance,
  formatCorrectAnswerDisplay,
  formatStudentAnswerDisplay,
  isResultTuntas,
} from '../utils/scoring';
import {
  X,
  Download,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  BookOpen,
  Lightbulb,
  Target,
} from 'lucide-react';

interface StudentDetailModalProps {
  result: ExamResult | null;
  questions: Question[];
  isOpen: boolean;
  onClose: () => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  result,
  questions,
  isOpen,
  onClose,
}) => {
  const [itemFilter, setItemFilter] = useState<'all' | 'wrong' | 'correct'>('all');

  const analysis = useMemo(() => {
    if (!result) return null;
    return analyzeStudentPerformance(questions, result);
  }, [result, questions]);

  if (!isOpen || !result || !analysis) return null;

  const isPass = isResultTuntas(result);

  const filteredQuestions = questions.filter((q) => {
    const ev = analysis.itemEvaluations[q.id];
    if (itemFilter === 'wrong') return ev.status !== 'correct';
    if (itemFilter === 'correct') return ev.status === 'correct';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Detail Analisis Siswa: {result.nama}
                </h3>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    isPass
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isPass ? 'TUNTAS' : 'REMEDIAL'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Absen {result.noAbsen} • Kelas {result.kelas || CONFIG.KELAS} • Durasi:{' '}
                <strong className="text-slate-700">{result.durasi || '-'}</strong> • Waktu Submit:{' '}
                {result.timestamp}
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

        {/* Scrollable Content */}
        <div className="overflow-y-auto py-5 space-y-6 pr-1 text-xs sm:text-sm">
          {/* Ringkasan Nilai & Ketuntasan */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1 text-center">
              <span className="text-[11px] text-slate-500 block font-semibold">Nilai Akhir</span>
              <span
                className={`text-3xl font-black block mt-0.5 ${
                  isPass ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {result.nilai}
              </span>
              <span className="text-[10px] text-slate-400">KKTP {CONFIG.KKTP}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[11px] text-blue-700 font-bold block">Total Skor</span>
              <span className="text-xl font-black text-blue-900 mt-0.5 block">
                {result.totalSkor ?? analysis.totalSkor}
                <span className="text-xs font-semibold text-blue-600">
                  {' '}
                  / {result.maxSkor ?? analysis.maxSkor}
                </span>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Benar Penuh
              </span>
              <span className="text-xl font-black text-emerald-900 mt-0.5 block">
                {result.benar} Soal
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] text-amber-700 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Benar Sebagian
              </span>
              <span className="text-xl font-black text-amber-900 mt-0.5 block">
                {result.benarSebagian ?? 0} Soal
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-[11px] text-rose-700 font-bold flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                Salah
              </span>
              <span className="text-xl font-black text-rose-900 mt-0.5 block">
                {result.salah} Soal
              </span>
            </div>
          </div>

          {/* Analisis Kelemahan Indikator / Topik Materi */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <span>Analisis Penguasaan Lingkup Materi &amp; Indikator Soal</span>
            </h4>

            {!analysis.hasDetail ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                Data detail jawaban per butir soal belum tersedia untuk rekaman hasil ini (kemungkinan berasal dari impor spreadsheet tanpa kolom detail JSON). Analisis per topik dan indikator hanya tersedia untuk hasil tes yang memiliki rincian jawaban.
              </p>
            ) : (
              <>
                {/* Ringkasan Cepat Nomor Soal Benar & Salah */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-slate-800">
                      Peta Butir Soal (No. 1 s.d. {questions.length}):
                    </span>
                    <span className="text-slate-500">
                      Hijau = Benar • Kuning = Sebagian • Merah = Salah
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {questions.map((q) => {
                      const ev = analysis.itemEvaluations[q.id];
                      const chipCls =
                        ev.status === 'correct'
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : ev.status === 'partial'
                          ? 'bg-amber-400 text-amber-950 border-amber-500'
                          : 'bg-rose-500 text-white border-rose-600';
                      return (
                        <span
                          key={q.id}
                          title={`Soal #${q.id} (${q.topic}): ${
                            ev.status === 'correct'
                              ? 'Benar'
                              : ev.status === 'partial'
                              ? 'Benar Sebagian'
                              : 'Salah'
                          }`}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-extrabold border ${chipCls}`}
                        >
                          {q.id}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 tabular-nums">
                  {analysis.topicMastery.map((tm) => (
                    <div
                      key={tm.topic}
                      className={`p-3.5 rounded-xl border bg-white space-y-2 ${
                        tm.isWeak ? 'border-rose-200' : 'border-emerald-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            {tm.topic}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Skor: {tm.earnedScore} / {tm.maxScore} ({tm.questionCount} soal)
                          </span>
                        </div>
                        <span
                          className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                            tm.isWeak
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {tm.percentage}%
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            tm.isWeak ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${tm.percentage}%` }}
                        />
                      </div>

                      <div className="text-[11px]">
                        {tm.wrongQuestionIds.length > 0 ? (
                          <span className="text-rose-700 font-medium">
                            Perlu penguatan di soal No: {tm.wrongQuestionIds.join(', ')}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">
                            Seluruh butir pada topik ini dikuasai dengan baik.
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Daftar Indikator yang Belum Dikuasai */}
                {analysis.weakIndicators.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-white border border-rose-200 space-y-2">
                    <p className="text-xs font-bold text-rose-800">
                      Indikator Soal yang Perlu Penguatan ({analysis.weakIndicators.length} Butir):
                    </p>
                    <ul className="space-y-1.5 text-[11px] text-slate-700 max-h-40 overflow-y-auto pr-1">
                      {analysis.weakIndicators.map((wi) => (
                        <li
                          key={wi.questionId}
                          className="flex items-start gap-2 p-2 rounded-lg bg-rose-50/60 border border-rose-100"
                        >
                          <span className="font-mono font-bold text-rose-800 shrink-0">
                            #{wi.questionId}
                          </span>
                          <div className="flex-1">
                            <span className="font-semibold text-slate-900">{wi.topic}: </span>
                            <span>{wi.indicator}</span>
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-rose-200 text-rose-700 shrink-0">
                            {wi.status === 'partial' ? 'Sebagian' : 'Salah'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Rekomendasi Tindak Lanjut / Remedial Spesifik */}
          <div className="p-4 sm:p-5 rounded-2xl border border-blue-200 bg-blue-50/60 space-y-2.5">
            <h4 className="text-xs sm:text-sm font-extrabold text-blue-950 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span>Rekomendasi Tindak Lanjut / Remedial Spesifik</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-800">
              {analysis.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-xl bg-white border border-blue-100 leading-relaxed"
                >
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* Rincian Jawaban Per Butir Soal */}
          {analysis.hasDetail && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Rincian Jawaban Butir Soal (No. 1 s.d. {questions.length})</span>
                </h4>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setItemFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                      itemFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({questions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemFilter('wrong')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                      itemFilter === 'wrong'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Salah / Sebagian
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemFilter('correct')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                      itemFilter === 'correct'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Benar Penuh
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">No</th>
                      <th className="py-2.5 px-3">Lingkup Materi &amp; Tipe</th>
                      <th className="py-2.5 px-3">Jawaban Siswa</th>
                      <th className="py-2.5 px-3">Kunci Jawaban</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Skor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredQuestions.map((q) => {
                      const ev = analysis.itemEvaluations[q.id];
                      const badgeCls =
                        ev.status === 'correct'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ev.status === 'partial'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800';
                      const badgeTxt =
                        ev.status === 'correct'
                          ? 'Benar'
                          : ev.status === 'partial'
                          ? 'Sebagian'
                          : 'Salah';

                      return (
                        <tr key={q.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                            #{q.id}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block">{q.topic}</span>
                            <span className="text-[10px] text-slate-500 uppercase">
                              {q.type === 'pg'
                                ? 'Pilihan Ganda'
                                : q.type === 'pgk_kategori'
                                ? 'PGK Kategori'
                                : q.type === 'isian'
                                ? 'Isian Singkat'
                                : 'PGK'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-[200px]">
                            {formatStudentAnswerDisplay(q, ev.studentAnswer)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-800 max-w-[200px]">
                            {formatCorrectAnswerDisplay(q)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeCls}`}>
                              {badgeTxt}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                            {ev.score}/{ev.maxScore}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={() => downloadStudentResultPDF(result)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Lembar Hasil (PDF)</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
