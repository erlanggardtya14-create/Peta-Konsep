import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

type NodeStatus = "failed" | "weak" | "mastered" | "unknown";
type AnalysisConfidence = "high" | "medium" | "low";

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

const ALLOWED_MODELS = new Set(["gemini-2.5-pro", "gemini-2.5-flash"]);

const MICRO_LESSON_SCHEMA = {
  type: Type.OBJECT,
  required: ["title", "core_explanation", "analogy", "worked_example", "practice_questions"],
  propertyOrdering: ["title", "core_explanation", "analogy", "worked_example", "practice_questions"],
  properties: {
    title: { type: Type.STRING },
    core_explanation: { type: Type.STRING },
    analogy: { type: Type.STRING },
    worked_example: { type: Type.STRING },
    practice_questions: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "3",
      items: { type: Type.STRING },
    },
  },
};

const NODE_SCHEMA = {
  type: Type.OBJECT,
  required: ["id", "label", "status", "level", "evidence", "micro_lesson"],
  propertyOrdering: ["id", "label", "status", "level", "evidence", "micro_lesson"],
  properties: {
    id: { type: Type.STRING },
    label: { type: Type.STRING },
    status: { type: Type.STRING, format: "enum", enum: ["failed", "weak", "mastered", "unknown"] },
    level: { type: Type.INTEGER, minimum: 0, maximum: 6 },
    evidence: { type: Type.STRING },
    micro_lesson: MICRO_LESSON_SCHEMA,
  },
};

const RESULT_SCHEMA = {
  type: Type.OBJECT,
  required: ["meta", "diagnosis", "nodes", "edges", "root_cause_node_id", "learning_path", "summary"],
  propertyOrdering: ["meta", "diagnosis", "nodes", "edges", "root_cause_node_id", "learning_path", "summary"],
  properties: {
    meta: {
      type: Type.OBJECT,
      required: ["subject", "grade", "target_concept", "analysis_confidence"],
      propertyOrdering: ["subject", "grade", "target_concept", "analysis_confidence"],
      properties: {
        subject: { type: Type.STRING },
        grade: { type: Type.STRING },
        target_concept: { type: Type.STRING },
        analysis_confidence: { type: Type.STRING, format: "enum", enum: ["high", "medium", "low"] },
      },
    },
    diagnosis: {
      type: Type.OBJECT,
      required: ["surface_error", "root_cause_summary", "what_student_thinks", "what_is_actually_correct"],
      propertyOrdering: ["surface_error", "root_cause_summary", "what_student_thinks", "what_is_actually_correct"],
      properties: {
        surface_error: { type: Type.STRING },
        root_cause_summary: { type: Type.STRING },
        what_student_thinks: { type: Type.STRING },
        what_is_actually_correct: { type: Type.STRING },
      },
    },
    nodes: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "7",
      items: NODE_SCHEMA,
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["source", "target"],
        propertyOrdering: ["source", "target"],
        properties: {
          source: { type: Type.STRING },
          target: { type: Type.STRING },
        },
      },
    },
    root_cause_node_id: { type: Type.STRING },
    learning_path: {
      type: Type.ARRAY,
      minItems: "2",
      items: { type: Type.STRING },
    },
    summary: {
      type: Type.OBJECT,
      required: ["estimated_recovery_minutes", "motivational_message", "teacher_insight"],
      propertyOrdering: ["estimated_recovery_minutes", "motivational_message", "teacher_insight"],
      properties: {
        estimated_recovery_minutes: { type: Type.INTEGER, minimum: 5, maximum: 180 },
        motivational_message: { type: Type.STRING },
        teacher_insight: { type: Type.STRING },
      },
    },
  },
};

const SYSTEM_PROMPT = `
You are PETAKONSEP AI, a cognitive diagnostic engine for learning gaps.
Your job is to analyze a student's wrong answer, trace prerequisite concepts backward, and output a single valid JSON object.

Do not act as a conversational tutor. Do not add markdown. Do not add text outside JSON.

Method:
1. Surface read: identify what the student did, what was correct, and where the procedure diverged.
2. Target concept: make the directly tested concept the single level-0 node.
3. Prerequisite tracing: recursively ask "To make this mistake, what prerequisite concept is missing?" Minimum 3 nodes, maximum 7 nodes, maximum depth 6.
4. Evidence-based status: every node must include evidence from the student's answer or objective absence of evidence. Status is one of failed, weak, mastered, unknown.
5. Root cause: choose the deepest failed or weak node with strongest evidence.

Status rules:
- failed: explicit evidence of not understanding a concept.
- weak: partial understanding with significant gap.
- mastered: no evidence of weakness.
- unknown: insufficient evidence.
- level-0 must be failed or weak.
- do not mark a direct prerequisite of a failed node as mastered without strong evidence.

Graph rules:
- level 0 is the target concept.
- level 1 is direct prerequisite of level 0.
- deeper levels are more foundational.
- edge direction must be prerequisite to dependent concept.
- node IDs must be node_0, node_1, node_2, and so on.
- node_0 must be level 0.
- learning_path must start with root_cause_node_id and end at the target concept.

Micro-lesson rules:
- Use friendly Bahasa Indonesia.
- Match the student's grade level.
- analogy must use Indonesian daily context, such as warung, pasar, angkot, game, or school life.
- worked_example must show steps.
- practice_questions must contain exactly 3 items from easy to hard.
- Avoid unexplained academic jargon.

The API provides a response schema. Follow it exactly and fill every required field.

If the student's answer is empty or means "tidak tahu", set analysis_confidence to "low" and set non-level-0 nodes to "unknown" unless there is explicit evidence.
`.trim();

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini mengembalikan respons yang bukan JSON.");
  }

  return cleaned.slice(start, end + 1);
}

