import React, { useState, useEffect, useMemo } from 'react';
import { CONFIG } from '../config';
import { ExamResult, Question } from '../types';
import { gasService } from '../services/gasService';
import {
  downloadStudentResultPDF,
  downloadExamQuestionsPDF,
  downloadResultsRecapPDF,
  exportResultsToCSV,
  downloadKisiKisiPDF,
  exportItemAnalysisToCSV,
  downloadItemAnalysisPDF,
} from '../utils/pdfGenerator';
import {
  computeItemStatistics,
  evaluateSingleQuestion,
  isResultTuntas,
} from '../utils/scoring';
import { QuestionEditorModal } from './QuestionEditorModal';
import { GasGuideModal } from './GasGuideModal';
import { GasSettingsModal } from './GasSettingsModal';
import { StudentDetailModal } from './StudentDetailModal';
import {
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCw,
  Search,
  Download,
  FileDown,
  Trash2,
  Eye,
  FileSpreadsheet,
  Edit3,
  BookOpen,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Code2,
  ToggleLeft,
  ToggleRight,
  Check,
  Settings,
  RotateCcw,
  Grid3X3,
  BarChart3,
  Layers,
  Brain,
  Gauge,
  FileCheck2,
  Clock,
  Loader2,
} from 'lucide-react';

interface Stage4TeacherPanelProps {
  questions: Question[];
  onUpdateQuestion: (updated: Question) => void;
  allowReview: boolean;
  onToggleAllowReview: (val: boolean) => void;
  onResetDefaultQuestions?: () => void;
}

