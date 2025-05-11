const express = require('express');
const router = express.Router();
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

router.post('/', async (req, res) => {
  try {
    const {
      name,
      currentGrade,
      subjects,
      strengths,
      weaknesses,
      remainingModules
    } = req.body;

    // Create a prompt for the AI
    const prompt = `Create a detailed study roadmap for a student with the following information:
    Name: ${name}
    Current Grade/Year: ${currentGrade}
    Subjects: ${subjects.join(', ')}
    Strengths: ${strengths.join(', ')}
    Weaknesses: ${weaknesses.join(', ')}
    Remaining Modules: ${remainingModules.join(', ')}

    Please provide:
    1. A week-by-week timeline for completing the remaining modules
    2. Specific recommendations based on the student's strengths and weaknesses
    3. Module dependencies and prerequisites
    4. Learning resources and study tips for each module
    5. Progress tracking milestones

    Format the response as a JSON object with the following structure:
    {
      "timeline": [
        {
          "week": "Week 1",
          "subject": "Subject Name",
          "description": "What to study",
          "resources": ["Resource 1", "Resource 2"]
        }
      ],
      "recommendations": [
        {
          "title": "Recommendation Title",
          "description": "Detailed description",
          "tips": ["Tip 1", "Tip 2"]
        }
      ],
      "moduleDependencies": [
        {
          "module": "Module Name",
          "dependsOn": ["Prerequisite 1", "Prerequisite 2"]
        }
      ],
      "progressData": {
        "Subject1": [0, 20, 40, 60, 80, 100],
        "Subject2": [0, 15, 35, 55, 75, 95]
      }
    }`;

    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert educational consultant specializing in creating personalized study roadmaps. Your responses should be detailed, practical, and focused on helping students achieve their academic goals."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const response = completion.data.choices[0].message.content;
    const roadmapData = JSON.parse(response);

    res.json(roadmapData);
  } catch (error) {
    console.error('Error generating roadmap:', error);
    res.status(500).json({ error: 'Failed to generate roadmap' });
  }
});

module.exports = router; 