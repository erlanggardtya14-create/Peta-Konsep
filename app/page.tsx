"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Download,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers3,
  Lightbulb,
  Loader2,
  Network,
  PanelRightOpen,
  Play,
  RefreshCw,
  Route,
  Send,
  Sparkles,
  Target,
  Timer,
  Users,
} from "lucide-react";

type NodeStatus = "failed" | "weak" | "mastered" | "unknown";
type AnalysisConfidence = "high" | "medium" | "low";
type LessonPanel = "lesson" | "practice" | "teacher";

interface PetaKonsepNode {
  id: string;
  label: string;
  status: NodeStatus;
  level: number;
  evidence: string;
  micro_lesson: {
    title: string;
    core_explanation: string;
    analogy: string;
    worked_example: string;
    practice_questions: [string, string, string];
  };
}

interface PetaKonsepResult {
  meta: {
    subject: string;
    grade: string;
    target_concept: string;
    analysis_confidence: AnalysisConfidence;
  };
  diagnosis: {
    surface_error: string;
    root_cause_summary: string;
    what_student_thinks: string;
    what_is_actually_correct: string;
  };
  nodes: PetaKonsepNode[];
  edges: { source: string; target: string }[];
  root_cause_node_id: string;
  learning_path: string[];
  summary: {
    estimated_recovery_minutes: number;
    motivational_message: string;
    teacher_insight: string;
  };
}

interface DemoCase {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  additionalContext: string;
}

interface ConceptPosition {
  x: number;
  y: number;
}

const STATUS_META: Record<
  NodeStatus,
  {
    label: string;
    dot: string;
    node: string;
    badge: string;
    border: string;
    text: string;
    description: string;
  }
> = {
  failed: {
    label: "Gagal",
    dot: "bg-rose-500",
    node: "bg-rose-50",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    border: "border-rose-400",
    text: "text-rose-700",
    description: "Ada bukti konsep belum dipahami.",
  },
  weak: {
    label: "Rapuh",
    dot: "bg-amber-500",
    node: "bg-amber-50",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    border: "border-amber-400",
    text: "text-amber-700",
    description: "Sebagian paham, tetapi langkah penting masih goyah.",
  },
  mastered: {
    label: "Kuat",
    dot: "bg-emerald-500",
    node: "bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    border: "border-emerald-400",
    text: "text-emerald-700",
    description: "Tidak terlihat kelemahan dari jawaban siswa.",
  },
  unknown: {
    label: "Belum jelas",
    dot: "bg-slate-400",
    node: "bg-slate-50",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    border: "border-slate-300",
    text: "text-slate-600",
    description: "Belum cukup bukti untuk menilai.",
  },
};

const DEMO_CASES: DemoCase[] = [
  {
    id: "math-linear",
    subject: "Matematika",
    grade: "SMP Kelas 7",
    topic: "Persamaan Linier Satu Variabel",
    question: "Selesaikan: 2x + 3 = 11. Berapa nilai x?",
    studentAnswer: "x = 7",
    correctAnswer: "x = 4",
    additionalContext:
      "Siswa tampak langsung mengurangi 11 dengan 3, tetapi belum membagi hasilnya dengan koefisien 2.",
  },
  {
    id: "quadratic",
    subject: "Matematika",
    grade: "SMP Kelas 8",
    topic: "Pemfaktoran Persamaan Kuadrat",
    question: "Tentukan nilai x dari x^2 - 5x + 6 = 0.",
    studentAnswer: "x = 5 dan x = 6",
    correctAnswer: "x = 2 dan x = 3",
    additionalContext:
      "Siswa mengambil angka pada persamaan sebagai jawaban langsung, tanpa mencari pasangan faktor.",
  },
  {
    id: "physics",
    subject: "Fisika",
    grade: "SMA Kelas 10",
    topic: "Hukum Newton II",
    question:
      "Sebuah benda bermassa 5 kg bergerak dengan percepatan 3 m/s^2. Hitung gaya yang bekerja pada benda tersebut.",
    studentAnswer: "F = 5 + 3 = 8 N",
    correctAnswer: "F = 15 N",
    additionalContext:
      "Siswa sudah mengenali dua angka penting, tetapi memilih operasi penjumlahan alih-alih perkalian pada F = m x a.",
  },
  {
    id: "reading",
    subject: "Bahasa Indonesia",
    grade: "SD Kelas 5",
    topic: "Ide Pokok Paragraf",
    question:
      "Tentukan ide pokok paragraf: Kucing adalah salah satu hewan peliharaan paling populer di dunia. Hewan ini disukai karena bulunya lembut dan tingkahnya menggemaskan. Kucing juga dapat membantu mengusir tikus di rumah.",
    studentAnswer: "Kucing membantu mengusir tikus di rumah.",
    correctAnswer: "Kucing adalah salah satu hewan peliharaan paling populer di dunia.",
    additionalContext:
      "Siswa memilih detail penjelas, bukan gagasan utama yang menaungi seluruh paragraf.",
  },
];

