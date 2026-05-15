const { OpenAI } = require('openai');
const { logCost } = require('../middleware/costTracker');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeBuffer(audioBuffer, filename = 'audio.webm') {
  const tmpPath = path.join('/tmp', `stt_${Date.now()}_${filename}`);
  fs.writeFileSync(tmpPath, audioBuffer);

  try {
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1',
      language: 'pl',
      response_format: 'json',
    });

    // Estimate duration for cost: ~$0.006/minute, assume 1 min average
    const costUsd = 0.006;
    await logCost({ service: 'stt', operation: 'transcribe', costUsd });

    return { transcript: response.text, costUsd };
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

module.exports = { transcribeBuffer };
