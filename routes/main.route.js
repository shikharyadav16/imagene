import express from 'express';
import handleGenerateImage from '../controllers/main.controller.js';

const router = express.Router();

router.post("/generate", handleGenerateImage);

export default router;