// ... existing imports ...
const axios = require("axios");

const OLLAMA_API_URL = "http://localhost:11434/api";

// Check if Ollama is available
async function isOllamaAvailable() {
  console.log("[DEBUG] Checking if Ollama is available...");
  try {
    const response = await axios.get(`${OLLAMA_API_URL}/tags`);
    console.log(
      "[DEBUG] Ollama API response:",
      JSON.stringify(response.data, null, 2)
    );

    const isAvailable =
      response.data.models &&
      response.data.models.some((model) => model.name === "gemma2");

    console.log(
      `[MODEL CHECK] Ollama Gemma2 available: ${isAvailable ? "YES" : "NO"}`
    );
    return isAvailable;
  } catch (error) {
    console.error("[MODEL CHECK] Error checking Ollama:", error.message);
    return false;
  }
}

// Generate response using Ollama
async function generateOllamaResponse(prompt) {
  console.log("[MODEL SELECTION] Using LOCAL Gemma2 model via Ollama");
  console.log("[DEBUG] Prompt being sent to Ollama:", prompt);
  console.time("[PERFORMANCE] Gemma2 response time");
  try {
    const response = await axios.post(`${OLLAMA_API_URL}/generate`, {
      model: "gemma2",
      prompt: prompt,
      stream: false,
    });
    console.timeEnd("[PERFORMANCE] Gemma2 response time");
    console.log("[DEBUG] Received response from Ollama");
    return response.data.response;
  } catch (error) {
    console.error("[MODEL ERROR] Error with Ollama:", error.message);
    throw error;
  }
}

// Socket handler with Ollama integration
module.exports = function (io) {
  io.on("connection", (socket) => {
    console.log("Client connected");

    // In your socket handler
    socket.on("voiceData", async (data) => {
      console.log("[DEBUG] Received voice data from client");
      try {
        // Process audio with Whisper (keep this as is)
        console.log("[SPEECH] Processing audio with Whisper STT model");

        // After getting transcription, use Ollama if available
        const transcription = "..."; // From your whisper processing
        console.log("[DEBUG] Transcription:", transcription);

        let responseText;
        console.log("[DEBUG] About to check Ollama availability");
        const ollamaAvailable = await isOllamaAvailable();
        console.log("[DEBUG] Ollama available:", ollamaAvailable);

        if (ollamaAvailable) {
          // Use local Ollama model
          console.log("[DEBUG] Using Ollama for response generation");
          responseText = await generateOllamaResponse(transcription);
        } else {
          // Fallback to your existing cloud model
          console.log(
            "[DEBUG] Ollama not available, falling back to cloud models"
          );

          // Since we don't know which cloud model you're using by default,
          // I'll set up a simple flag for demonstration
          const useGPT = true; // Set this based on your preference or configuration

          if (useGPT) {
            console.log("[MODEL SELECTION] Using CLOUD OpenAI ChatGPT model");
            console.time("[PERFORMANCE] ChatGPT response time");
            // ChatGPT code here
            // responseText = await callChatGPT(transcription);
            console.timeEnd("[PERFORMANCE] ChatGPT response time");
          } else {
            console.log("[MODEL SELECTION] Using CLOUD Google Gemini model");
            console.time("[PERFORMANCE] Gemini response time");
            // Gemini code here
            // responseText = await callGemini(transcription);
            console.timeEnd("[PERFORMANCE] Gemini response time");
          }
        }

        // Generate TTS using only Google TTS
        console.log("[SPEECH] Generating audio with Google TTS model");
        let audioBuffer;

        try {
          audioBuffer = await synthesizeSpeech(responseText);
        } catch (ttsError) {
          console.error("[ERROR] TTS generation failed:", ttsError);
          // Send response without audio
          socket.emit("response", {
            text: responseText,
            error: "Audio generation failed",
          });
          return;
        }

        // Send response back to client
        socket.emit("response", {
          text: responseText,
          audio: audioBuffer,
        });

        console.log("[COMPLETE] Response sent to client");
      } catch (error) {
        console.error("[ERROR] Error processing voice data:", error.message);
        socket.emit("error", error.message);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });
};