function normalizeResult(value: unknown): PetaKonsepResult {
  const data = value as Partial<PetaKonsepResult>;

  if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
    throw new Error("JSON Gemini tidak berisi daftar node diagnosis.");
  }

  const nodes = data.nodes.map((node, index) => {
    const practice = node.micro_lesson?.practice_questions || [];
    const questions = [practice[0] || "Coba ulangi konsep ini dengan contoh sederhana.", practice[1] || "Kerjakan satu soal serupa.", practice[2] || "Buat satu soal sendiri dan selesaikan."] as [
      string,
      string,
      string,
    ];

    return {
      id: node.id || `node_${index}`,
      label: node.label || `Konsep ${index + 1}`,
      status: node.status || "unknown",
      level: typeof node.level === "number" ? node.level : index === 0 ? 0 : 1,
      evidence: node.evidence || "Belum ada evidence eksplisit dari respons model.",
      micro_lesson: {
        title: node.micro_lesson?.title || "Micro-lesson pemulihan",
        core_explanation: node.micro_lesson?.core_explanation || "Pelajari ulang konsep ini secara bertahap.",
        analogy: node.micro_lesson?.analogy || "Bayangkan seperti mengecek daftar belanja di warung: setiap langkah perlu sesuai urutan.",
        worked_example: node.micro_lesson?.worked_example || "Langkah 1: tulis informasi yang diketahui.\nLangkah 2: pilih aturan yang sesuai.\nLangkah 3: cek kembali jawaban.",
        practice_questions: questions,
      },
    };
  });

  const rootCause = data.root_cause_node_id && nodes.some((node) => node.id === data.root_cause_node_id) ? data.root_cause_node_id : nodes[nodes.length - 1].id;
  const path = Array.isArray(data.learning_path) && data.learning_path.length > 0 ? data.learning_path.filter((id) => nodes.some((node) => node.id === id)) : [rootCause, nodes[0].id];

  return {
    meta: {
      subject: data.meta?.subject || "Deteksi otomatis",
      grade: data.meta?.grade || "Deteksi otomatis",
      target_concept: data.meta?.target_concept || nodes.find((node) => node.level === 0)?.label || nodes[0].label,
      analysis_confidence: data.meta?.analysis_confidence || "medium",
    },
    diagnosis: {
      surface_error: data.diagnosis?.surface_error || "Kesalahan permukaan belum dijelaskan oleh model.",
      root_cause_summary: data.diagnosis?.root_cause_summary || "Akar masalah perlu ditinjau ulang.",
      what_student_thinks: data.diagnosis?.what_student_thinks || "Belum terdeteksi jelas.",
      what_is_actually_correct: data.diagnosis?.what_is_actually_correct || "Gunakan konsep target yang benar untuk menyelesaikan soal.",
    },
    nodes,
    edges: Array.isArray(data.edges) ? data.edges : [],
    root_cause_node_id: rootCause,
    learning_path: path[0] === rootCause ? path : [rootCause, ...path.filter((id) => id !== rootCause)],
    summary: {
      estimated_recovery_minutes: data.summary?.estimated_recovery_minutes || 30,
      motivational_message: data.summary?.motivational_message || "Kesalahan ini bisa dipulihkan dengan latihan singkat dan bertahap.",
      teacher_insight: data.summary?.teacher_insight || "Gunakan node akar sebagai titik mulai remedial.",
    },
  };
}

function isRecoverableModelError(error: Error) {
  const message = error.message.toLowerCase();
  return (
    message.includes("503") ||
    message.includes("429") ||
    message.includes("unavailable") ||
    message.includes("resource_exhausted") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("json") ||
    message.includes("parse") ||
    message.includes("expected ','")
  );
}

