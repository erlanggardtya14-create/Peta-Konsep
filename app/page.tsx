"use client";

import React, { useState, useEffect } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  Brain, 
  Sparkles, 
  ArrowRight, 
  GraduationCap, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  X, 
  Play, 
  Clock, 
  Lightbulb, 
  BookOpen, 
  ArrowUpRight, 
  ChevronRight, 
  RefreshCw,
  Send,
  Users
} from "lucide-react";

// Types corresponding to PetaKonsep API Output
interface PetaKonsepNode {
  id: string;
  label: string;
  status: "failed" | "weak" | "mastered" | "unknown";
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
    analysis_confidence: "high" | "medium" | "low";
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

// 4 High-fidelity Mock Test Cases in Bahasa Indonesia
const DEMO_CASES = [
  {
    id: "math-smp",
    btnLabel: "Matematika SMP (Persamaan Kuadrat)",
    subject: "Matematika",
    grade: "SMP Kelas 8",
    topic: "Pemfaktoran Persamaan Kuadrat",
    question: "Tentukan nilai x dari persamaan kuadrat x² - 5x + 6 = 0",
    studentAnswer: "x = 5 dan x = 6",
    correctAnswer: "x = 2 dan x = 3",
    additionalContext: "Siswa tampak mengambil konstanta -5 (diubah jadi positif) dan 6 langsung dari koefisien soal.",
  },
  {
    id: "physics-sma",
    btnLabel: "Fisika SMA (Hukum Newton II)",
    subject: "Fisika",
    grade: "SMA Kelas 10",
    topic: "Hukum Newton II",
    question: "Sebuah benda bermassa m = 5 kg didorong dengan percepatan a = 3 m/s². Berapakah Gaya (F) yang bekerja pada benda tersebut? (Gunakan rumus F = m * a)",
    studentAnswer: "F = 5 + 3 = 8 N",
    correctAnswer: "F = 15 N",
    additionalContext: "Siswa menjumlahkan massa dan percepatan alih-alih mengalikannya.",
  },
  {
    id: "indo-sd",
    btnLabel: "Bahasa Indonesia SD (Ide Pokok)",
    subject: "Bahasa Indonesia",
    grade: "SD Kelas 5",
    topic: "Membaca Pemahaman (Ide Pokok)",
    question: "Tentukan ide pokok dari paragraf berikut:\n\"Kucing adalah salah satu hewan peliharaan paling populer di dunia. Hewan ini disukai karena memiliki bulu yang lembut dan tingkah laku yang menggemaskan. Kucing sering sekali dipelihara untuk membantu mengusir tikus yang ada di dalam rumah. Selain itu, mendengarkan dengkurannya terbukti secara medis dapat meredakan tingkat stres pemiliknya.\"",
    studentAnswer: "Kucing dipelihara untuk menangkap tikus di rumah.",
    correctAnswer: "Kucing adalah salah satu hewan peliharaan paling populer di dunia.",
    additionalContext: "Siswa menunjuk ke detail penjelas spesifik dalam paragraf daripada mengambil pokok bahasan utama di awal.",
  },
  {
    id: "empty-edge",
    btnLabel: "Kasus Khusus: Jawaban Kosong",
    subject: "Matematika",
    grade: "SMP Kelas 7",
    topic: "Persamaan Linier Satu Variabel",
    question: "Selesaikan persamaan linier sederhana berikut: 3x - 5 = 10, tentukan nilai x!",
    studentAnswer: "Saya tidak tahu pak, belum diajarkan cara memindahkan angkanya.",
    correctAnswer: "x = 5",
    additionalContext: "Siswa menyerah dan tidak memberikan hasil perhitungan.",
  }
];

// Stagger loops for engaging loader text
const LOADING_TEXTS = [
  "Membaca & menganalisis jawaban salah siswa secara kognitif...",
  "Menelusuri rantai prasyarat konsep ke belakang...",
  "Menganalisis kegagalan kognitif & status prasyarat (Red/Orange/Green)...",
  "Menyusun materi mikro-lesson ramah berbahasa Indonesia...",
  "Merancang analogi kultural lokal (warung, pasar, permainan tradisional)...",
  "Memetakan rancangan graf dependensi pengetahuan..."
];

export default function PetaKonsepPage() {
  // Manual Input form state
  const [subject, setSubject] = useState("Matematika");
  const [grade, setGrade] = useState("SMP Kelas 8");
  const [topic, setTopic] = useState("Persamaan Kuadrat");
  const [question, setQuestion] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [modelName, setModelName] = useState("gemini-3.5-flash");

  // Client states
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PetaKonsepResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Micro-lesson states
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % LOADING_TEXTS.length);
      }, 2500);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingStep((prev) => {
        if (prev !== 0) return 0;
        return prev;
      });
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Load a demo case helper
  const handleLoadDemo = (demoId: string) => {
    const demo = DEMO_CASES.find(c => c.id === demoId);
    if (demo) {
      setSubject(demo.subject);
      setGrade(demo.grade);
      setTopic(demo.topic);
      setQuestion(demo.question);
      setStudentAnswer(demo.studentAnswer);
      setCorrectAnswer(demo.correctAnswer);
      setAdditionalContext(demo.additionalContext);
      // clear output
      setError(null);
    }
  };

  // Submit diagnostic analyze to NextJS server
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !studentAnswer.trim()) {
      setError("Silakan isi Soal dan Jawaban Siswa terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedNodeId(null);
    setQuizAnswers({});
    setShowExplanation({});

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
        throw new Error(data.details || data.error || "Gagal menghubungi Gemini.");
      }

      setResult(data);
      // Auto-select the root cause node so student starts matching study instructions immediately
      if (data.root_cause_node_id) {
        setSelectedNodeId(data.root_cause_node_id);
      } else if (data.nodes && data.nodes.length > 0) {
        setSelectedNodeId(data.nodes[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan saat memproses data.");
    } finally {
      setLoading(false);
    }
  };

  // Node UI configuration based on status
  const getStatusColor = (status: "failed" | "weak" | "mastered" | "unknown") => {
    switch (status) {
      case "failed": return { border: "border-red-500", bg: "bg-red-50/90", text: "text-red-700", badge: "bg-red-100 text-red-800", dot: "bg-red-500" };
      case "weak": return { border: "border-orange-500", bg: "bg-orange-50/90", text: "text-orange-700", badge: "bg-orange-100 text-orange-800", dot: "bg-orange-500" };
      case "mastered": return { border: "border-green-500", bg: "bg-green-50/90", text: "text-green-700", badge: "bg-green-100 text-green-800", dot: "bg-green-500" };
      default: return { border: "border-slate-400", bg: "bg-slate-50/90", text: "text-slate-600", badge: "bg-slate-100 text-slate-800", dot: "bg-slate-400" };
    }
  };

  // Helper custom automatic horizontal/vertical math node layout calculations
  const getNodeCoordinates = (nodes: PetaKonsepNode[]) => {
    const coords: Record<string, { x: number; y: number }> = {};
    if (!nodes || nodes.length === 0) return coords;

    // Group nodes by level
    const levelMap: Record<number, PetaKonsepNode[]> = {};
    nodes.forEach(node => {
      if (!levelMap[node.level]) levelMap[node.level] = [];
      levelMap[node.level].push(node);
    });

    const uniqueLevels = Object.keys(levelMap).map(Number).sort((a, b) => b - a); // highest levels first
    const maxLevel = Math.max(...uniqueLevels, 0);

    // Grid size assumptions: Width=600, Height=420
    const canvasWidth = 640;
    const canvasHeight = 360;

    uniqueLevels.forEach((level) => {
      const levelNodes = levelMap[level];
      const count = levelNodes.length;

      // Position level vertically (Waterfall concept: maxLevel (foundational) at Top, level 0 (target) at Bottom)
      let y = 50;
      if (maxLevel > 0) {
        y = 50 + ((maxLevel - level) / maxLevel) * (canvasHeight - 100);
      } else {
        y = canvasHeight / 2;
      }

      // Position nodes horizontally
      levelNodes.forEach((node, idx) => {
        let x = canvasWidth / 2;
        if (count > 1) {
          const gapX = Math.min(180, (canvasWidth - 120) / (count - 1));
          const startX = canvasWidth / 2 - ((count - 1) * gapX) / 2;
          x = startX + idx * gapX;
        }
        coords[node.id] = { x, y };
      });
    });

    return coords;
  };

  const nodePositions = result ? getNodeCoordinates(result.nodes) : {};
  const activeNode = result?.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans" id="petakonsep-root">
      
      {/* Visual Header */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50 px-4 py-3.5 shadow-sm" id="petakonsep-navbar">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100" id="brand-logo">
              <Brain className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2 leading-none">
                PetaKonsep AI 
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  v1.0
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">Cognitive Diagnostic Engine v1.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <GraduationCap className="w-3.5 h-3.5" />
              SDG 4: Quality Education
            </span>
            <a 
              href="#democases-section" 
              className="text-xs font-medium text-slate-500 hover:text-slate-900 transition duration-200"
            >
              Lihat Demo Kasus
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8" id="petakonsep-main">
        
        {/* App Pitch Hero Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden" id="hero-banner">
          <div className="absolute right-0 top-0 w-80 h-80 bg-violet-600/[0.03] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-emerald-600/[0.02] rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-3xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-100 px-3 py-1 rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-violet-500" />
              Cognitive Tracing back propagation
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800">
              Ubah Jawaban Salah Menjadi Kompas Belajar Siswa
            </h2>
            <p className="text-slate-650 text-xs sm:text-sm leading-relaxed">
              PetaKonsep AI tidak hanya menyunting kesalahan, melainkan mendeteksi **kesenjangan pemahaman paling mendasar (Akar Masalah)** melalui rantai dependensi konsep matematika, sains, dan keterampilan yang terstruktur secara langsung.
            </p>
            <div className="flex flex-wrap gap-4 text-[11px] font-medium text-slate-500 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Failed Prerequisite
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Partial Weak Gap
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Mastered Foundations
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Unknown State
              </div>
            </div>
          </div>
        </div>

        {/* Quick Demo Cases Selector */}
        <section className="space-y-3" id="democases-section">
          <div className="flex items-center gap-2 text-slate-800">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base sm:text-lg">Muat Contoh Demo Diagnostik Cepat</h3>
          </div>
          <p className="text-slate-500 text-xs">Klik salah satu studi kasus di bawah ini untuk mengisi formulir input secara otomatis.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DEMO_CASES.map((demo) => (
              <button
                key={demo.id}
                onClick={() => handleLoadDemo(demo.id)}
                className="text-left p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 group flex flex-col justify-between shadow-xs cursor-pointer"
                id={`demo-btn-${demo.id}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {demo.subject}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">{demo.grade}</span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-700 line-clamp-1 group-hover:text-slate-950">
                    {demo.topic}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1.5 italic font-normal">
                    Siswa: &ldquo;{demo.studentAnswer}&rdquo;
                  </p>
                </div>
                <div className="flex items-center justify-end text-[11px] text-indigo-600 mt-3 font-semibold group-hover:text-indigo-700">
                  Muat Kasus <ChevronRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Inputs and Diagnostic Setup Screen */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="workspace-deck">
          
          {/* LEFT: Input Form Controller */}
          <div className="lg:col-span-4 space-y-6" id="input-column">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Setup Lembar Siswa
                </h3>
                <span className="text-xs font-semibold text-slate-400">Analisis Kognitif</span>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-4 text-xs font-medium text-slate-600">
                
                {/* Meta Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase tracking-wide">Mata Pelajaran</label>
                    <input 
                      type="text" 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Matematika" 
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs shadow-xs transition-shadow placeholder:text-slate-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase tracking-wide">Kelas / Tingkat</label>
                    <input 
                      type="text" 
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="e.g. SMP Kelas 8" 
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs shadow-xs transition-shadow placeholder:text-slate-400"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase tracking-wide">Topik Utama Pembelajaran</label>
                  <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Pemfaktoran Persamaan Kuadrat" 
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs shadow-xs transition-shadow placeholder:text-slate-400"
                    required
                  />
                </div>

                {/* Question */}
                <div>
                  <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase tracking-wide">Soal Ujian / Latihan</label>
                  <textarea 
                    rows={3} 
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Tuliskan soal lengkap yang diberikan ke siswa..." 
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs shadow-xs transition-shadow placeholder:text-slate-400 leading-relaxed"
                    required
                  />
                </div>

                {/* Incorrect Student Answer */}
                <div>
                  <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>Jawaban Salah dari Siswa</span>
                    <span className="text-[10px] text-red-500 italic">Sebab Pemicu Analisis</span>
                  </label>
                  <textarea 
                    rows={2} 
                    value={studentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    placeholder="Tuliskan jawaban yang salah dari siswa..." 
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs shadow-xs transition-shadow placeholder:text-slate-400 leading-relaxed"
                    required
                  />
                </div>

                {/* Correct Answer */}
                <div>
                  <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase tracking-wide">
                    Jawaban Benar <span className="text-[10px] text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input 
                    type="text" 
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    placeholder="Tulis jawaban kunci jika tahu (atau kosongkan untuk auto-grading)" 
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs shadow-xs transition-shadow placeholder:text-slate-400"
                  />
                </div>

                {/* Additional Context */}
                <div>
                  <label className="block text-[11px] text-slate-500 font-bold mb-1 uppercase tracking-wide">
                    Informasi Tambahan <span className="text-[10px] text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input 
                    type="text" 
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="e.g. Siswa membolak-balik tanda negatif..." 
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs shadow-xs transition-shadow placeholder:text-slate-400"
                  />
                </div>

                {/* LLM Model Selection Tool */}
                <div className="border-t border-slate-100 pt-3">
                  <label className="block text-[11px] text-indigo-650 font-bold mb-1 uppercase tracking-wider">PILIHAN MODEL GEMINI</label>
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs cursor-pointer shadow-xs transition-shadow"
                  >
                    <option value="gemini-3.5-flash">gemini-3.5-flash (Cepat, Efisien)</option>
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Deteksi Logika Kompleks)</option>
                  </select>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      Memproses Diagnostik...
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5 text-indigo-200" />
                      Mulai Analisis Kognitif
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Error Showcase */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2 relative overflow-hidden shadow-xs">
                <div className="absolute right-0 top-0 w-8 h-8 text-red-600/10"><AlertTriangle className="w-full h-full" /></div>
                <h4 className="font-bold flex items-center gap-1.5 text-red-700">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Gagal Memproses Analisis
                </h4>
                <p className="leading-relaxed font-medium">{error}</p>
                <p className="text-[10px] text-slate-500">Silakan coba periksa kembali input Anda atau coba lagi beberapa saat lagi.</p>
              </div>
            )}

            {/* Empty Context Help Tip */}
            {!result && !loading && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <HelpCircle className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-800">Panduan Diagnostik</h4>
                </div>
                <div className="space-y-2.5 text-xs text-slate-550 leading-relaxed font-medium">
                  <div className="flex gap-2.5">
                    <span className="text-indigo-600 font-extrabold">1.</span>
                    <p>Masukkan mata pelajaran, kelas, topik, soal latihan, serta jawaban keliru yang didapat dari lembar tugas siswa.</p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="text-indigo-600 font-extrabold">2.</span>
                    <p>Pilih model, lalu luncurkan penganalisis. Kecerdasan Buatan akan menelusuri rantai prasyarat konsep mundur dari level target.</p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="text-indigo-600 font-extrabold">3.</span>
                    <p>Visual prasyarat akan di-render sebagai graf berarah dengan penyorotan pada <strong className="text-red-600 font-bold">Akar Penyebab Kesalahan (Root Cause)</strong>.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Visual concept Map & Explanations Workspace */}
          <div className="lg:col-span-8 space-y-6" id="analysis-column">
                       {/* Standard Processing Animating Loom */}
            {loading && (
              <div className="rounded-2xl border border-slate-200 bg-white min-h-[450px] flex flex-col items-center justify-center p-8 space-y-6 shadow-sm relative overflow-hidden" id="loading-loom">
                <div className="absolute inset-0 bg-indigo-50/20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-100/10 via-transparent to-transparent opacity-60 pointer-events-none" />
                
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
                  <Brain className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
                </div>
                
                <div className="text-center space-y-2 max-w-sm relative z-10">
                  <h4 className="text-slate-800 font-extrabold text-lg">PetaKonsep AI Diagnostic Engine</h4>
                  
                  {/* Animating status progress message */}
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={loadingStep}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="text-indigo-600 text-xs font-bold min-h-[30px]"
                    >
                      {LOADING_TEXTS[loadingStep]}
                    </motion.p>
                  </AnimatePresence>
                  
                  <p className="text-slate-450 text-[10px] font-medium">
                    Proses ini membutuhkan waktu 5-10 detik untuk membangun model diagnosa kognitif secara murni dan menyusun lembar mikro-lesson.
                  </p>
                </div>
              </div>
            )}

            {/* Diagnostic Results Showcase */}
            {result && !loading && (
              <div className="space-y-6 animate-fade-in" id="analysis-workspace">
                
                {/* Confidence & Subject meta dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="meta-indicators">
                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">Tingkat Keyakinan</span>
                      <span className="text-xs font-bold capitalize text-slate-800 flex items-center gap-1.5 mt-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${result.meta.analysis_confidence === "high" ? "bg-emerald-500" : result.meta.analysis_confidence === "medium" ? "bg-orange-500" : "bg-red-500"}`} />
                        {result.meta.analysis_confidence === "high" ? "Sangat Tinggi (High)" : result.meta.analysis_confidence === "medium" ? "Cukup (Medium)" : "Rendah (Low)"}
                      </span>
                    </div>
                    <CheckCircle className="w-8 h-8 text-indigo-500/10" />
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">Perkiraan Pemulihan</span>
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-1">
                        <Clock className="w-4 h-4 text-orange-500" />
                        {result.summary.estimated_recovery_minutes || 30} Menit Belajar
                      </span>
                    </div>
                    <Clock className="w-8 h-8 text-orange-500/10" />
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">Konsep Target</span>
                      <span className="text-xs font-bold text-slate-800 mt-1 block line-clamp-1">
                        {result.meta.target_concept || "Analisis Konsep"}
                      </span>
                    </div>
                    <Sparkles className="w-8 h-8 text-violet-500/10" />
                  </div>
                </div>

                {/* Cognitive Diagnosis Bento Cards */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm" id="diagnosis-bento">
                  <div className="border-b border-slate-100 bg-slate-50/40 px-5 py-3.5 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-805 text-xs sm:text-sm flex items-center gap-2">
                      <GraduationCap className="w-4.5 h-4.5 text-indigo-650" /> Analisis Logika Salah Siswa
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400">Diagnosis Kognitif</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 text-xs border-b border-slate-100">
                    <div className="p-5 space-y-1.5 border-r border-slate-100 bg-red-50/10">
                      <h4 className="font-bold text-red-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500" /> Gejala Kesalahan (Surface Error)
                      </h4>
                      <p className="text-slate-650 leading-relaxed font-medium">
                        {result.diagnosis.surface_error}
                      </p>
                    </div>

                    <div className="p-5 space-y-1.5 bg-indigo-50/15">
                      <h4 className="font-bold text-indigo-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Akar Masalah Utama (Root Cause)
                      </h4>
                      <p className="text-slate-650 leading-relaxed font-semibold">
                        {result.diagnosis.root_cause_summary}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 text-xs">
                    <div className="p-5 space-y-1.5 border-r border-slate-100 bg-orange-50/10">
                      <h4 className="font-bold text-orange-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> Cara Berpikir Keliru Siswa
                      </h4>
                      <p className="text-slate-600 leading-relaxed italic font-medium">
                        &ldquo;{result.diagnosis.what_student_thinks}&rdquo;
                      </p>
                    </div>
                    
                    <div className="p-5 space-y-1.5 bg-emerald-50/10">
                      <h4 className="font-bold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Pemahaman yang Seharusnya Benar
                      </h4>
                      <p className="text-slate-650 leading-relaxed font-medium">
                        {result.diagnosis.what_is_actually_correct}
                      </p>
                    </div>
                  </div>
                </div>

                {/* GRAPH WORKSPACE: Render Interactive SVG Knowledge dependency Graph */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 relative" id="graph-panel">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Brain className="w-5 h-5 text-emerald-600" /> Peta Dependensi Prasyarat Konsep
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">
                        Foundational prasyarat berada di **Atas**, mengalir ke konsep target di **Bawah**. Klik konsep untuk mempelajari materinya.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md flex items-center gap-1 font-bold animate-pulse">
                        <ArrowUpRight className="w-3 h-3 text-indigo-600" /> Jalur Belajar Aktif
                      </span>
                    </div>
                  </div>

                  {/* Interactive SVG Workspace Container */}
                  <div className="relative w-full overflow-x-auto overflow-y-hidden bg-slate-50 border border-slate-150 rounded-xl py-4 shadow-inner" id="graph-interactive-area" style={{ minHeight: "410px" }}>
                    <div className="mx-auto" style={{ width: "640px", height: "370px", position: "relative" }}>
                      
                      {/* SVG Connection Paths */}
                      <svg className="absolute inset-0 pointer-events-none" width="640" height="370" id="dependency-paths">
                        <defs>
                          <marker
                            id="arrowhead"
                            viewBox="0 0 10 10"
                            refX="16"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#94A3B8" />
                          </marker>
                          <marker
                            id="arrowhead-active"
                            viewBox="0 0 10 10"
                            refX="16"
                            refY="5"
                            markerWidth="6.5"
                            markerHeight="6.5"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#4B5563" />
                          </marker>
                          <linearGradient id="glowing-indigo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#4F46E5" />
                            <stop offset="100%" stopColor="#818CF8" />
                          </linearGradient>
                        </defs>

                        {/* Concept connections edges mapping */}
                        {result.edges && result.edges.map((edge, idx) => {
                          const srcLoc = nodePositions[edge.source];
                          const tgtLoc = nodePositions[edge.target];
                          if (!srcLoc || !tgtLoc) return null;

                          // Check if edge is part of the learning path recommendation sequence
                          // It is active if both source and target are consecutive in learning_path
                          const srcIndex = result.learning_path.indexOf(edge.source);
                          const isActiveEdge = srcIndex !== -1 && result.learning_path[srcIndex + 1] === edge.target || 
                            (result.learning_path.includes(edge.source) && result.learning_path.includes(edge.target) && Math.abs(result.learning_path.indexOf(edge.source) - result.learning_path.indexOf(edge.target)) === 1);

                          const controlY = (srcLoc.y + tgtLoc.y) / 2;

                          return (
                            <g key={`edge-${idx}`}>
                              {/* Glowing Active Underlay */}
                              {isActiveEdge && (
                                <path
                                  d={`M ${srcLoc.x} ${srcLoc.y} C ${srcLoc.x} ${controlY}, ${tgtLoc.x} ${controlY}, ${tgtLoc.x} ${tgtLoc.y}`}
                                  fill="none"
                                  stroke="#818CF8"
                                  strokeWidth="5"
                                  strokeOpacity="0.15"
                                  className="blur-xs"
                                />
                              )}
                              
                              {/* Main Connection Bezier Line */}
                              <path
                                  d={`M ${srcLoc.x} ${srcLoc.y} C ${srcLoc.x} ${controlY}, ${tgtLoc.x} ${controlY}, ${tgtLoc.x} ${tgtLoc.y}`}
                                  fill="none"
                                  stroke={isActiveEdge ? "url(#glowing-indigo-grad)" : "#CBD5E1"}
                                  strokeWidth={isActiveEdge ? "2.5" : "1.5"}
                                  strokeDasharray={isActiveEdge ? "5,5" : "none"}
                                  strokeDashoffset={isActiveEdge ? "3" : "0"}
                                  markerEnd={isActiveEdge ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                                  className={isActiveEdge ? "animate-[dash_10s_linear_infinite]" : ""}
                                  style={isActiveEdge ? { strokeDasharray: "6,6", animation: "flowDashes 25s linear infinite" } : {}}
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Render Interactive Nodes */}
                      {result.nodes && result.nodes.map((node) => {
                        const loc = nodePositions[node.id];
                        if (!loc) return null;

                        const isRootCause = node.id === result.root_cause_node_id;
                        const isTarget = node.level === 0;
                        const isSelected = node.id === selectedNodeId;
                        const spec = getStatusColor(node.status);

                        return (
                          <motion.div
                            key={node.id}
                            className={`absolute w-[185px] cursor-pointer text-xs rounded-xl border p-2.5 transition duration-200 ${spec.bg} ${spec.border} group`}
                            style={{
                              left: loc.x - 92.5,
                              top: loc.y - 35,
                              boxShadow: isSelected 
                                ? "0 0 15px rgba(99, 102, 241, 0.45)" 
                                : isRootCause 
                                ? "0 0 10px rgba(239, 68, 68, 0.25)" 
                                : "none",
                              zIndex: isSelected ? 30 : 20,
                            }}
                            whileHover={{ scale: 1.04 }}
                            onClick={() => setSelectedNodeId(node.id)}
                            id={`concept-node-${node.id}`}
                          >
                            <div className="flex flex-col h-full justify-between gap-1">
                              
                              {/* Node header with hierarchy info */}
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest block header-level">
                                  LEVEL {node.level}
                                </span>
                                
                                {/* Status dot indicator */}
                                <div className="flex items-center gap-1 font-semibold text-[8b]">
                                  <span className={`w-1.5 h-1.5 rounded-full ${spec.dot}`} />
                                  <span className={`text-[8px] font-bold uppercase tracking-wider ${spec.text}`}>
                                    {node.status}
                                  </span>
                                </div>
                              </div>

                              {/* Concept Label */}
                              <h4 className="font-bold text-[11px] text-slate-900 leading-tight group-hover:text-black line-clamp-1">
                                {node.label}
                              </h4>

                              {/* Badges and tags */}
                              <div className="flex flex-wrap items-center justify-between gap-1 text-[8px] mt-1 border-t border-slate-200/50 pt-1 pointer-events-none">
                                <span className="text-[8px] text-slate-500 line-clamp-1 flex-1">
                                  {node.micro_lesson.title}
                                </span>
                                
                                {isRootCause && (
                                  <span className="bg-red-600 text-white font-bold px-1 rounded uppercase tracking-widest text-[7px] animate-pulse">
                                    Akar Masalah
                                  </span>
                                )}
                                {isTarget && (
                                  <span className="bg-indigo-600 text-white font-bold px-1 rounded uppercase tracking-widest text-[7px]">
                                    Target
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Animation guide and flow description rules */}
                  <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold text-indigo-950">
                    <p className="leading-relaxed">
                      💡 <strong>Jalur Belajar Terbaik (Urutan Prasyarat):</strong>{" "}
                      {result.learning_path && result.learning_path.map((nid, idx) => {
                        const n = result.nodes.find(node => node.id === nid);
                        return (
                          <span key={nid} className="font-extrabold text-indigo-700">
                            {n ? n.label : nid}
                            {idx < result.learning_path.length - 1 ? " ➔ " : ""}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                </div>

                {/* ACTIVE COMPONENT: Micro-Lesson Study Portal */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5" id="study-panel">
                  
                  {/* Selected Node Header info */}
                  {activeNode ? (
                    <div className="space-y-6">
                      <div className="border-b border-slate-100 pb-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusColor(activeNode.status).badge}`}>
                            Pemahaman Siswa: {activeNode.status}
                          </span>
                          
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-semibold">Status: Hierarchy Level {activeNode.level}</span>
                            {activeNode.id === result.root_cause_node_id && (
                              <span className="bg-red-50 text-red-850 px-2 py-0.5 rounded border border-red-200 text-[9px] uppercase tracking-wider font-extrabold shadow-3xs">
                                ‼️ AKAR MASALAH (ROOT CAUSE) NYATA
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
                          <BookOpen className="w-5.5 h-5.5 text-indigo-700" />
                          Materi Pemulihan: {activeNode.label}
                        </h3>

                        {/* Evidence section */}
                        {activeNode.evidence && (
                          <div className="p-3 bg-slate-50 border-l-4 border-slate-400 rounded-r-xl text-xs leading-relaxed text-slate-600 italic font-medium">
                            <span className="font-bold text-slate-500 not-italic block uppercase text-[9px] mb-1 tracking-wide">
                              Bukti Kegagalan dari Jawaban Siswa:
                            </span>
                            &ldquo;{activeNode.evidence}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* MICRO LESSON MODULES */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 leading-relaxed" id="lesson-modules">
                        
                        {/* Interactive Lessons Texts */}
                        <div className="md:col-span-7 space-y-5 text-sm font-medium text-slate-650">
                          
                          {/* Core Explanation */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                              <Lightbulb className="w-4 h-4 text-orange-500" /> Penjelasan Konsep Inti
                            </h4>
                            <div className="bg-slate-50/55 rounded-xl p-4 border border-slate-150 leading-relaxed text-xs sm:text-sm">
                              {activeNode.micro_lesson.title && (
                                <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm border-b border-slate-150 pb-2 mb-3">
                                  {activeNode.micro_lesson.title}
                                </h5>
                              )}
                              <p className="whitespace-pre-wrap">{activeNode.micro_lesson.core_explanation}</p>
                            </div>
                          </div>

                          {/* Indonesian Cultural Analogy */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-emerald-600" /> Analogi Logika Kultural (Konteks Warung / Tradisional)
                            </h4>
                            <div className="bg-emerald-50/20 rounded-xl p-4 border border-emerald-100 text-slate-650 text-xs sm:text-sm italic leading-relaxed">
                              <p className="whitespace-pre-wrap">
                                {activeNode.micro_lesson.analogy}
                              </p>
                            </div>
                          </div>
                          
                          {/* Worked Example */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <GraduationCap className="w-4 h-4 text-indigo-700" /> Contoh Penyelesaian Bertahap (Worked Example)
                            </h4>
                            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap overflow-x-auto font-semibold">
                              {activeNode.micro_lesson.worked_example}
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: PRACTICE QUESTIONS WITH INTEGRATED REVEAL */}
                        <div className="md:col-span-5 space-y-4" id="practice-quiz-column">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-indigo-600 animate-pulse" />
                            Kuis Pemulihan Kilat (3 Soal)
                          </h4>

                          <div className="space-y-3">
                            {activeNode.micro_lesson.practice_questions && activeNode.micro_lesson.practice_questions.map((questionText, idx) => {
                              const qKey = `${activeNode.id}-q-${idx}`;
                              return (
                                <div key={idx} className="bg-slate-50/60 rounded-xl p-3.5 border border-slate-200 space-y-3 text-xs leading-relaxed">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded">
                                      Soal {idx + 1} ({idx === 0 ? "Mudah" : idx === 1 ? "Sedang" : "Tantangan"})
                                    </span>
                                  </div>
                                  
                                  <p className="text-slate-700 mt-1 font-semibold">{questionText}</p>

                                  {/* Student Workspace Input element */}
                                  <div className="space-y-2">
                                    <div className="flex gap-2">
                                      <input 
                                        type="text"
                                        placeholder="Coret jawaban Anda di sini..."
                                        value={quizAnswers[qKey] || ""}
                                        onChange={(e) => {
                                          setQuizAnswers(prev => ({ ...prev, [qKey]: e.target.value }));
                                        }}
                                        className="bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 placeholder:text-slate-400"
                                      />
                                      <button
                                        onClick={() => {
                                          setShowExplanation(prev => ({ ...prev, [qKey]: !prev[qKey] }));
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 text-[10px] font-bold rounded cursor-pointer whitespace-nowrap"
                                        id={`submit-answer-btn-${qKey}`}
                                      >
                                        {showExplanation[qKey] ? "Tutup Pembahasan" : "Cek Kunci & Solusi"}
                                      </button>
                                    </div>

                                    {/* Reveal and explanation section */}
                                    <AnimatePresence>
                                      {showExplanation[qKey] && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: "auto" }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="text-[11px] text-slate-600 bg-emerald-50 rounded p-3 text-emerald-950 border border-emerald-200 space-y-1 relative shadow-3xs"
                                        >
                                          <div className="font-extrabold text-emerald-800 flex items-center gap-1 mb-1">
                                            <Lightbulb className="w-3.5 h-3.5" /> Pembahasan Konseptual
                                          </div>
                                          <p className="text-emerald-900 font-medium leading-relaxed">
                                            Selamat mencobanya! Selalu pastikan Anda menerapkan aturan langkah demi langkah yang dijelaskan pada worked example di sebelah kiri. Tetap bersemangat!
                                          </p>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 font-bold text-xs">
                      <p>Silakan klik salah satu node prasyarat pada Graf di atas untuk membuka ulasan micro-lesson kustom siswa.</p>
                    </div>
                  )}
                </div>

                {/* BOTTOM: Motivational message & Teacher Insight */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="teacher-motivate-deck">
                  
                  {/* Student Motivational message block */}
                  <div className="bg-white border border-slate-200 border-l-4 border-l-indigo-600 p-5 rounded-r-xl space-y-2 relative shadow-xs">
                    <div className="absolute right-3 top-3"><Sparkles className="w-8 h-8 text-indigo-500/10" /></div>
                    <h4 className="font-extrabold text-indigo-950 text-xs sm:text-sm flex items-center gap-2">
                       💌 Pesan Motivasi Pemulihan Siswa
                    </h4>
                    <p className="text-indigo-800 text-xs sm:text-sm leading-relaxed italic font-semibold">
                      &ldquo;{result.summary.motivational_message}&rdquo;
                    </p>
                  </div>

                  {/* Teacher pedagogical insight block */}
                  <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 p-5 rounded-r-xl space-y-2 relative shadow-xs">
                    <div className="absolute right-3 top-3"><Users className="w-8 h-8 text-emerald-500/10" /></div>
                    <h4 className="font-extrabold text-emerald-950 text-xs sm:text-sm flex items-center gap-2">
                       🍎 Teacher Insight & Pedagogical Directive
                    </h4>
                    <p className="text-slate-650 text-xs leading-relaxed font-semibold">
                      {result.summary.teacher_insight}
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* Empty Context display illustration */}
            {!result && !loading && (
              <div className="rounded-2xl border border-slate-200 bg-white min-h-[480px] p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-sm" id="empty-workspace">
                <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-3xs">
                  <Brain className="w-8 h-8 animate-pulse" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-slate-800 font-extrabold text-base sm:text-lg">Workspace Analisis Masih Kosong</h4>
                  <p className="text-slate-450 text-xs leading-relaxed font-semibold">
                    Silakan muat salah satu **Kamus Demo** di atas atau isi data lembar ujian siswa secara manual, lalu klik tombol **Mulai Analisis Kognitif** untuk memetakan kesenjangan belajarnya.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Footer styled minimally */}
      <footer className="border-t border-slate-100 bg-white py-8 mt-16 text-center text-xs text-slate-400 font-medium space-y-1.5" id="petakonsep-footer">
        <p className="font-bold text-slate-500">PetaKonsep AI — BWAI x JVC Hackathon</p>
        <p className="text-[10px] text-slate-400 font-bold">Mengubah Kegagalan Menjadi Peta Jalan Pengetahuan Terbaik.</p>
      </footer>

      {/* Styled inline for connection dash animation fallback triggers */}
      <style jsx global>{`
        @keyframes flowDashes {
          to {
            stroke-dashoffset: -100;
          }
        }
      `}</style>

    </div>
  );
}
