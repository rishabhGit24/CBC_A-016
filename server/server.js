require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const OpenAI = require("openai");
const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const execAsync = promisify(exec);
const os = require("os");
const multer = require("multer");
const pdf = require("pdf-parse");
const ollamaRoutes = require("./routes/ollamaRoutes");

// Initialize Express and Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// Initialize OpenAI with a longer timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 5,
  timeout: 30000,
});

// Initialize Google Cloud Text-to-Speech
let ttsClient;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    ttsClient = new textToSpeech.TextToSpeechClient();
    console.log("Google TTS initialized with JSON key file");
  } else {
    ttsClient = new textToSpeech.TextToSpeechClient({
      projectId: "campuspal-ai",
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
    });
    console.log("Google TTS initialized with credentials object");
  }
} catch (error) {
  console.error("Error initializing Google Cloud TTS:", error);
  ttsClient = null;
}

// Initialize multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(os.tmpdir(), "campus-pal-pdfs");
    if (!fsSync.existsSync(uploadDir)) {
      fsSync.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `pdf-${Date.now()}.pdf`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
  })
);
app.use(express.json({ limit: "50mb" }));

// Create temp directory
const tempDir = path.join(os.tmpdir(), "campus-pal-temp");
if (!fsSync.existsSync(tempDir)) {
  fsSync.mkdirSync(tempDir, { recursive: true });
}

// Caches with LRU eviction
const ttsCache = new Map();
const gptCache = new Map();
const CACHE_LIMIT = 100;

// PDF storage per session
const pdfStore = new Map(); // Maps session IDs to PDF content

// Function to validate audio file
const validateAudioFile = async (filePath) => {
  if (!fsSync.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }
  const stats = fsSync.statSync(filePath);
  if (stats.size === 0) {
    throw new Error(`Audio file is empty: ${filePath}`);
  }
};

// Reusable function to transcribe audio
async function transcribeAudio(audioData, fileExtension = "webm") {
  const tempFilePath = path.join(
    os.tmpdir(),
    `audio-${Date.now()}.${fileExtension}`
  );
  const outputPath = path.join(os.tmpdir(), `audio-${Date.now()}.mp3`);

  try {
    if (!audioData.includes("base64,")) {
      throw new Error("Invalid audio data format");
    }
    const base64Data = audioData.split(",")[1];
    if (!base64Data) {
      throw new Error("Base64 audio data is empty");
    }
    const audioBuffer = Buffer.from(base64Data, "base64");
    await fs.writeFile(tempFilePath, audioBuffer);

    const { stderr } = await execAsync(
      `ffmpeg -i "${tempFilePath}" -ar 16000 -ac 1 -c:a libmp3lame "${outputPath}"`
    );
    if (stderr) {
      console.warn("ffmpeg warning:", stderr);
    }

    await validateAudioFile(outputPath);

    const transcription = await openai.audio.transcriptions.create({
      file: fsSync.createReadStream(outputPath),
      model: "whisper-1",
      language: "en",
      response_format: "text",
      temperature: 0.1,
    });

    return transcription;
  } catch (error) {
    console.error("ffmpeg error:", error);
    throw new Error("Failed to convert audio");
  } finally {
    await Promise.all([
      fs
        .unlink(tempFilePath)
        .catch((err) => console.error("Error deleting temp file:", err)),
      fs
        .unlink(outputPath)
        .catch((err) => console.error("Error deleting output file:", err)),
    ]);
  }
}

// Synthesize speech using Google TTS with OpenAI fallback
async function synthesizeSpeech(text) {
  const ttsCacheKey = text.substring(0, 50);
  if (ttsCache.has(ttsCacheKey)) {
    return ttsCache.get(ttsCacheKey);
  }

  let audioContent;
  try {
    if (ttsClient) {
      console.log("Using Google TTS for synthesis");
      const request = {
        input: { text },
        voice: {
          languageCode: "en-US",
          ssmlGender: "NEUTRAL",
        },
        audioConfig: { audioEncoding: "MP3" },
      };
      const [response] = await ttsClient.synthesizeSpeech(request);
      audioContent = response.audioContent;
      console.log(
        "Google TTS synthesis successful, audio content length:",
        audioContent.length
      );
    } else {
      throw new Error("Google TTS client not available");
    }
  } catch (error) {
    console.error(
      "Google TTS failed, falling back to OpenAI TTS:",
      error.message
    );
    audioContent = await synthesizeSpeechFallback(text);
  }

  if (audioContent && audioContent.length > 0) {
    ttsCache.set(ttsCacheKey, audioContent);
    if (ttsCache.size > CACHE_LIMIT) {
      ttsCache.delete(ttsCache.keys().next().value);
    }
  }
  return audioContent || Buffer.from([]);
}

