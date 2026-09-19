const express = require('express');
const router = express.Router();
const multer = require('multer');
const voiceBookingService = require('../services/voiceBookingService');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Configure multer memory storage for audio file uploads (WAV, WebM, MP4, AAC, OGG)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

/**
 * @route   POST /api/voice-booking/start
 * @desc    Initialize a conversational voice session with AI greeting
 * @access  Public (Farmer)
 */
router.post('/start', async (req, res) => {
  try {
    const { farmerId, phone, farmerName, language = 'mr' } = req.body;

    const sessionData = await voiceBookingService.startSession({
      farmerId: farmerId || req.user?.id,
      phone: phone || req.user?.phone,
      farmerName: farmerName || req.user?.name,
      language
    });

    logger.info(`[VoiceBooking] Started conversational session ${sessionData.sessionId} in language '${language}'`);

    return res.status(200).json({
      success: true,
      question: sessionData.initialGreeting,
      questionText: sessionData.initialGreeting,
      ...sessionData
    });
  } catch (error) {
    logger.error(`[VoiceBooking] Start session error: ${error.message}`);
    return errorResponse(res, error.message, 500);
  }
});

/**
 * Handler for conversational message or answer submission
 */
const handleConversationalAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { textAnswer, mimeType: bodyMimeType, audioBase64, language } = req.body;

    let audioBuffer = null;
    let mimeType = bodyMimeType || 'audio/webm';

    if (req.file && req.file.buffer) {
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype || mimeType;
    } else if (audioBase64) {
      audioBuffer = Buffer.from(audioBase64, 'base64');
    }

    // Call service to process free-form conversational message with tool-calling
    const result = await voiceBookingService.processAnswer(sessionId, {
      audioBuffer,
      mimeType,
      textAnswer,
      language
    });

    logger.info(`[VoiceBooking] Processed conversational turn for session ${sessionId} (Action: ${result.actionTaken || 'none'})`);

    return res.status(200).json({
      success: true,
      question: result.replyText,
      questionText: result.replyText,
      ...result
    });
  } catch (error) {
    logger.error(`[VoiceBooking] Process message error: ${error.message}`);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @route   POST /api/voice-booking/:sessionId/answer
 * @desc    Submit spoken audio or text utterance for conversational processing
 * @access  Public (Farmer)
 */
router.post('/:sessionId/answer', upload.single('audio'), handleConversationalAnswer);

/**
 * @route   POST /api/voice-booking/:sessionId/message
 * @desc    Alias route for conversational message processing
 * @access  Public (Farmer)
 */
router.post('/:sessionId/message', upload.single('audio'), handleConversationalAnswer);

/**
 * @route   GET /api/voice-booking/:sessionId/audio/:step
 * @desc    Get prompt text and language (for client-side TTS)
 * @access  Public
 */
router.get('/:sessionId/audio/:step', async (req, res) => {
  try {
    const { sessionId, step } = req.params;
    const { type = 'question', lang = 'mr' } = req.query;

    const session = voiceBookingService.getSession(sessionId);
    const lastMessage = session?.messages?.filter(m => m.role === 'assistant')?.slice(-1)?.[0]?.content || '';

    return res.status(200).json({
      success: true,
      sessionId,
      step: parseInt(step, 10),
      type,
      text: lastMessage,
      language: lang
    });
  } catch (error) {
    logger.error(`[VoiceBooking] Step audio info error: ${error.message}`);
    return res.status(404).json({ success: false, message: 'Step info not found' });
  }
});

/**
 * @route   GET /api/voice-booking/tts
 * @desc    Return prompt text and target language for on-device TTS
 * @access  Public
 */
router.get('/tts', async (req, res) => {
  try {
    const { text, lang = 'mr' } = req.query;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Missing text parameter' });
    }

    const ttsResult = await voiceBookingService.synthesizeTTS(text, lang);
    return res.status(200).json({
      success: true,
      text: ttsResult.text || text,
      language: ttsResult.language || lang
    });
  } catch (error) {
    logger.error(`[VoiceBooking] Direct TTS info error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/voice-booking/:sessionId/status
 * @desc    Get status of an active voice booking session
 * @access  Public
 */
router.get('/:sessionId/status', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = voiceBookingService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired'
      });
    }

    return res.status(200).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        language: session.language,
        activeToken: session.activeToken,
        messageCount: session.messages?.length || 0,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
});

module.exports = router;