const MODEL_OPTIONS = [
  {
    id: "gemini-2.5-flash",
    label: "Cepat",
    helper: "Lebih ringan untuk iterasi cepat.",
  },
  {
    id: "gemini-2.5-pro",
    label: "Akurasi",
    helper: "Lebih kuat untuk reasoning dan demo juri.",
  },
] as const;

const LOADING_TEXTS = [
  "Membaca pola jawaban siswa...",
  "Melacak prasyarat konsep ke belakang...",
  "Menentukan akar masalah paling dalam...",
  "Menyusun micro-lesson yang ramah siswa...",
  "Merangkai peta belajar untuk guru...",
];

function createEmptyPracticeState(nodes: PetaKonsepNode[] = []) {
  return nodes.reduce<Record<string, boolean>>((state, node) => {
    node.micro_lesson.practice_questions.forEach((_, index) => {
      state[`${node.id}-${index}`] = false;
    });
    return state;
  }, {});
}

function getNodePositions(nodes: PetaKonsepNode[]) {
  const positions: Record<string, ConceptPosition> = {};
  const levels = nodes.reduce<Record<number, PetaKonsepNode[]>>((grouped, node) => {
    grouped[node.level] = [...(grouped[node.level] || []), node];
    return grouped;
  }, {});

  const maxLevel = Math.max(...nodes.map((node) => node.level), 0);
  const canvasWidth = 820;
  const canvasHeight = 430;
  const topPadding = 62;
  const bottomPadding = 58;

  Object.entries(levels).forEach(([levelKey, levelNodes]) => {
    const level = Number(levelKey);
    const y =
      maxLevel === 0
        ? canvasHeight / 2
        : topPadding + ((maxLevel - level) / maxLevel) * (canvasHeight - topPadding - bottomPadding);
    const gap = levelNodes.length > 1 ? Math.min(220, 620 / (levelNodes.length - 1)) : 0;
    const startX = canvasWidth / 2 - ((levelNodes.length - 1) * gap) / 2;

    levelNodes.forEach((node, index) => {
      positions[node.id] = {
        x: startX + index * gap,
        y,
      };
    });
  });

  return { positions, canvasWidth, canvasHeight };
}

function buildTeacherReport(result: PetaKonsepResult) {
  const root = result.nodes.find((node) => node.id === result.root_cause_node_id);
  const path = result.learning_path
    .map((id) => result.nodes.find((node) => node.id === id)?.label || id)
    .join(" -> ");

  return [
    `PetaKonsep AI - Ringkasan Guru`,
    `Mapel/Kelas: ${result.meta.subject} / ${result.meta.grade}`,
    `Target konsep: ${result.meta.target_concept}`,
    `Akar masalah: ${root?.label || result.root_cause_node_id}`,
    `Ringkasan akar: ${result.diagnosis.root_cause_summary}`,
    `Jalur belajar: ${path}`,
    `Estimasi pemulihan: ${result.summary.estimated_recovery_minutes} menit`,
    `Insight guru: ${result.summary.teacher_insight}`,
  ].join("\n");
}

