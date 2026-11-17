/**
 * Definisi Type & Interface Aplikasi Tes Sumatif
 */

export type QuestionType = 'pg' | 'pgk' | 'pgk_kategori' | 'isian';
export type Difficulty = 'Mudah' | 'Sedang' | 'Sukar';
export type CognitiveLevel = 'L1' | 'L2' | 'L3';
export type ElementType =
  | 'Bilangan'
  | 'Aljabar'
  | 'Pengukuran'
  | 'Geometri'
  | 'Analisis Data dan Peluang';

export interface StudentBirthDate {
  hari: string;
  bulan: string;
  tahun: string;
}

export interface StudentIdentity {
  nama: string;
  noAbsen: string;
  tglLahir: StudentBirthDate;
}

export interface OptionItem {
  id: string; // e.g. 'A', 'B', 'C', 'D'
  text: string;
}

export interface StatementItem {
  id: string; // e.g. 's1', 's2', 's3'
  text: string;
  correctAnswer: boolean; // true = Benar, false = Salah
}

export interface Question {
  id: number;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  imageCaption?: string;
  options?: OptionItem[]; // Untuk 'pg' (4 opsi) dan 'pgk'
  statements?: StatementItem[]; // Untuk 'pgk_kategori' (2 pernyataan B/S)
  correctAnswer?: string | string[]; // string untuk 'pg' & 'isian', array untuk 'pgk'
  acceptedAnswers?: string[]; // Variasi jawaban benar untuk soal 'isian'
  difficulty: Difficulty;
  cognitiveLevel: CognitiveLevel;
  element: ElementType;
  indicator: string;
  weight: number;
  explanation: string;
  topic: string;
}

export interface ShuffledQuestion extends Question {
  originalQuestionId: number;
  shuffledOptions?: OptionItem[];
}

export type AnswerValue = string | string[] | Record<string, boolean>;

export interface ItemEvaluation {
  questionId: number;
  status: 'correct' | 'partial' | 'wrong' | 'unanswered';
  score: number;
  maxScore: number;
  studentAnswer?: AnswerValue;
}

export interface ExamResult {
  id?: string;
  timestamp: string;
  nama: string;
  noAbsen: string;
  kelas: string;
  tglLahir?: string;
  benar: number;
  benarSebagian?: number;
  salah: number;
  totalSkor?: number;
  maxSkor?: number;
  nilai: number;
  status: 'Lulus' | 'Belum Lulus';
  durasi?: string;
  durationSeconds?: number;
  detailJawaban?: Record<number, AnswerValue>;
}

export type AppStage = 1 | 2 | 3 | 4;