function createFallbackResult(input: {
  subject: string;
  grade: string;
  topic: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  additionalContext: string;
}): PetaKonsepResult {
  const answer = input.studentAnswer || "(kosong/tidak menjawab)";
  const target = input.topic === "Deteksi otomatis" ? "Konsep yang diuji pada soal" : input.topic;

  return {
    meta: {
      subject: input.subject,
      grade: input.grade,
      target_concept: target,
      analysis_confidence: "low",
    },
    diagnosis: {
      surface_error: `Siswa menjawab: "${answer}". Sistem fallback belum bisa menelusuri detail sedalam Gemini, tetapi jawaban ini belum sesuai dengan jawaban benar.`,
      root_cause_summary: "Kemungkinan akar masalah ada pada pemilihan prosedur awal dan pengecekan kembali jawaban.",
      what_student_thinks: "Siswa kemungkinan memilih langkah yang terasa paling langsung dari angka atau informasi yang terlihat di soal.",
      what_is_actually_correct: input.correctAnswer
        ? `Jawaban benar yang perlu dicapai adalah: ${input.correctAnswer}. Guru dapat meminta siswa mengecek langkah dengan substitusi atau pembuktian balik.`
        : "Siswa perlu menentukan aturan konsep yang sesuai, menyelesaikan langkahnya, lalu mengecek kembali hasilnya.",
    },
    nodes: [
      {
        id: "node_0",
        label: target,
        status: "weak",
        level: 0,
        evidence: `Jawaban siswa "${answer}" belum cocok dengan tuntutan soal: "${input.question}".`,
        micro_lesson: {
          title: `Memulihkan konsep ${target}`,
          core_explanation:
            "Mulai dari membaca apa yang ditanya, tulis informasi penting, pilih aturan yang sesuai, lalu cek apakah jawaban akhir masuk akal. Jangan hanya mengambil angka yang paling terlihat di soal.",
          analogy:
            "Seperti belanja di warung, kita tidak cukup melihat harga satu barang. Kita perlu tahu barang apa yang diminta, berapa jumlahnya, lalu menghitung sesuai aturan belanja.",
          worked_example:
            "Langkah 1: Tulis apa yang diketahui dari soal.\nLangkah 2: Tulis apa yang ditanya.\nLangkah 3: Pilih aturan atau rumus yang cocok.\nLangkah 4: Kerjakan perlahan.\nLangkah 5: Masukkan kembali jawaban untuk mengecek.",
          practice_questions: [
            "Tulis ulang informasi penting dari soal dengan kata-katamu sendiri.",
            "Sebutkan aturan atau rumus yang paling cocok untuk soal ini, lalu jelaskan alasannya.",
            "Kerjakan ulang soal, lalu cek jawabanmu dengan cara pembuktian balik.",
          ],
        },
      },
      {
        id: "node_1",
        label: "Memilih prosedur penyelesaian yang sesuai",
        status: "weak",
        level: 1,
        evidence: `Jawaban siswa "${answer}" menunjukkan prosedur yang dipakai belum menghasilkan jawaban benar.`,
        micro_lesson: {
          title: "Memilih langkah sebelum menghitung",
          core_explanation:
            "Sebelum menghitung, tentukan dulu jenis masalahnya. Tanya: apakah soal meminta mencari nilai, membandingkan, mengalikan, menjelaskan ide pokok, atau membuktikan sesuatu?",
          analogy:
            "Seperti memilih kendaraan: kalau jaraknya dekat bisa jalan kaki, kalau jauh perlu angkot. Cara yang dipilih harus cocok dengan tujuan.",
          worked_example:
            "Langkah 1: Lingkari kata kunci pada soal.\nLangkah 2: Cocokkan kata kunci dengan aturan yang dipelajari.\nLangkah 3: Baru lakukan perhitungan atau penalaran.",
          practice_questions: [
            "Apa kata kunci utama pada soal ini?",
            "Langkah apa yang seharusnya dilakukan pertama kali?",
            "Buat satu alasan mengapa langkah siswa belum tepat.",
          ],
        },
      },
      {
        id: "node_2",
        label: "Mengecek jawaban dengan bukti balik",
        status: input.studentAnswer ? "failed" : "unknown",
        level: 2,
        evidence: input.studentAnswer
          ? `Tidak terlihat proses pengecekan dari jawaban siswa "${answer}".`
          : "Jawaban kosong membuat proses berpikir siswa belum dapat dinilai.",
        micro_lesson: {
          title: "Cek jawaban sebelum dikumpulkan",
          core_explanation:
            "Setelah mendapat jawaban, masukkan kembali jawaban itu ke soal atau bandingkan dengan syarat soal. Kalau tidak memenuhi syarat, berarti perlu perbaikan.",
          analogy:
            "Seperti mencoba kunci pada gembok. Kunci baru dianggap benar kalau benar-benar bisa membuka gemboknya.",
          worked_example:
            "Langkah 1: Ambil jawaban akhir.\nLangkah 2: Masukkan kembali ke kondisi soal.\nLangkah 3: Jika hasilnya cocok, jawaban kuat. Jika tidak cocok, ulangi dari langkah sebelumnya.",
          practice_questions: [
            "Tuliskan satu cara mengecek jawabanmu.",
            "Coba cek jawaban siswa pada soal ini. Apa yang tidak cocok?",
            "Perbaiki jawaban lalu buktikan dengan cek balik.",
          ],
        },
      },
    ],
    edges: [
      { source: "node_2", target: "node_1" },
      { source: "node_1", target: "node_0" },
    ],
    root_cause_node_id: "node_2",
    learning_path: ["node_2", "node_1", "node_0"],
    summary: {
      estimated_recovery_minutes: 25,
      motivational_message:
        "Ini masih bisa diperbaiki. Mulai dari langkah kecil: pahami pertanyaan, pilih cara yang cocok, lalu cek ulang jawaban.",
      teacher_insight: `Mode fallback rule-based aktif karena layanan Gemini sedang tidak stabil. Gunakan hasil ini sebagai peta awal, lalu jalankan ulang analisis saat model tersedia. Konteks tambahan: ${input.additionalContext || "-"}`,
    },
  };
}

