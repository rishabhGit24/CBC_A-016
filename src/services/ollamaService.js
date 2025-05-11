// Ollama service for local LLM inference
const OLLAMA_API_URL = 'http://localhost:11434/api';

export const generateOllamaResponse = async (prompt, model = 'gemma2') => {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error calling Ollama:', error);
    throw error;
  }
};

export const isOllamaAvailable = async () => {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/tags`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    // Check if gemma2 model is available
    return data.models && data.models.some(model => model.name === 'gemma2');
  } catch (error) {
    console.error('Error checking Ollama availability:', error);
    return false;
  }
};