// Fallback TTS using OpenAI
async function synthesizeSpeechFallback(text) {
  try {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text,
      speed: 0.95,
      response_format: "mp3",
    });
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error("Error with OpenAI TTS:", error);
    throw new Error("Failed to generate speech with OpenAI TTS");
  }
}

// Process queries with PDF context
async function processQueryWithPDFs(query, sessionId) {
  try {
    let pdfContext = "";
    const sessionPDFs = pdfStore.get(sessionId);
    if (sessionPDFs && sessionPDFs.length > 0) {
      pdfContext = sessionPDFs.map((pdf) => pdf.content).join("\n\n");
    }

    const systemPrompt = `You are Campus Pal, an AI assistant for analyzing academic PDFs. Provide accurate, concise answers based solely on the provided PDF content. If the information is not in the PDF, say so. Use clear, college-level language.`;
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `PDF Content:\n${pdfContext}\n\nQuestion: ${query}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.2,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error generating response:", error);
    throw new Error("Error processing your request: " + error.message);
  }
}

// PDF upload endpoint
app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const pdfData = await pdf(await fs.readFile(req.file.path));
    const pdfId = path.basename(req.file.path);
    const sessionId = req.headers["x-session-id"] || "default-session";

    const pdfEntry = {
      content: pdfData.text,
      filename: req.file.originalname,
      uploadTime: new Date(),
    };

    if (!pdfStore.has(sessionId)) {
      pdfStore.set(sessionId, []);
    }
    pdfStore.get(sessionId).push(pdfEntry);

    await fs.unlink(req.file.path);

    res.json({
      success: true,
      pdfId,
      filename: req.file.originalname,
      pages: pdfData.numpages,
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ error: "Error processing PDF file" });
  }
});

// Get list of uploaded PDFs
app.get("/pdfs", (req, res) => {
  const sessionId = req.headers["x-session-id"] || "default-session";
  const sessionPDFs = pdfStore.get(sessionId) || [];
  const pdfs = sessionPDFs.map((data, index) => ({
    id: index,
    filename: data.filename,
    uploadTime: data.uploadTime,
  }));
  res.json(pdfs);
});

// WebSocket handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("voiceData", async (data) => {
    try {
      const transcription = await transcribeAudio(data.audio, "webm");

      const gptCacheKey = transcription.trim().toLowerCase();
      let response =
        gptCache.get(gptCacheKey) ||
        (await processQueryWithPDFs(transcription, socket.id));
      gptCache.set(gptCacheKey, response);
      if (gptCache.size > CACHE_LIMIT) {
        gptCache.delete(gptCache.keys().next().value);
      }

      const ttsCacheKey = response.substring(0, 50);
      let audioContent =
        ttsCache.get(ttsCacheKey) || (await synthesizeSpeech(response));
      ttsCache.set(ttsCacheKey, audioContent);
      if (ttsCache.size > CACHE_LIMIT) {
        ttsCache.delete(ttsCache.keys().next().value);
      }

      socket.emit("response", { text: response, audio: audioContent });
    } catch (error) {
      console.error("Error processing voice data:", error);
      socket.emit("error", "Error processing your request: " + error.message);
    }
  });

  socket.on("processText", async (data) => {
    try {
      const { text } = data;
      if (!text) {
        socket.emit("error", "No text provided");
        return;
      }

      const gptCacheKey = text.trim().toLowerCase();
      let response =
        gptCache.get(gptCacheKey) ||
        (await processQueryWithPDFs(text, socket.id));
      gptCache.set(gptCacheKey, response);
      if (gptCache.size > CACHE_LIMIT) {
        gptCache.delete(gptCache.keys().next().value);
      }

      const ttsCacheKey = response.substring(0, 50);
      let audioContent =
        ttsCache.get(ttsCacheKey) || (await synthesizeSpeech(response));
      ttsCache.set(ttsCacheKey, audioContent);
      if (ttsCache.size > CACHE_LIMIT) {
        ttsCache.delete(ttsCache.keys().next().value);
      }

      socket.emit("response", { text: response, audio: audioContent });
    } catch (error) {
      console.error("Error processing text:", error);
      socket.emit("error", "Error processing your request: " + error.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    pdfStore.delete(socket.id);
  });
});

// Roadmap generation endpoint with adjusted validation
app.post("/api/roadmap", async (req, res) => {
  try {
    const {
      name,
      currentGrade,
      subjects,
      strengths,
      weaknesses,
      remainingModules,
    } = req.body;

    // Validate inputs
    if (
      !name ||
      !currentGrade ||
      !subjects ||
      !strengths ||
      !weaknesses ||
      !remainingModules ||
      !Array.isArray(subjects) ||
      !Array.isArray(strengths) ||
      !Array.isArray(weaknesses) ||
      !Array.isArray(remainingModules)
    ) {
      return res.status(400).json({ error: "Invalid or missing fields" });
    }

    if (
      subjects.length === 0 ||
      strengths.length === 0 ||
      weaknesses.length === 0 ||
      remainingModules.length === 0
    ) {
      return res.status(400).json({ error: "Array fields cannot be empty" });
    }

    console.log("Generating roadmap for:", { name, currentGrade, subjects });

    const prompt = `Create a study roadmap for:
    Name: ${name}
    Grade: ${currentGrade}
    Subjects: ${subjects.join(", ")}
    Strengths: ${strengths.join(", ")}
    Weaknesses: ${weaknesses.join(", ")}
    Modules: ${remainingModules.join(", ")}
    Return a JSON object with a studyRoadmap field containing timeline, recommendations, moduleDependencies, and progressData.`;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an educational consultant creating study roadmaps.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });
    } catch (apiError) {
      console.error("OpenAI API error in roadmap generation:", apiError);
      return res.status(503).json({
        error: "Failed to generate roadmap due to AI service timeout.",
        details:
          "The AI service is currently unavailable. Please try again later.",
        timeline: [],
        recommendations: [],
        moduleDependencies: [],
        progressData: {},
      });
    }

    const rawResponse = completion.choices[0].message.content;
    console.log("Raw OpenAI response:", rawResponse);

    // Attempt to clean and parse the response
    let cleanedResponse = rawResponse.replace(/```json\n?|```\n?/g, "").trim();

    let roadmapData;
    try {
      roadmapData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Error parsing OpenAI response as JSON:", parseError);
      console.error("Raw response:", cleanedResponse);
      return res.status(500).json({
        error: "Failed to parse AI response.",
        details: "The AI response was malformed. Please try again.",
        timeline: [],
        recommendations: [],
        moduleDependencies: [],
        progressData: {},
      });
    }

    // Extract studyRoadmap if it exists, otherwise use the root object
    const studyRoadmap = roadmapData.studyRoadmap || roadmapData;

    // Validate the parsed data structure (more lenient validation)
    if (!studyRoadmap) {
      console.warn("No studyRoadmap field in response:", roadmapData);
      return res.status(500).json({
        error: "Incomplete roadmap data from AI.",
        details: "The AI response was incomplete. Please try again.",
        timeline: [],
        recommendations: [],
        moduleDependencies: [],
        progressData: {},
      });
    }

    // Ensure all required fields are present, even if empty
    const responseData = {
      timeline: studyRoadmap.timeline || {},
      recommendations: studyRoadmap.recommendations || [],
      moduleDependencies: studyRoadmap.moduleDependencies || {},
      progressData: studyRoadmap.progressData || {},
    };

    res.json(responseData);
  } catch (error) {
    console.error("Error generating roadmap:", error);
    res.status(500).json({
      error: "Failed to generate roadmap",
      details: error.message,
      timeline: [],
      recommendations: [],
      moduleDependencies: [],
      progressData: {},
    });
  }
});

// Tutor mode endpoint
app.post("/api/tutor/analyze", async (req, res) => {
  try {
    const { subject, content, generateAudio } = req.body;
    if (!subject || !content) {
      return res.status(400).json({ error: "Missing subject or content" });
    }

    const MAX_CHARS = 12000;
    const truncatedContent = content.slice(0, MAX_CHARS);
    console.log(
      `Tutor Mode: Processing subject "${subject}" with content length ${truncatedContent.length}`
    );

    const prompt = `You are a tutor teaching "${subject}" from scratch using the provided content. Break down the subject into detailed, hour-wise sessions. Return a JSON object with sessions containing sessionNumber, title, objectives, keyConcepts, detailedExplanation, suggestedNotes, practiceQuestions, and resources. Content:\n${truncatedContent}`;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional tutor specializing in breaking down complex subjects into detailed, hour-wise classroom sessions.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });
    } catch (apiError) {
      console.error("OpenAI API error:", apiError);
      return res.status(503).json({
        error: "Failed to generate tutor sessions due to API timeout.",
        details:
          "The AI service is currently unavailable. Please try again later.",
        sessions: [],
      });
    }

    const cleanedResponse = completion.choices[0].message.content
      .replace(/```json\n?|```\n?/g, "")
      .trim();
    const tutorData = JSON.parse(cleanedResponse);

    if (generateAudio && tutorData.sessions?.length > 0) {
      try {
        const introText = `Welcome to your tutor session on ${subject}. Let's begin with session 1: ${tutorData.sessions[0].title}`;
        const audioContent = await synthesizeSpeech(introText);
        tutorData.introAudio = audioContent.toString("base64");
      } catch (ttsError) {
        console.error("Error generating TTS for tutor intro:", ttsError);
      }
    }

    res.json(tutorData);
  } catch (error) {
    console.error("Error in Tutor Mode:", error);
    res.status(500).json({
      error: "Failed to generate tutor sessions",
      details: error.message,
    });
  }
});

