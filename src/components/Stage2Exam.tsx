import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CONFIG } from '../config';
import {
  Question,
  ShuffledQuestion,
  StudentIdentity,
  AnswerValue,
  ExamResult,
  OptionItem,
} from '../types';
import { gasService } from '../services/gasService';
import { downloadExamQuestionsPDF } from '../utils/pdfGenerator';
import { evaluateExam, formatDuration } from '../utils/scoring';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Download,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  User,
  Check,
  Image as ImageIcon,
} from 'lucide-react';

interface Stage2ExamProps {
  student: StudentIdentity;
  questions: Question[];
  onFinishExam: (result: ExamResult) => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const Stage2Exam: React.FC<Stage2ExamProps> = ({
  student,
  questions,
  onFinishExam,
}) => {
  // Waktu mulai ujian untuk melacak durasi pengerjaan siswa
  const startTimeRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Acak urutan soal dan opsi jawaban saat tes dimulai
  const shuffledQuestions = useMemo<ShuffledQuestion[]>(() => {
    const shuffledQ: Question[] = shuffleArray<Question>(questions);

    return shuffledQ.map((q: Question) => {
      if (q.type === 'pg' || q.type === 'pgk') {
        if (q.options && q.options.length > 0) {
          const shuffledOpts: OptionItem[] = shuffleArray<OptionItem>(q.options);
          const standardLabels = ['A', 'B', 'C', 'D'];
          const remappedOptions: OptionItem[] = shuffledOpts.map((opt, idx) => ({
            id: standardLabels[idx] || opt.id,
            text: opt.text,
          }));

          return {
            ...q,
            originalQuestionId: q.id,
            shuffledOptions: remappedOptions,
          };
        }
      }
      return {
        ...q,
        originalQuestionId: q.id,
      };
    });
  }, [questions]);

  const [currentIndex, setCurrentIndex] = useState(0);
  // Simpan jawaban keyed by canonical question.id (1..30) agar Analisis Butir Soal akurat!
  const [answersById, setAnswersById] = useState<Record<number, AnswerValue>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const currentQ = shuffledQuestions[currentIndex];
  const totalQuestions = shuffledQuestions.length;

  useEffect(() => {
    setImageLoadFailed(false);
  }, [currentQ?.originalQuestionId]);

  // Cek apakah soal pada posisi idx sudah dijawab
  const isQuestionAnswered = (idx: number): boolean => {
    const q = shuffledQuestions[idx];
    const ans = answersById[q.originalQuestionId];
    if (ans === undefined || ans === null) return false;

    if (q.type === 'pg' || q.type === 'isian') {
      return typeof ans === 'string' && ans.trim().length > 0;
    }
    if (q.type === 'pgk') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (q.type === 'pgk_kategori') {
      if (typeof ans === 'object' && !Array.isArray(ans)) {
        const statements = q.statements || [];
        return statements.every((st) => ans[st.id] !== undefined);
      }
      return false;
    }
    return false;
  };

  const answeredCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < totalQuestions; i++) {
      if (isQuestionAnswered(i)) count++;
    }
    return count;
  }, [answersById, totalQuestions, shuffledQuestions]);

  const allAnswered = answeredCount === totalQuestions;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // Handler Pilihan Ganda (PG)
  const handleSelectPG = (optionText: string) => {
    const qId = currentQ.originalQuestionId;
    setAnswersById((prev) => ({
      ...prev,
      [qId]: optionText,
    }));
  };

  // Handler Pilihan Ganda Kompleks (PGK)
  const handleTogglePGK = (optionText: string) => {
    const qId = currentQ.originalQuestionId;
    setAnswersById((prev) => {
      const currentList = Array.isArray(prev[qId]) ? (prev[qId] as string[]) : [];
      if (currentList.includes(optionText)) {
        return {
          ...prev,
          [qId]: currentList.filter((item) => item !== optionText),
        };
      } else {
        return {
          ...prev,
          [qId]: [...currentList, optionText],
        };
      }
    });
  };

  // Handler PGK Kategori (Benar / Salah)
  const handleSetCategoryStatement = (statementId: string, value: boolean) => {
    const qId = currentQ.originalQuestionId;
    setAnswersById((prev) => {
      const currentMap =
        typeof prev[qId] === 'object' && !Array.isArray(prev[qId])
          ? { ...(prev[qId] as Record<string, boolean>) }
          : {};
      currentMap[statementId] = value;
      return {
        ...prev,
        [qId]: currentMap,
      };
    });
  };

  // Handler Isian Singkat
  const handleChangeIsian = (value: string) => {
    const qId = currentQ.originalQuestionId;
    setAnswersById((prev) => ({
      ...prev,
      [qId]: value,
    }));
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex(currentIndex + 1);
  };

  const calculateResult = (): ExamResult => {
    const finalSeconds = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    const evaluation = evaluateExam(questions, answersById);

    const tglLahirStr = student.tglLahir
      ? `${student.tglLahir.hari} ${student.tglLahir.bulan} ${student.tglLahir.tahun}`
      : '-';

    return {
      id: `res-${Date.now()}`,
      timestamp: new Date().toLocaleString('id-ID'),
      nama: student.nama,
      noAbsen: student.noAbsen,
      kelas: CONFIG.KELAS,
      tglLahir: tglLahirStr,
      benar: evaluation.benar,
      benarSebagian: evaluation.benarSebagian,
      salah: evaluation.salah,
      totalSkor: evaluation.totalSkor,
      maxSkor: evaluation.maxSkor,
      nilai: evaluation.nilai,
      status: evaluation.status,
      durationSeconds: finalSeconds,
      durasi: formatDuration(finalSeconds),
      detailJawaban: answersById,
    };
  };

  const handleConfirmSubmit = async () => {
    if (!allAnswered) {
      setSubmitError('Masih ada butir soal yang belum dijawab. Harap jawab seluruh soal terlebih dahulu!');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const calculatedResult = calculateResult();

    try {
      await gasService.submitExamResult(calculatedResult);
      setIsSubmitting(false);
      setShowConfirmModal(false);
      onFinishExam(calculatedResult);
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmitError(
        err.message ||
          'Gagal mengirim data ke server. Periksa koneksi internet atau konfigurasi Google Apps Script.'
      );
    }
  };

  const handleDownloadExamPDF = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadExamQuestionsPDF(questions);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const currentOptions = currentQ.shuffledOptions || currentQ.options || [];
  const currentAnswer = answersById[currentQ.originalQuestionId];

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">
      {/* Header Info Siswa & Progres */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{student.nama}</span>
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">
                  Absen: {student.noAbsen}
                </span>
                <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded">
                  Kelas {CONFIG.KELAS}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {CONFIG.SEKOLAH} • {CONFIG.MATA_PELAJARAN}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timer Durasi */}
            <div className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-800 bg-blue-50 rounded-xl border border-blue-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-mono">{formatDuration(elapsedSeconds)}</span>
            </div>

            {/* Tombol Unduh Naskah Soal PDF */}
            <button
              id="btn-download-questions-pdf"
              onClick={handleDownloadExamPDF}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-300 cursor-pointer disabled:opacity-50"
              title="Unduh Lembar Naskah Soal dalam bentuk PDF"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Unduh Soal (PDF)</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
            <span className="text-slate-600">
              Progres Pengerjaan: <span className="text-blue-700 font-bold">{answeredCount}</span> dari {totalQuestions} Soal Terjawab
            </span>
            <span className="text-blue-700 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Layout: Konten Soal + Navigasi Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Lembar Soal Aktif */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200 min-h-[440px] flex flex-col justify-between">
            <div>
              {/* Header Nomor & Tipe Soal */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm sm:text-base font-extrabold px-3 py-1 bg-blue-700 text-white rounded-xl shadow-2xs">
                    Soal No. {currentIndex + 1}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                    {currentQ.type === 'pg' && 'Pilihan Ganda'}
                    {currentQ.type === 'pgk' && 'Pilihan Ganda Kompleks'}
                    {currentQ.type === 'pgk_kategori' && 'PGK Kategori (Benar / Salah)'}
                    {currentQ.type === 'isian' && 'Isian Singkat'}
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  {currentQ.topic}
                </span>
              </div>

              {/* Petunjuk Pengisian Berdasarkan Tipe */}
              <div className="mb-4 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-100 inline-block">
                {currentQ.type === 'pg' && 'Pilihlah salah satu jawaban yang paling tepat.'}
                {currentQ.type === 'pgk' && 'Pilihlah seluruh pernyataan yang bernilai benar (bisa lebih dari satu).'}
                {currentQ.type === 'pgk_kategori' && 'Tentukan pilihan Benar atau Salah untuk setiap pernyataan di bawah ini.'}
                {currentQ.type === 'isian' && 'Tuliskan jawaban singkat dengan ejaan yang benar pada kotak di bawah ini.'}
              </div>

              {/* Gambar Ilustrasi Soal (jika ada) */}
              {currentQ.imageUrl && (
                <figure className="mb-5 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-3">
                  <div className="flex justify-center">
                    {!imageLoadFailed ? (
                      <img
                        src={currentQ.imageUrl}
                        alt={currentQ.imageCaption || `Ilustrasi soal ${currentIndex + 1}`}
                        referrerPolicy="no-referrer"
                        onError={() => setImageLoadFailed(true)}
                        className="max-h-64 w-auto rounded-xl object-contain shadow-xs"
                      />
                    ) : (
                      <div className="w-full max-w-md h-44 rounded-xl bg-gradient-to-br from-slate-100 to-blue-50 border border-slate-200 flex flex-col items-center justify-center p-4 text-center">
                        <ImageIcon className="w-8 h-8 text-blue-500 mb-2" />
                        <p className="text-xs font-semibold text-slate-700">
                          {currentQ.imageCaption || 'Ilustrasi Pendukung Soal'}
                        </p>
                      </div>
                    )}
                  </div>
                  {currentQ.imageCaption && (
                    <figcaption className="mt-2 text-center text-[11px] font-medium text-slate-500 flex items-center justify-center gap-1">
                      <ImageIcon className="w-3 h-3 text-slate-400" />
                      <span>{currentQ.imageCaption}</span>
                    </figcaption>
                  )}
                </figure>
              )}

              {/* Teks Soal */}
              <div className="text-sm sm:text-base text-slate-900 leading-relaxed font-medium whitespace-pre-line mb-6">
                {currentQ.text}
              </div>

              {/* Tampilan Opsi Jawaban: Pilihan Ganda (PG) */}
              {currentQ.type === 'pg' && (
                <div className="space-y-2.5">
                  {currentOptions.map((opt) => {
                    const isSelected = currentAnswer === opt.text;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectPG(opt.text)}
                        className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-semibold ring-1 ring-blue-500'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {opt.id}
                        </div>
                        <span className="text-xs sm:text-sm mt-0.5 leading-normal flex-1">
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tampilan Opsi Jawaban: Pilihan Ganda Kompleks (PGK) */}
              {currentQ.type === 'pgk' && (
                <div className="space-y-2.5">
                  {currentOptions.map((opt) => {
                    const currentList = Array.isArray(currentAnswer)
                      ? (currentAnswer as string[])
                      : [];
                    const isChecked = currentList.includes(opt.text);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleTogglePGK(opt.text)}
                        className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                          isChecked
                            ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-semibold ring-1 ring-emerald-500'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isChecked ? <Check className="w-4 h-4" /> : opt.id}
                        </div>
                        <span className="text-xs sm:text-sm mt-0.5 leading-normal flex-1">
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tampilan Opsi Jawaban: PGK Kategori (Benar / Salah) */}
              {currentQ.type === 'pgk_kategori' && (
                <div className="space-y-3">
                  {(currentQ.statements || []).map((st, sIdx) => {
                    const ansMap =
                      typeof currentAnswer === 'object' && !Array.isArray(currentAnswer)
                        ? (currentAnswer as Record<string, boolean>)
                        : {};
                    const currentVal = ansMap[st.id];

                    return (
                      <div
                        key={st.id}
                        className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/60"
                      >
                        <p className="text-xs sm:text-sm text-slate-800 font-medium mb-3">
                          <span className="font-bold text-blue-700 mr-1.5">
                            Pernyataan {sIdx + 1}:
                          </span>
                          {st.text}
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleSetCategoryStatement(st.id, true)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                              currentVal === true
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>BENAR</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetCategoryStatement(st.id, false)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                              currentVal === false
                                ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>SALAH</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tampilan Jawaban: Isian Singkat */}
              {currentQ.type === 'isian' && (
                <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2.5">
                  <label
                    htmlFor={`input-isian-${currentQ.originalQuestionId}`}
                    className="block text-xs font-bold text-slate-700"
                  >
                    Jawaban Isian Singkat:
                  </label>
                  <input
                    id={`input-isian-${currentQ.originalQuestionId}`}
                    type="text"
                    value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                    onChange={(e) => handleChangeIsian(e.target.value)}
                    placeholder="Ketik jawaban singkat Anda di sini..."
                    className="w-full px-4 py-3 text-sm sm:text-base rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-slate-900 placeholder:text-slate-400"
                  />
                  <p className="text-[11px] text-slate-500">
                    Tips: Tulis kata atau frasa yang tepat dan singkat sesuai pertanyaan.
                  </p>
                </div>
              )}
            </div>

            {/* Tombol Aksi Bawah: Sebelumnya & Berikutnya */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 gap-3">
              <button
                id="btn-prev-question"
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              {currentIndex < totalQuestions - 1 ? (
                <button
                  id="btn-next-question"
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  id="btn-finish-test-prompt"
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim Jawaban</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Grid Navigasi Nomor Soal & Ringkasan */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
              <span>Nomor Soal Ujian</span>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {totalQuestions} Butir
              </span>
            </h4>

            {/* Grid 30 Soal */}
            <div className="grid grid-cols-5 sm:grid-cols-9 lg:grid-cols-5 gap-2 mb-4 max-h-80 overflow-y-auto pr-1">
              {shuffledQuestions.map((_, i) => {
                const isCurrent = currentIndex === i;
                const isAnswered = isQuestionAnswered(i);

                let btnClass = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                if (isAnswered) {
                  btnClass = 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700';
                }
                if (isCurrent) {
                  btnClass = 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300 font-extrabold';
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentIndex(i)}
                    className={`h-9 rounded-lg font-bold text-xs flex items-center justify-center border transition-all cursor-pointer ${btnClass}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Keterangan Warna */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-600" />
                <span>Soal Sedang Dikerjakan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600" />
                <span>Sudah Dijawab ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-200" />
                <span>Belum Dijawab ({totalQuestions - answeredCount})</span>
              </div>
            </div>

            {/* Tombol Kirim Utama */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <button
                id="btn-sidebar-submit"
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  allAnswered
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {allAnswered ? 'Selesai & Kirim Jawaban' : 'Kirim Jawaban'}
                </span>
              </button>

              {!allAnswered && (
                <p className="mt-2 text-[11px] text-amber-700 text-center font-medium">
                  Harap jawab seluruh {totalQuestions} soal sebelum mengirim.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Kirim Jawaban */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Konfirmasi Pengiriman Jawaban
                </h3>
                <p className="text-xs text-slate-500">
                  Periksa kembali kepastian jawaban Anda
                </p>
              </div>
            </div>

            {!allAnswered ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs mb-5">
                <p className="font-bold mb-1">Peringatan: Belum Semua Soal Dijawab!</p>
                <p>
                  Anda baru menjawab <span className="font-bold">{answeredCount}</span> dari {totalQuestions} butir soal. Sesuai ketentuan, Anda tidak dapat mengirim tes sebelum seluruh soal terjawab.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs mb-5 space-y-1">
                <p className="font-bold">Apakah Anda yakin ingin mengirim jawaban?</p>
                <p>
                  Durasi pengerjaan Anda tercatat <strong className="font-bold">{formatDuration(elapsedSeconds)}</strong>. Setelah dikirim, nilai dan analisis jawaban akan tersimpan ke rekap sekolah.
                </p>
              </div>
            )}

            {submitError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs mb-4">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Gagal Mengirim Data
                </p>
                <p>{submitError}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                id="btn-cancel-submit"
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setShowConfirmModal(false);
                  setSubmitError(null);
                }}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal / Kembali ke Soal
              </button>

              {allAnswered && (
                <button
                  id="btn-confirm-submit-answers"
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmSubmit}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim ke Server...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Ya, Kirim Jawaban</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
