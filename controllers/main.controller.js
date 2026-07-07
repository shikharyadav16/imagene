import generateCraiyonImage from '../services/generate.js';

async function handleGenerateImage(req, res) {
  const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

    try {
    const imageUrl = await generateCraiyonImage(prompt.trim());
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
}

export default handleGenerateImage;