// PDF text extraction endpoint
app.post("/api/process-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }
    const data = await pdf(await fs.readFile(req.file.path));
    await fs.unlink(req.file.path);
    res.json({ text: data.text });
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    res.status(500).json({ error: "Failed to extract text from PDF" });
  }
});

// TTS API endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const ttsCacheKey = text.substring(0, 50);
    let audioContent;

    if (ttsCache.has(ttsCacheKey)) {
      audioContent = ttsCache.get(ttsCacheKey);
    } else {
      audioContent = await synthesizeSpeech(text);
    }

    if (audioContent && audioContent.length > 0) {
      const base64Audio = audioContent.toString("base64");
      res.json({ audio: base64Audio });
    } else {
      res.json({
        message: "Text-to-speech is currently unavailable",
        text: text,
      });
    }
  } catch (error) {
    console.error("TTS API error:", error);
    res.status(500).json({ error: "Failed to generate speech" });
  }
});

// Sentiment analysis endpoint
app.post("/api/analyze-sentiment", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    const sentiment = await analyzeTextSentiment(text);
    res.json({ sentiment });
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    res.status(500).json({ error: "Error analyzing sentiment" });
  }
});

async function analyzeTextSentiment(text) {
  const positiveWords = ["happy", "good", "great", "excellent", "wonderful"];
  const negativeWords = ["sad", "bad", "terrible", "awful", "horrible"];
  const words = text.toLowerCase().split(/\s+/);
  const positiveCount = words.filter((word) =>
    positiveWords.includes(word)
  ).length;
  const negativeCount = words.filter((word) =>
    negativeWords.includes(word)
  ).length;

  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

// Audio transcription endpoint
app.post("/api/transcribe", async (req, res) => {
  try {
    const { audio } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "No audio data provided" });
    }

    const transcription = await transcribeAudio(audio, "webm");
    res.json({ text: transcription });
  } catch (error) {
    console.error("Error in transcribe endpoint:", error);
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

// Ollama routes
app.use("/api/ollama", ollamaRoutes);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
