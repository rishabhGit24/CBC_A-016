const express = require('express');
const router = express.Router();
const axios = require('axios');

const OLLAMA_API_URL = 'http://localhost:11434/api';

// Check if Ollama is available
router.get('/status', async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_API_URL}/tags`);
    const hasGemma2 = response.data.models && 
                      response.data.models.some(model => model.name === 'gemma2');
    
    res.json({ 
      available: true, 
      hasGemma2: hasGemma2 
    });
  } catch (error) {
    console.error('Error checking Ollama status:', error);
    res.json({ available: false, error: error.message });
  }
});

// Generate response using Ollama
router.post('/generate', async (req, res) => {
  try {
    const { prompt, model = 'gemma2' } = req.body;
    
    const response = await axios.post(`${OLLAMA_API_URL}/generate`, {
      model: model,
      prompt: prompt,
      stream: false,
    });
    
    res.json({ 
      success: true, 
      text: response.data.response 
    });
  } catch (error) {
    console.error('Error generating with Ollama:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;