export const Stage4TeacherPanel: React.FC<Stage4TeacherPanelProps> = ({
  questions,
  onUpdateQuestion,
  allowReview,
  onToggleAllowReview,
  onResetDefaultQuestions,
}) => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Tab aktif: 'rekap' | 'analisis' | 'soal'
  const [activeTab, setActiveTab] = useState<'rekap' | 'analisis' | 'soal'>('rekap');

  // Filter & Search Rekap
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [filterTanggal, setFilterTanggal] = useState('');

  // Filter Bank Soal
  const [filterQuestionTopic, setFilterQuestionTopic] = useState('Semua');
  const [filterQuestionType, setFilterQuestionType] = useState('Semua');

  // Sorting
  const [sortField, setSortField] = useState<'timestamp' | 'nama' | 'nilai' | 'noAbsen'>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<ExamResult | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showGasGuide, setShowGasGuide] = useState(false);
  const [showGasSettings, setShowGasSettings] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<ExamResult | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isDownloadingExamPdf, setIsDownloadingExamPdf] = useState(false);

  const loadDataFromGAS = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await gasService.fetchExamResults();
      setResults(data);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      const localData = gasService.getLocalExamResults();
      setResults(localData);
      setApiError(
        'Sinkronisasi Google Spreadsheet belum aktif. Data hasil tes dimuat dari memori lokal perangkat ini.'
      );
    }
  };

  useEffect(() => {
    loadDataFromGAS();
  }, []);

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await gasService.deleteExamResult(studentToDelete.timestamp, studentToDelete.nama);
      setResults((prev) =>
        prev.filter(
          (r) =>
            r.id !== studentToDelete.id &&
            !(r.timestamp === studentToDelete.timestamp && r.nama === studentToDelete.nama)
        )
      );
      setIsDeleting(false);
      setStudentToDelete(null);
    } catch {
      setResults((prev) => prev.filter((r) => r.id !== studentToDelete.id));
      setIsDeleting(false);
      setStudentToDelete(null);
    }
  };

  // Statistik Ringkasan Kelas
  const stats = useMemo(() => {
    const total = results.length;
    if (total === 0) {
      return { total: 0, lulus: 0, belumLulus: 0, rataRata: 0 };
    }
    const lulus = results.filter((r) => isResultTuntas(r)).length;
    const belumLulus = total - lulus;
    const sumNilai = results.reduce((acc, curr) => acc + (Number(curr.nilai) || 0), 0);
    const rataRata = Math.round((sumNilai / total) * 10) / 10;
    return { total, lulus, belumLulus, rataRata };
  }, [results]);

  // Filter & Sort Data Siswa
  const filteredAndSortedResults = useMemo(() => {
    let filtered = [...results];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => r.nama.toLowerCase().includes(q));
    }

    if (filterKelas !== 'Semua') {
      filtered = filtered.filter((r) => String(r.kelas || CONFIG.KELAS) === filterKelas);
    }

    if (filterStatus !== 'Semua') {
      filtered = filtered.filter((r) =>
        filterStatus === 'Tuntas' ? isResultTuntas(r) : !isResultTuntas(r)
      );
    }

    if (filterTanggal.trim()) {
      filtered = filtered.filter((r) => r.timestamp.includes(filterTanggal));
    }

    filtered.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'nilai' || sortField === 'noAbsen') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [results, searchQuery, filterKelas, filterStatus, filterTanggal, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedResults.length / itemsPerPage));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedResults.slice(start, start + itemsPerPage);
  }, [filteredAndSortedResults, currentPage, itemsPerPage]);

  const toggleSort = (field: 'timestamp' | 'nama' | 'nilai' | 'noAbsen') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Ringkasan Otomatis Kisi-Kisi & Distribusi Soal
  const questionSummary = useMemo(() => {
    const elements: Record<string, number> = {};
    const cognitive: Record<string, number> = { L1: 0, L2: 0, L3: 0 };
    const difficulty: Record<string, number> = { Mudah: 0, Sedang: 0, Sukar: 0 };
    const types: Record<string, number> = { pg: 0, pgk_kategori: 0, isian: 0, pgk: 0 };
    let totalWeight = 0;

    questions.forEach((q) => {
      const el = q.element || 'Bilangan';
      elements[el] = (elements[el] || 0) + 1;

      const cog = q.cognitiveLevel || 'L1';
      cognitive[cog] = (cognitive[cog] || 0) + 1;

      difficulty[q.difficulty] = (difficulty[q.difficulty] || 0) + 1;

      types[q.type] = (types[q.type] || 0) + 1;
      totalWeight += q.weight || 1;
    });

    return { elements, cognitive, difficulty, types, totalWeight };
  }, [questions]);

  // Statistik Analisis Butir Soal (Matriks)
  const matrixDataset = filteredAndSortedResults.length > 0 ? filteredAndSortedResults : results;
  const itemStats = useMemo(
    () => computeItemStatistics(questions, matrixDataset),
    [questions, matrixDataset]
  );

  // Filter Bank Soal
  const uniqueTopics = useMemo(
    () => Array.from(new Set(questions.map((q) => q.topic))),
    [questions]
  );

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterQuestionTopic !== 'Semua' && q.topic !== filterQuestionTopic) return false;
      if (filterQuestionType !== 'Semua' && q.type !== filterQuestionType) return false;
      return true;
    });
  }, [questions, filterQuestionTopic, filterQuestionType]);

  const handleDownloadExamPDF = async () => {
    setIsDownloadingExamPdf(true);
    try {
      await downloadExamQuestionsPDF(questions);
    } finally {
      setIsDownloadingExamPdf(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                Dashboard Panel Guru
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {CONFIG.SEKOLAH} • Kelas {CONFIG.KELAS} • {CONFIG.MATA_PELAJARAN} • KKTP {CONFIG.KKTP}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Rekapitulasi, Analisis Butir &amp; Pengelolaan Tes Sumatif
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Guru Pengampu: <strong className="text-slate-700">{CONFIG.GURU}</strong> (NIP. {CONFIG.NIP_GURU})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-open-gas-settings"
              onClick={() => setShowGasSettings(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-blue-600" />
              <span>URL Spreadsheet</span>
            </button>

            <button
              id="btn-open-gas-guide"
              onClick={() => setShowGasGuide(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-300 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Panduan Skrip GAS</span>
            </button>

            <button
              id="btn-export-rekap-pdf"
              onClick={() => downloadResultsRecapPDF(matrixDataset)}
              disabled={results.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-white" />
              <span>Rekap Nilai (PDF)</span>
            </button>

            <button
              id="btn-export-rekap-csv"
              onClick={() => exportResultsToCSV(matrixDataset)}
              disabled={results.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-300 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Rekap (Excel/CSV)</span>
            </button>

            <button
              id="btn-refresh-data-top"
              onClick={loadDataFromGAS}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>REFRESH DATA</span>
            </button>
          </div>
        </div>

        {/* Toggle Otorisasi Pembahasan Soal untuk Siswa */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Akses Kunci &amp; Pembahasan Siswa:</span>
            <span className="text-slate-500">
              {allowReview
                ? 'Siswa dapat melihat kunci jawaban dan pembahasan setelah selesai.'
                : 'Kunci jawaban dan pembahasan disembunyikan dari siswa.'}
            </span>
          </div>
          <button
            onClick={() => onToggleAllowReview(!allowReview)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              allowReview
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
            }`}
          >
            {allowReview ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{allowReview ? 'Pembahasan Aktif' : 'Pembahasan Nonaktif'}</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium">Total Peserta</span>
            <span className="text-2xl font-black text-slate-900 block">{stats.total}</span>
            <span className="text-[11px] text-slate-400">Siswa telah submit</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-emerald-700 block font-bold">Jumlah Tuntas</span>
            <span className="text-2xl font-black text-emerald-900 block">{stats.lulus}</span>
            <span className="text-[11px] text-emerald-600 font-semibold">Nilai ≥ {CONFIG.KKTP}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-amber-700 block font-bold">Perlu Remedial</span>
            <span className="text-2xl font-black text-amber-900 block">{stats.belumLulus}</span>
            <span className="text-[11px] text-amber-600 font-semibold">Nilai &lt; {CONFIG.KKTP}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-indigo-700 block font-bold">Rata-rata Nilai</span>
            <span className="text-2xl font-black text-indigo-900 block">{stats.rataRata}</span>
            <span className="text-[11px] text-slate-400">Skala 0 - 100</span>
          </div>
        </div>
      </div>

      {/* Navigasi 3 Tab Panel Guru */}
      <div className="flex flex-wrap border-b border-slate-200 bg-white rounded-t-2xl px-6 pt-3 gap-4 sm:gap-6 text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('rekap')}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'rekap'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Data Nilai Siswa</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {results.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('analisis')}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'analisis'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Grid3X3 className="w-4 h-4" />
          <span>Analisis Butir Soal (Matriks)</span>
        </button>

        <button
          onClick={() => setActiveTab('soal')}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'soal'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Bank Soal, Kisi-Kisi &amp; Kunci</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
            {questions.length} Butir
          </span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: DATA NILAI SISWA                                           */}
      {/* ================================================================= */}
      {activeTab === 'rekap' && (
        <div className="bg-white rounded-b-2xl p-6 shadow-xs border border-t-0 border-slate-200 space-y-4">
          {/* Baris Filter & Pencarian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama siswa..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={filterKelas}
                onChange={(e) => {
                  setFilterKelas(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              >
                <option value="Semua">Semua Kelas</option>
                <option value="4">Kelas 4</option>
              </select>
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              >
                <option value="Semua">Semua Status</option>
                <option value="Tuntas">Tuntas (≥ {CONFIG.KKTP})</option>
                <option value="Remedial">Remedial (&lt; {CONFIG.KKTP})</option>
              </select>
            </div>

            <div>
              <input
                type="text"
                value={filterTanggal}
                onChange={(e) => {
                  setFilterTanggal(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter tanggal (cth: 15/11/2026)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {apiError && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>{apiError}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowGasSettings(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-xs flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Atur URL Spreadsheet</span>
                </button>
                <button
                  onClick={loadDataFromGAS}
                  className="px-3 py-1.5 bg-amber-200 text-amber-900 font-bold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer text-xs"
                >
                  Muat Ulang
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 pb-1">
            <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
              <span>
                Menampilkan <strong className="text-slate-800">{filteredAndSortedResults.length}</strong> dari total{' '}
                <strong className="text-slate-800">{results.length}</strong> data siswa
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => downloadResultsRecapPDF(matrixDataset)}
                disabled={results.length === 0}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Unduh Rekap PDF ({matrixDataset.length})</span>
              </button>

              <button
                type="button"
                onClick={() => exportResultsToCSV(matrixDataset)}
                disabled={results.length === 0}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unduh Excel/CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">No</th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleSort('timestamp')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Timestamp</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleSort('nama')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Nama Siswa</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors text-center"
                    onClick={() => toggleSort('noAbsen')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Absen</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Durasi</th>
                  <th className="py-3 px-3 text-center text-emerald-700">Benar</th>
                  <th className="py-3 px-3 text-center text-rose-700">Salah</th>
                  <th className="py-3 px-3 text-center">Skor</th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors text-center"
                    onClick={() => toggleSort('nilai')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Nilai</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Mengambil data dari Google Spreadsheet...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedResults.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      <div className="max-w-xs mx-auto space-y-1">
                        <p className="font-semibold text-slate-700">
                          {results.length === 0
                            ? 'Belum ada data nilai siswa.'
                            : 'Tidak ada data siswa yang cocok dengan filter pencarian.'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Data siswa akan otomatis tercatat di sini setelah siswa menyelesaikan tes sumatif.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedResults.map((row, idx) => {
                    const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                    const isPass = isResultTuntas(row);

                    return (
                      <tr
                        key={row.id || `${row.timestamp}-${row.nama}-${idx}`}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-3 text-center font-mono text-slate-500">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {row.timestamp}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForDetail(row)}
                            className="text-left hover:text-blue-700 hover:underline font-bold cursor-pointer"
                            title="Klik untuk melihat Detail Analisis Siswa"
                          >
                            {row.nama}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700 font-semibold">
                          {row.noAbsen}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-600">
                          {row.durasi || '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700">
                          {row.benar}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-rose-700">
                          {row.salah}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700 font-semibold">
                          {row.totalSkor ?? row.nilai}/{row.maxSkor ?? 100}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`font-black text-sm px-2 py-0.5 rounded ${
                              isPass
                                ? 'text-emerald-700 bg-emerald-50'
                                : 'text-amber-700 bg-amber-50'
                            }`}
                          >
                            {row.nilai}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isPass
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPass ? 'Tuntas' : 'Remedial'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedStudentForDetail(row)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Detail Analisis Siswa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => downloadStudentResultPDF(row)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Download PDF Lembar Hasil"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setStudentToDelete(row)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Data Siswa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 text-xs text-slate-600">
              <span>
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
                {Math.min(currentPage * itemsPerPage, filteredAndSortedResults.length)} dari{' '}
                {filteredAndSortedResults.length} data
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-bold text-slate-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: ANALISIS BUTIR SOAL PER SISWA (MATRIKS RESPON SISWA)       */}
      {/* ================================================================= */}
      {activeTab === 'analisis' && (
        <div className="bg-white rounded-b-2xl p-6 shadow-xs border border-t-0 border-slate-200 space-y-5">
          {/* Header Matriks & Tombol Ekspor */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <span>Matriks Respon Siswa &amp; Analisis Butir Soal (1 s.d. {questions.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik pada <strong>Nama Siswa</strong> di sebelah kiri untuk membuka rincian kelemahan topik &amp; rekomendasi remedial.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-export-matrix-csv"
                type="button"
                onClick={() => exportItemAnalysisToCSV(questions, matrixDataset)}
                disabled={matrixDataset.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-300 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Ekspor Analisis Butir &amp; Matriks (Excel/CSV)</span>
              </button>

              <button
                id="btn-export-matrix-pdf"
                type="button"
                onClick={() => downloadItemAnalysisPDF(questions, matrixDataset)}
                disabled={matrixDataset.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-white" />
                <span>Unduh PDF Laporan Analisis Butir Soal</span>
              </button>
            </div>
          </div>

          {/* Legenda Status Jawaban */}
          <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-700">Keterangan Status Jawaban:</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
              <span className="w-5 h-5 rounded bg-emerald-500 text-white font-bold flex items-center justify-center text-[11px]">
                ✓
              </span>
              Benar (Skor Penuh)
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
              <span className="w-5 h-5 rounded bg-amber-400 text-amber-950 font-bold flex items-center justify-center text-[11px]">
                ½
              </span>
              Benar Sebagian (PGK Kategori)
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-rose-800">
              <span className="w-5 h-5 rounded bg-rose-500 text-white font-bold flex items-center justify-center text-[11px]">
                ✕
              </span>
              Salah (Skor 0)
            </span>
            <span className="ml-auto text-[11px] text-slate-500">
              Klasifikasi Kesukaran: Mudah (&gt;70%) • Sedang (30–70%) • Sukar (&lt;30%)
            </span>
          </div>

          {/* Tabel Matriks Interaktif */}
          {matrixDataset.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 text-xs text-slate-500">
              <p className="font-bold text-slate-700 mb-1">Belum ada data respon siswa untuk dianalisis.</p>
              <p>Setelah siswa mengirimkan jawaban tes, matriks respon {questions.length} butir soal akan tampil di sini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="text-[11px] border-collapse min-w-max w-full">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-800 py-2.5 px-2.5 text-center border-r border-slate-700 w-10">
                      No
                    </th>
                    <th className="sticky left-10 z-20 bg-slate-800 py-2.5 px-3 text-left border-r border-slate-700 min-w-[175px]">
                      Nama Siswa
                    </th>
                    {questions.map((q) => (
                      <th
                        key={q.id}
                        className="py-2 px-1 text-center border-r border-slate-700 min-w-[30px] font-mono"
                        title={`Soal #${q.id} • ${q.topic} (${q.type.toUpperCase()}, Bobot ${q.weight})`}
                      >
                        {q.id}
                      </th>
                    ))}
                    <th className="py-2.5 px-2.5 text-center border-r border-slate-700 bg-slate-900 min-w-[68px]">
                      Total Skor
                    </th>
                    <th className="py-2.5 px-2.5 text-center border-r border-slate-700 bg-slate-900 min-w-[62px]">
                      Nilai Akhir
                    </th>
                    <th className="py-2.5 px-2.5 text-center border-r border-slate-700 bg-slate-900 min-w-[74px]">
                      Status
                    </th>
                    <th className="py-2.5 px-2.5 text-center bg-slate-900 min-w-[72px]">
                      Durasi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {matrixDataset.map((student, rIdx) => {
                    const hasDetail =
                      student.detailJawaban && Object.keys(student.detailJawaban).length > 0;
                    const isPass = isResultTuntas(student);
                    const totalMax = questions.reduce((s, q) => s + (q.weight || 1), 0);

                    return (
                      <tr
                        key={student.id || `${student.nama}-${rIdx}`}
                        onClick={() => setSelectedStudentForDetail(student)}
                        className="hover:bg-blue-50/50 transition-colors bg-white cursor-pointer"
                        title="Klik baris untuk membuka Detail Analisis Siswa"
                      >
                        <td className="sticky left-0 z-10 bg-inherit py-2 px-2.5 text-center font-mono text-slate-500 border-r border-slate-200">
                          {rIdx + 1}
                        </td>
                        <td className="sticky left-10 z-10 bg-inherit py-2 px-3 border-r border-slate-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentForDetail(student);
                            }}
                            className="text-left font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer truncate max-w-[165px] block"
                            title="Klik untuk membuka Detail Analisis Siswa"
                          >
                            {student.nama}
                          </button>
                          <span className="text-[10px] text-slate-400">
                            Absen {student.noAbsen} • Kls {student.kelas || CONFIG.KELAS}
                          </span>
                        </td>

                        {questions.map((q) => {
                          if (!hasDetail) {
                            return (
                              <td
                                key={q.id}
                                className="p-1 text-center border-r border-slate-100"
                                title="Detail jawaban tidak tersedia"
                              >
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-400 font-bold">
                                  -
                                </span>
                              </td>
                            );
                          }

                          const ev = evaluateSingleQuestion(q, student.detailJawaban?.[q.id]);
                          let cellClass = 'bg-rose-500 text-white';
                          let symbol = '✕';
                          let labelDesc = 'Salah';

                          if (ev.status === 'correct') {
                            cellClass = 'bg-emerald-500 text-white';
                            symbol = '✓';
                            labelDesc = 'Benar';
                          } else if (ev.status === 'partial') {
                            cellClass = 'bg-amber-400 text-amber-950';
                            symbol = '½';
                            labelDesc = 'Benar Sebagian';
                          }

                          return (
                            <td
                              key={q.id}
                              className="p-1 text-center border-r border-slate-100"
                              title={`Siswa: ${student.nama} | Soal #${q.id} (${q.topic}) | Status: ${labelDesc} (Skor ${ev.score}/${ev.maxScore})`}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStudentForDetail(student);
                                }}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded font-extrabold text-[11px] cursor-pointer hover:opacity-85 transition-opacity ${cellClass}`}
                              >
                                {symbol}
                              </button>
                            </td>
                          );
                        })}

                        <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-800 border-r border-slate-200 bg-slate-50">
                          {student.totalSkor ?? student.nilai}/{student.maxSkor ?? totalMax}
                        </td>
                        <td className="py-2 px-2.5 text-center border-r border-slate-200 bg-slate-50">
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded ${
                              isPass
                                ? 'text-emerald-700 bg-emerald-100'
                                : 'text-rose-700 bg-rose-100'
                            }`}
                          >
                            {student.nilai}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-center border-r border-slate-200 bg-slate-50">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPass
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPass ? 'Tuntas' : 'Remedial'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono text-slate-600 bg-slate-50 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {student.durasi || '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Baris Statistik Bagian Bawah Per Butir Soal */}
                <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-800">
                  {/* Baris 1: Jumlah Siswa Menjawab Benar */}
                  <tr>
                    <td
                      colSpan={2}
                      className="sticky left-0 z-10 bg-slate-100 py-2 px-3 text-left border-r border-slate-300"
                    >
                      Jml Siswa Benar
                    </td>
                    {itemStats.map((st) => (
                      <td
                        key={st.question.id}
                        className="py-2 px-1 text-center border-r border-slate-200 font-mono text-emerald-800"
                        title={`Soal #${st.question.id}: ${st.correctCount} benar penuh, ${st.partialCount} benar sebagian`}
                      >
                        {st.respondentsWithDetail > 0 ? st.correctCount : '-'}
                      </td>
                    ))}
                    <td colSpan={4} className="py-2 px-3 text-center text-[10px] text-slate-500">
                      Statistik per butir
                    </td>
                  </tr>

                  {/* Baris 2: Persentase Ketercapaian Butir (%) */}
                  <tr className="bg-slate-50">
                    <td
                      colSpan={2}
                      className="sticky left-0 z-10 bg-slate-50 py-2 px-3 text-left border-r border-slate-300"
                    >
                      % Ketercapaian
                    </td>
                    {itemStats.map((st) => (
                      <td
                        key={st.question.id}
                        className="py-2 px-1 text-center border-r border-slate-200 font-mono text-blue-800"
                      >
                        {st.respondentsWithDetail > 0 ? `${st.achievementPercent}%` : '-'}
                      </td>
                    ))}
                    <td colSpan={4} className="py-2 px-3 text-center text-[10px] text-slate-500">
                      Skor dicapai / Skor maks
                    </td>
                  </tr>

                  {/* Baris 3: Klasifikasi Empiris Tingkat Kesukaran */}
                  <tr>
                    <td
                      colSpan={2}
                      className="sticky left-0 z-10 bg-slate-100 py-2 px-3 text-left border-r border-slate-300"
                    >
                      Kesukaran Empiris
                    </td>
                    {itemStats.map((st) => {
                      const cls =
                        st.empiricalDifficulty === 'Mudah'
                          ? 'bg-emerald-100 text-emerald-800'
                          : st.empiricalDifficulty === 'Sedang'
                          ? 'bg-amber-100 text-amber-800'
                          : st.empiricalDifficulty === 'Sukar'
                          ? 'bg-rose-100 text-rose-800'
                          : 'text-slate-400';
                      const shortLbl =
                        st.empiricalDifficulty === 'Mudah'
                          ? 'M'
                          : st.empiricalDifficulty === 'Sedang'
                          ? 'Sd'
                          : st.empiricalDifficulty === 'Sukar'
                          ? 'Sk'
                          : '-';

                      return (
                        <td
                          key={st.question.id}
                          className="py-2 px-0.5 text-center border-r border-slate-200"
                          title={`Soal #${st.question.id}: ${st.empiricalDifficulty} (${st.achievementPercent}%)`}
                        >
                          <span className={`inline-block px-1 py-0.5 rounded text-[10px] font-extrabold ${cls}`}>
                            {shortLbl}
                          </span>
                        </td>
                      );
                    })}
                    <td colSpan={4} className="py-2 px-3 text-center text-[10px] text-slate-500">
                      M:&gt;70% | Sd:30-70% | Sk:&lt;30%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: BANK SOAL, KISI-KISI, KUNCI & BOBOT SKOR                   */}
      {/* ================================================================= */}
      {activeTab === 'soal' && (
        <div className="bg-white rounded-b-2xl p-6 shadow-xs border border-t-0 border-slate-200 space-y-6">
          {/* Header & Tombol Ekspor Kisi-Kisi & Naskah */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Bank Soal, Kisi-Kisi, Kunci Jawaban &amp; Bobot Skor ({questions.length} Butir)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {questionSummary.types.pg} Pilihan Ganda
                {questionSummary.types.pgk_kategori > 0 ? ` • ${questionSummary.types.pgk_kategori} PGK Kategori` : ''}
                {questionSummary.types.isian > 0 ? ` • ${questionSummary.types.isian} Isian Singkat` : ''}
                {' • '}Total Bobot: <strong className="text-slate-800">{questionSummary.totalWeight} Poin</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onResetDefaultQuestions && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-300 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  <span>Reset 30 Soal Standar</span>
                </button>
              )}

              <button
                id="btn-download-kisikisi-pdf"
                type="button"
                onClick={() => downloadKisiKisiPDF(questions)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Unduh PDF Kisi-Kisi Soal</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadExamPDF}
                disabled={isDownloadingExamPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-300 cursor-pointer disabled:opacity-50"
              >
                {isDownloadingExamPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Unduh Naskah Soal (PDF)</span>
              </button>
            </div>
          </div>

          {/* 4 KARTU RINGKASAN (SUMMARY CARDS) OTOMATIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Distribusi Elemen / Kompetensi */}
            <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 space-y-2.5">
              <div className="flex items-center gap-2 text-blue-900 font-extrabold text-xs">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Distribusi Elemen / Kompetensi</span>
              </div>
              <div className="space-y-1.5 text-xs tabular-nums">
                {Object.entries(questionSummary.elements).map(([el, count]) => (
                  <div
                    key={el}
                    title={el}
                    className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-blue-100"
                  >
                    <span className="text-slate-700 font-medium leading-snug">{el}</span>
                    <span className="font-extrabold text-blue-800 shrink-0 whitespace-nowrap">{count} Soal</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Distribusi Level Kognitif */}
            <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 space-y-2.5">
              <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs">
                <Brain className="w-4 h-4 text-indigo-600" />
                <span>Distribusi Level Kognitif</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100">
                  <span className="text-slate-700 font-medium">L1 (Pemahaman)</span>
                  <span className="font-extrabold text-indigo-800">{questionSummary.cognitive.L1 || 0} Soal</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100">
                  <span className="text-slate-700 font-medium">L2 (Penerapan)</span>
                  <span className="font-extrabold text-indigo-800">{questionSummary.cognitive.L2 || 0} Soal</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100">
                  <span className="text-slate-700 font-medium">L3 (Penalaran / HOTS)</span>
                  <span className="font-extrabold text-indigo-800">{questionSummary.cognitive.L3 || 0} Soal</span>
                </div>
              </div>
            </div>

            {/* 3. Distribusi Tingkat Kesukaran */}
            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                <Gauge className="w-4 h-4 text-amber-600" />
                <span>Distribusi Tingkat Kesukaran</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-100">
                  <span className="text-emerald-700 font-bold">Mudah</span>
                  <span className="font-extrabold text-slate-900">{questionSummary.difficulty.Mudah || 0} Soal</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-100">
                  <span className="text-blue-700 font-bold">Sedang</span>
                  <span className="font-extrabold text-slate-900">{questionSummary.difficulty.Sedang || 0} Soal</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-100">
                  <span className="text-rose-700 font-bold">Sukar</span>
                  <span className="font-extrabold text-slate-900">{questionSummary.difficulty.Sukar || 0} Soal</span>
                </div>
              </div>
            </div>

            {/* 4. Distribusi Bentuk Soal */}
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <span>Distribusi Bentuk Soal</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100">
                  <span className="text-slate-700 font-medium">Pilihan Ganda (PG)</span>
                  <span className="font-extrabold text-emerald-800">{questionSummary.types.pg || 0} Soal</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100">
                  <span className="text-slate-700 font-medium">PGK Kategori (B/S)</span>
                  <span className="font-extrabold text-emerald-800">{questionSummary.types.pgk_kategori || 0} Soal</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100">
                  <span className="text-slate-700 font-medium">Isian Singkat</span>
                  <span className="font-extrabold text-emerald-800">{questionSummary.types.isian || 0} Soal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bank Soal */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <select
              value={filterQuestionTopic}
              onChange={(e) => setFilterQuestionTopic(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Semua">Semua Lingkup Materi ({questions.length})</option>
              {uniqueTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filterQuestionType}
              onChange={(e) => setFilterQuestionType(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Semua">Semua Bentuk Soal</option>
              <option value="pg">Pilihan Ganda ({questionSummary.types.pg || 0})</option>
              <option value="pgk_kategori">PGK Kategori ({questionSummary.types.pgk_kategori || 0})</option>
              <option value="isian">Isian Singkat ({questionSummary.types.isian || 0})</option>
            </select>

            <span className="text-xs text-slate-500 ml-auto">
              Menampilkan <strong>{filteredQuestions.length}</strong> butir soal
            </span>
          </div>

          {/* Daftar Soal */}
          <div className="space-y-3">
            {filteredQuestions.map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 transition-colors space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-xs px-2.5 py-1 rounded bg-blue-700 text-white">
                      #{q.id}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {q.type === 'pg' && 'Pilihan Ganda'}
                      {q.type === 'pgk' && 'Pilihan Ganda Kompleks'}
                      {q.type === 'pgk_kategori' && 'PGK Kategori (2 Pernyataan)'}
                      {q.type === 'isian' && 'Isian Singkat'}
                    </span>
                    <span className="text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {q.topic}
                    </span>
                    <span className="text-[11px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {q.element}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      {q.cognitiveLevel}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        q.difficulty === 'Mudah'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.difficulty === 'Sedang'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {q.difficulty}
                    </span>
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-slate-800 text-white">
                      Bobot: {q.weight}
                    </span>
                    <button
                      onClick={() => setEditingQuestion(q)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Soal</span>
                    </button>
                  </div>
                </div>

                {/* Indikator Soal */}
                <p className="text-[11px] text-slate-500 italic">
                  <strong>Indikator:</strong> {q.indicator}
                </p>

                {/* Gambar Soal (jika ada) */}
                {q.imageUrl && (
                  <div className="pt-1">
                    <img
                      src={q.imageUrl}
                      alt={q.imageCaption || `Gambar soal ${q.id}`}
                      referrerPolicy="no-referrer"
                      className="max-h-44 rounded-xl border border-slate-200 object-contain bg-white p-1"
                    />
                  </div>
                )}

                <p className="text-xs sm:text-sm text-slate-900 font-medium whitespace-pre-line">
                  {q.text}
                </p>

                {/* Opsi PG / PGK */}
                {q.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt) => {
                      const isCorrect = Array.isArray(q.correctAnswer)
                        ? q.correctAnswer.includes(opt.id)
                        : q.correctAnswer === opt.id;
                      return (
                        <div
                          key={opt.id}
                          className={`p-2 rounded-lg border flex items-start gap-2 ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className="w-5 font-bold">{opt.id}.</span>
                          <span className="flex-1">{opt.text}</span>
                          {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pernyataan PGK Kategori */}
                {q.statements && (
                  <div className="space-y-1.5 text-xs">
                    {q.statements.map((st, sIdx) => (
                      <div
                        key={st.id}
                        className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <span>
                          <strong className="mr-1">{sIdx + 1}.</strong>
                          {st.text}
                        </span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] shrink-0 ${
                            st.correctAnswer
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {st.correctAnswer ? 'BENAR' : 'SALAH'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Kunci Jawaban Isian */}
                {q.type === 'isian' && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950">
                    <span className="font-bold">Kunci Jawaban: </span>
                    <span className="font-extrabold">{q.correctAnswer}</span>
                    {q.acceptedAnswers && q.acceptedAnswers.length > 0 && (
                      <span className="text-[11px] text-emerald-700 ml-2">
                        (Variasi diterima: {q.acceptedAnswers.join(', ')})
                      </span>
                    )}
                  </div>
                )}

                {/* Pembahasan */}
                <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-xs text-slate-700">
                  <span className="font-bold text-blue-900 block mb-0.5">Pembahasan:</span>
                  <p className="whitespace-pre-line">{q.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Detail Analisis Siswa */}
      <StudentDetailModal
        result={selectedStudentForDetail}
        questions={questions}
        isOpen={Boolean(selectedStudentForDetail)}
        onClose={() => setSelectedStudentForDetail(null)}
      />

      {/* Modal Edit Soal */}
      <QuestionEditorModal
        question={editingQuestion}
        isOpen={Boolean(editingQuestion)}
        onClose={() => setEditingQuestion(null)}
        onSave={(updated) => {
          onUpdateQuestion(updated);
          setEditingQuestion(null);
        }}
      />

      {/* Modal Panduan GAS */}
      <GasGuideModal isOpen={showGasGuide} onClose={() => setShowGasGuide(false)} />

      {/* Modal Pengaturan GAS */}
      <GasSettingsModal
        isOpen={showGasSettings}
        onClose={() => setShowGasSettings(false)}
        onOpenGasGuide={() => setShowGasGuide(true)}
        onDataSynced={loadDataFromGAS}
      />

      {/* Modal Konfirmasi Reset Soal Standar */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reset ke 30 Soal Standar?</h3>
            <p className="text-xs text-slate-600">
              Seluruh perubahan soal kustom akan dikembalikan ke 30 butir soal Pilihan Ganda Matematika Kelas 4 standar (Membilang sampai dengan 10.000, Pecahan, Pola Gambar dan Pola Bilangan).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetDefaultQuestions?.();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Ya, Reset Soal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Data Siswa */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Data Siswa</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 mb-5">
              Apakah Anda yakin ingin menghapus data ujian atas nama{' '}
              <strong className="text-slate-900 font-bold">{studentToDelete.nama}</strong> (Nomor
              Absen {studentToDelete.noAbsen})?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Ya, Hapus Data</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