function downloadJson(filename: string, data: PetaKonsepResult) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function PetaKonsepPage() {
  const [subject, setSubject] = useState("Matematika");
  const [grade, setGrade] = useState("SMP Kelas 8");
  const [topic, setTopic] = useState("Pemfaktoran Persamaan Kuadrat");
  const [question, setQuestion] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [modelName, setModelName] = useState<(typeof MODEL_OPTIONS)[number]["id"]>("gemini-2.5-flash");

  const [result, setResult] = useState<PetaKonsepResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [lessonPanel, setLessonPanel] = useState<LessonPanel>("lesson");
  const [practiceDone, setPracticeDone] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;

    const interval = window.setInterval(() => {
      setLoadingStep((step) => (step + 1) % LOADING_TEXTS.length);
    }, 1700);

    return () => window.clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const inputScore = useMemo(() => {
    const fields = [subject, grade, topic, question, studentAnswer, correctAnswer, additionalContext];
    return Math.round((fields.filter((field) => field.trim().length > 0).length / fields.length) * 100);
  }, [additionalContext, correctAnswer, grade, question, studentAnswer, subject, topic]);

  const activeNode = useMemo(() => {
    if (!result) return null;
    return result.nodes.find((node) => node.id === selectedNodeId) || result.nodes[0] || null;
  }, [result, selectedNodeId]);

  const graph = useMemo(() => (result ? getNodePositions(result.nodes) : null), [result]);

  const pathNodes = useMemo(() => {
    if (!result) return [];
    return result.learning_path
      .map((id) => result.nodes.find((node) => node.id === id))
      .filter((node): node is PetaKonsepNode => Boolean(node));
  }, [result]);

  const progress = useMemo(() => {
    if (!activeNode) return { done: 0, total: 0 };
    const keys = activeNode.micro_lesson.practice_questions.map((_, index) => `${activeNode.id}-${index}`);
    return {
      done: keys.filter((key) => practiceDone[key]).length,
      total: keys.length,
    };
  }, [activeNode, practiceDone]);

  const loadDemo = (demo: DemoCase) => {
    setSubject(demo.subject);
    setGrade(demo.grade);
    setTopic(demo.topic);
    setQuestion(demo.question);
    setStudentAnswer(demo.studentAnswer);
    setCorrectAnswer(demo.correctAnswer);
    setAdditionalContext(demo.additionalContext);
    setError(null);
  };

  const resetWorkspace = () => {
    setResult(null);
    setSelectedNodeId(null);
    setLessonPanel("lesson");
    setPracticeDone({});
    setNotes({});
    setError(null);
  };

  const handleAnalyze = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) {
      setError("Soal wajib diisi dulu supaya AI punya konteks diagnosis.");
      return;
    }

    setLoading(true);
    setLoadingStep(0);
    setError(null);
    setResult(null);
    setSelectedNodeId(null);
    setPracticeDone({});
    setNotes({});
    setLessonPanel("lesson");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          grade,
          topic,
          question,
          studentAnswer,
          correctAnswer,
          additionalContext,
          modelName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || "Analisis gagal diproses.");
      }

      const parsed = data as PetaKonsepResult;
      setResult(parsed);
      setSelectedNodeId(parsed.root_cause_node_id || parsed.nodes[0]?.id || null);
      setPracticeDone(createEmptyPracticeState(parsed.nodes));
    } catch (requestError: unknown) {
      const message = requestError instanceof Error ? requestError.message : "Terjadi kesalahan yang tidak terduga.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (kind: "json" | "teacher") => {
    if (!result) return;
    const text = kind === "json" ? JSON.stringify(result, null, 2) : buildTeacherReport(result);
    await navigator.clipboard.writeText(text);
    setCopied(kind);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
              <Brain className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight">PetaKonsep AI</p>
              <p className="text-xs font-medium text-slate-500">Cognitive diagnostic engine untuk SDG 4</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <a
              href="#analysis-form"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <PanelRightOpen className="size-4" aria-hidden="true" />
              Input
            </a>
            <a
              href="#result-panel"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Network className="size-4" aria-hidden="true" />
              Hasil
            </a>
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              <GraduationCap className="size-4" aria-hidden="true" />
              Hackathon Ready
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[430px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Mission Control</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Cari akar masalah, bukan cuma jawaban benar.</h1>
              </div>
              <Sparkles className="mt-1 size-5 shrink-0 text-amber-500" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-3">
                <p className="font-black text-slate-950">{inputScore}%</p>
                <p className="mt-1 text-slate-500">Konteks</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-3">
                <p className="font-black text-slate-950">3-7</p>
                <p className="mt-1 text-slate-500">Node</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-3">
                <p className="font-black text-slate-950">JSON</p>
                <p className="mt-1 text-slate-500">Output</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="demo-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 id="demo-title" className="text-sm font-black text-slate-900">
                  Demo Cepat
                </h2>
                <p className="text-xs text-slate-500">Pilih kasus untuk mengisi form.</p>
              </div>
              <BookOpen className="size-5 text-indigo-600" aria-hidden="true" />
            </div>

            <div className="grid gap-2">
              {DEMO_CASES.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  onClick={() => loadDemo(demo)}
                  className="group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <span>
                    <span className="block text-xs font-black text-slate-900">{demo.topic}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {demo.subject} - {demo.grade}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-700" />
                </button>
              ))}
            </div>
          </section>

          <form id="analysis-form" onSubmit={handleAnalyze} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900">Lembar Diagnosis</h2>
                <p className="text-xs text-slate-500">Isi konteks siswa sejelas mungkin.</p>
              </div>
              <Target className="size-5 text-rose-600" aria-hidden="true" />
            </div>

            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                  Mata pelajaran
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="Matematika"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                  Kelas
                  <input
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="SMP Kelas 8"
                  />
                </label>
              </div>

              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Topik
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Pemfaktoran persamaan kuadrat"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Soal
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={4}
                  className="resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Tuliskan soal yang dikerjakan siswa..."
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Jawaban siswa
                <textarea
                  value={studentAnswer}
                  onChange={(event) => setStudentAnswer(event.target.value)}
                  rows={3}
                  className="resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Contoh: x = 7. Jika kosong, biarkan kosong."
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Jawaban benar
                <input
                  value={correctAnswer}
                  onChange={(event) => setCorrectAnswer(event.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Opsional, tapi sangat membantu"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Informasi tambahan
                <textarea
                  value={additionalContext}
                  onChange={(event) => setAdditionalContext(event.target.value)}
                  rows={3}
                  className="resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Misalnya kebiasaan siswa, bab yang sedang dipelajari, atau dugaan guru."
                />
              </label>

              <div className="grid gap-2">
                <p className="text-xs font-black text-slate-700">Mode model</p>
                <div className="grid grid-cols-2 gap-2">
                  {MODEL_OPTIONS.map((option) => {
                    const active = modelName === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setModelName(option.id)}
                        className={`rounded-md border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          active
                            ? "border-indigo-400 bg-indigo-50 text-indigo-950"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="block text-xs font-black">{option.label}</span>
                        <span className="mt-1 block text-[11px] leading-snug text-slate-500">{option.helper}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Mulai Analisis
              </button>
              <button
                type="button"
                onClick={resetWorkspace}
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 transition hover:bg-slate-100"
                aria-label="Bersihkan hasil"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-relaxed text-rose-800"
                >
                  <AlertTriangle className="mr-2 inline size-4 align-text-bottom" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </aside>

        <section id="result-panel" className="min-w-0 space-y-4">
          {loading && (
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="flex size-16 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <Loader2 className="size-8 animate-spin" aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-xl font-black text-slate-950">AI sedang menyusun peta konsep.</h2>
                <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-500">{LOADING_TEXTS[loadingStep]}</p>
                <div className="mt-6 grid w-full max-w-lg gap-2">
                  {LOADING_TEXTS.map((text, index) => (
                    <div
                      key={text}
                      className={`rounded-md border px-3 py-2 text-left text-xs font-bold transition ${
                        index <= loadingStep
                          ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                          : "border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {index + 1}. {text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && !result && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">PetaKonsep AI</p>
                <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight">Dashboard diagnostik untuk mengubah salah jawab menjadi rute belajar.</h2>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-3">
                {[
                  {
                    icon: Route,
                    title: "Causal learning path",
                    text: "Menunjukkan urutan konsep yang perlu dipulihkan dari akar masalah sampai target.",
                  },
                  {
                    icon: Network,
                    title: "Knowledge graph",
                    text: "Node warna merah, amber, hijau, dan abu-abu membuat gap siswa mudah dibaca guru.",
                  },
                  {
                    icon: Lightbulb,
                    title: "Micro-lesson lokal",
                    text: "Setiap node punya analogi Indonesia, contoh bertahap, dan tiga latihan pemulihan.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <item.icon className="size-5 text-indigo-700" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 p-5">
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
                  <Brain className="mx-auto size-10 text-slate-400" aria-hidden="true" />
                  <p className="mt-3 text-sm font-black text-slate-900">Muat demo atau isi lembar diagnosis di kiri.</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">Hasil graph, laporan guru, dan materi pemulihan akan muncul di sini.</p>
                </div>
              </div>
            </div>
          )}

          {!loading && result && graph && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  {
                    icon: Target,
                    label: "Target konsep",
                    value: result.meta.target_concept,
                    tone: "text-rose-700 bg-rose-50 border-rose-200",
                  },
                  {
                    icon: Timer,
                    label: "Estimasi pemulihan",
                    value: `${result.summary.estimated_recovery_minutes} menit`,
                    tone: "text-amber-700 bg-amber-50 border-amber-200",
                  },
                  {
                    icon: Layers3,
                    label: "Jumlah konsep",
                    value: `${result.nodes.length} node`,
                    tone: "text-indigo-700 bg-indigo-50 border-indigo-200",
                  },
                  {
                    icon: CheckCircle2,
                    label: "Confidence",
                    value: result.meta.analysis_confidence,
                    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
                  },
                ].map((item) => (
                  <div key={item.label} className={`rounded-lg border p-4 ${item.tone}`}>
                    <item.icon className="size-5" aria-hidden="true" />
                    <p className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] opacity-80">{item.label}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-black capitalize">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Diagnosis Utama</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{result.diagnosis.root_cause_summary}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText("teacher")}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                    >
                      <Clipboard className="size-4" />
                      {copied === "teacher" ? "Tersalin" : "Salin laporan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText("json")}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                    >
                      <FileText className="size-4" />
                      {copied === "json" ? "Tersalin" : "Salin JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadJson("petakonsep-diagnosis.json", result)}
                      className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800"
                    >
                      <Download className="size-4" />
                      Unduh
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black text-slate-500">Yang dilakukan siswa</p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">{result.diagnosis.what_student_thinks}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black text-slate-500">Yang seharusnya terjadi</p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">{result.diagnosis.what_is_actually_correct}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Knowledge Dependency Graph</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">Klik node untuk membuka materi pemulihan.</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(STATUS_META) as NodeStatus[]).map((status) => (
                      <span
                        key={status}
                        className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-black ${STATUS_META[status].badge}`}
                      >
                        <span className={`size-2 rounded-full ${STATUS_META[status].dot}`} />
                        {STATUS_META[status].label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-[linear-gradient(#f8fafc_1px,transparent_1px),linear-gradient(90deg,#f8fafc_1px,transparent_1px)] bg-[size:28px_28px]">
                  <div className="relative min-w-[820px]" style={{ height: graph.canvasHeight }}>
                    <svg className="absolute inset-0 size-full" viewBox={`0 0 ${graph.canvasWidth} ${graph.canvasHeight}`} role="img" aria-label="Peta dependensi konsep">
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                          <path d="M0,0 L10,5 L0,10 z" fill="#475569" />
                        </marker>
                      </defs>
                      {result.edges.map((edge, index) => {
                        const source = graph.positions[edge.source];
                        const target = graph.positions[edge.target];
                        if (!source || !target) return null;
                        const isPath = result.learning_path.includes(edge.source) && result.learning_path.includes(edge.target);
                        const middleY = (source.y + target.y) / 2;
                        return (
                          <path
                            key={`${edge.source}-${edge.target}-${index}`}
                            d={`M ${source.x} ${source.y + 42} C ${source.x} ${middleY}, ${target.x} ${middleY}, ${target.x} ${target.y - 42}`}
                            fill="none"
                            stroke={isPath ? "#4f46e5" : "#94a3b8"}
                            strokeWidth={isPath ? 3 : 2}
                            strokeDasharray={isPath ? "8 8" : undefined}
                            markerEnd="url(#arrowhead)"
                            className={isPath ? "flow-line" : undefined}
                          />
                        );
                      })}
                    </svg>

                    {result.nodes.map((node) => {
                      const position = graph.positions[node.id];
                      if (!position) return null;
                      const status = STATUS_META[node.status];
                      const selected = node.id === selectedNodeId;
                      const rootCause = node.id === result.root_cause_node_id;
                      const target = node.level === 0;

                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => {
                            setSelectedNodeId(node.id);
                            setLessonPanel("lesson");
                          }}
                          className={`absolute w-[188px] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-3 text-left shadow-sm transition hover:-translate-y-[calc(50%+2px)] focus:outline-none focus:ring-2 focus:ring-indigo-500 ${status.node} ${status.border} ${
                            selected ? "ring-2 ring-indigo-500" : ""
                          }`}
                          style={{ left: position.x, top: position.y }}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Level {node.level}</span>
                            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-black ${status.badge}`}>
                              <span className={`size-1.5 rounded-full ${status.dot}`} />
                              {status.label}
                            </span>
                          </span>
                          <span className="mt-2 block line-clamp-2 text-sm font-black leading-tight text-slate-950">{node.label}</span>
                          <span className="mt-2 flex flex-wrap gap-1">
                            {rootCause && <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">Akar</span>}
                            {target && <span className="rounded bg-slate-950 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">Target</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-800">
                    <Route className="size-4" aria-hidden="true" />
                    Jalur belajar
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pathNodes.map((node, index) => (
                      <div key={node.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(node.id)}
                          className="rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-black text-indigo-900 transition hover:bg-indigo-100"
                        >
                          {node.label}
                        </button>
                        {index < pathNodes.length - 1 && <ArrowRight className="size-4 text-indigo-500" aria-hidden="true" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {activeNode && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-black ${STATUS_META[activeNode.status].badge}`}>
                          <span className={`size-2 rounded-full ${STATUS_META[activeNode.status].dot}`} />
                          {STATUS_META[activeNode.status].label}
                        </span>
                        {activeNode.id === result.root_cause_node_id && (
                          <span className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-800">
                            Akar masalah utama
                          </span>
                        )}
                      </div>
                      <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{activeNode.label}</h2>
                      <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">{STATUS_META[activeNode.status].description}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-xs font-black">
                      {[
                        ["lesson", "Materi", BookOpen],
                        ["practice", "Latihan", CheckCircle2],
                        ["teacher", "Guru", Users],
                      ].map(([value, label, Icon]) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => setLessonPanel(value as LessonPanel)}
                          className={`inline-flex items-center justify-center gap-1 rounded px-2 py-2 transition ${
                            lessonPanel === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                          {String(label)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {lessonPanel === "lesson" && (
                      <motion.div
                        key="lesson"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="grid gap-4 pt-4 lg:grid-cols-[1.1fr_0.9fr]"
                      >
                        <div className="space-y-4">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                              <Lightbulb className="size-4 text-amber-600" aria-hidden="true" />
                              Penjelasan inti
                            </p>
                            <h3 className="mt-3 text-lg font-black text-slate-950">{activeNode.micro_lesson.title}</h3>
                            <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">
                              {activeNode.micro_lesson.core_explanation}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                              <Users className="size-4 text-emerald-600" aria-hidden="true" />
                              Analogi lokal
                            </p>
                            <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700">{activeNode.micro_lesson.analogy}</p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-300">
                            <GraduationCap className="size-4 text-indigo-300" aria-hidden="true" />
                            Worked example
                          </p>
                          <pre className="mt-4 whitespace-pre-wrap rounded-md bg-white/10 p-4 text-xs font-semibold leading-relaxed text-slate-100">
                            {activeNode.micro_lesson.worked_example}
                          </pre>
                        </div>
                      </motion.div>
                    )}

                    {lessonPanel === "practice" && (
                      <motion.div
                        key="practice"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="grid gap-4 pt-4 lg:grid-cols-[1fr_280px]"
                      >
                        <div className="grid gap-3">
                          {activeNode.micro_lesson.practice_questions.map((practiceQuestion, index) => {
                            const key = `${activeNode.id}-${index}`;
                            return (
                              <label key={key} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <span className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={practiceDone[key] || false}
                                    onChange={(event) =>
                                      setPracticeDone((current) => ({
                                        ...current,
                                        [key]: event.target.checked,
                                      }))
                                    }
                                    className="mt-1 size-4 rounded border-slate-300 text-indigo-600"
                                  />
                                  <span>
                                    <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                      Soal {index + 1} - {index === 0 ? "Mudah" : index === 1 ? "Sedang" : "Tantangan"}
                                    </span>
                                    <span className="mt-2 block text-sm font-bold leading-relaxed text-slate-900">{practiceQuestion}</span>
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-800">Progress latihan</p>
                          <p className="mt-2 text-3xl font-black text-indigo-950">
                            {progress.done}/{progress.total}
                          </p>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                            <div
                              className="h-full rounded-full bg-indigo-600 transition-all"
                              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                            />
                          </div>
                          <label className="mt-4 grid gap-2 text-xs font-black text-indigo-900">
                            Catatan guru/siswa
                            <textarea
                              value={notes[activeNode.id] || ""}
                              onChange={(event) =>
                                setNotes((current) => ({
                                  ...current,
                                  [activeNode.id]: event.target.value,
                                }))
                              }
                              rows={5}
                              className="resize-none rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium leading-relaxed text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              placeholder="Catat strategi, miskonsepsi baru, atau tindak lanjut..."
                            />
                          </label>
                        </div>
                      </motion.div>
                    )}

                    {lessonPanel === "teacher" && (
                      <motion.div
                        key="teacher"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="grid gap-4 pt-4 lg:grid-cols-2"
                      >
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                            <HelpCircle className="size-4 text-rose-600" aria-hidden="true" />
                            Evidence
                          </p>
                          <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-800">{activeNode.evidence}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-800">
                            <Users className="size-4" aria-hidden="true" />
                            Insight guru
                          </p>
                          <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-emerald-950">{result.summary.teacher_insight}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-800">
                    <Sparkles className="size-4" aria-hidden="true" />
                    Pesan untuk siswa
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-indigo-950">{result.summary.motivational_message}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
                    Surface error
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-800">{result.diagnosis.surface_error}</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