async function requestGeminiDiagnostic(ai: GoogleGenAI, modelName: string, userPrompt: string) {
  let lastParseError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await ai.models.generateContent({
      model: modelName,
      contents:
        attempt === 0
          ? userPrompt
          : `${userPrompt}\n\nVALIDATION RETRY: Previous output could not be parsed as JSON. Return compact, valid JSON only. Do not include trailing commas, comments, markdown, or text outside the object.`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: attempt === 0 ? 0.2 : 0.1,
        topP: 0.8,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: RESULT_SCHEMA,
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Gemini tidak mengembalikan konten.");
    }

    try {
      const parsed = JSON.parse(extractJson(textOutput));
      return normalizeResult(parsed);
    } catch (parseError: unknown) {
      lastParseError = parseError instanceof Error ? parseError : new Error(String(parseError));
    }
  }

  throw lastParseError || new Error("JSON Gemini tidak valid.");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const subject = asText(body.subject) || "Deteksi otomatis";
    const grade = asText(body.grade) || "Deteksi otomatis";
    const topic = asText(body.topic) || "Deteksi otomatis";
    const question = asText(body.question);
    const studentAnswer = asText(body.studentAnswer);
    const correctAnswer = asText(body.correctAnswer);
    const additionalContext = asText(body.additionalContext);
    const requestedModel = asText(body.modelName);
    const modelName = ALLOWED_MODELS.has(requestedModel) ? requestedModel : "gemini-2.5-pro";

    if (!question) {
      return NextResponse.json({ error: "Soal wajib diisi." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY belum dikonfigurasi.",
          details: "Tambahkan GEMINI_API_KEY ke .env.local lalu jalankan ulang server.",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const userPrompt = `
MATA PELAJARAN: ${subject}
KELAS: ${grade}
TOPIK YANG SEDANG DIPELAJARI: ${topic}

SOAL:
${question}

JAWABAN SISWA:
${studentAnswer || "(kosong/tidak menjawab)"}

JAWABAN BENAR:
${correctAnswer || "Tentukan dari soal"}

INFORMASI TAMBAHAN:
${additionalContext || "-"}
`.trim();

    const candidateModels = Array.from(
      new Set([modelName, modelName === "gemini-2.5-pro" ? "gemini-2.5-flash" : "gemini-2.5-pro"])
    );
    let lastModelError: Error | null = null;

    for (const candidateModel of candidateModels) {
      try {
        const diagnostic = await requestGeminiDiagnostic(ai, candidateModel, userPrompt);
        return NextResponse.json(diagnostic);
      } catch (modelError: unknown) {
        lastModelError = modelError instanceof Error ? modelError : new Error(String(modelError));
        console.warn(`PetaKonsep model attempt failed (${candidateModel}):`, lastModelError.message);
      }
    }

    if (lastModelError && isRecoverableModelError(lastModelError)) {
      return NextResponse.json(
        createFallbackResult({
          subject,
          grade,
          topic,
          question,
          studentAnswer,
          correctAnswer,
          additionalContext,
        }),
        { headers: { "x-petakonsep-fallback": "rule-based" } }
      );
    }

    throw lastModelError || new Error("Analisis Gemini gagal.");
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("PetaKonsep analysis error:", details);

    return NextResponse.json(
      {
        error: "Gagal memproses analisis diagnostik.",
        details,
      },
      { status: 500 }
    );
  }
}
