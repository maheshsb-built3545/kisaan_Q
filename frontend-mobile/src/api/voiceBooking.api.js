import client from './client';
import { API_BASE_URL } from '../utils/constants';

/**
 * ─── KisanQ Mobile Voice Booking API Client ─────────────────────────────────
 * Handles communication with Gemini-powered backend STT, NLU, and Steerable TTS endpoints.
 */
export const voiceBookingApi = {
  /**
   * Start a new voice booking interactive session
   * @param {Object} params - { language, farmerId, phone, farmerName }
   */
  startSession: async ({ language = 'mr', farmerId, phone, farmerName }) => {
    const response = await client.post('/voice-booking/start', {
      language,
      farmerId,
      phone,
      farmerName
    });
    return response.data;
  },

  /**
   * Submit audio file URI, base64 audio, or text answer for the active step
   * @param {string} sessionId
   * @param {Object} payload - { audioUri, audioBase64, mimeType, textAnswer }
   */
  sendAnswer: async (sessionId, { audioUri, audioBase64, mimeType, textAnswer, language = 'mr' }) => {
    if (audioUri) {
      const formData = new FormData();
      const ext = mimeType?.includes('wav') ? 'wav' : mimeType?.includes('mp4') ? 'mp4' : mimeType?.includes('m4a') ? 'm4a' : 'm4a';
      const type = mimeType || 'audio/m4a';

      formData.append('audio', {
        uri: audioUri,
        name: `voice_answer_${Date.now()}.${ext}`,
        type
      });

      formData.append('mimeType', type);
      if (language) {
        formData.append('language', language);
      }

      const response = await client.post(`/voice-booking/${sessionId}/answer`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 40000 // Allow up to 40s for Gemini multimodal reasoning over network
      });
      return response.data;
    } else if (audioBase64) {
      const response = await client.post(`/voice-booking/${sessionId}/answer`, {
        audioBase64,
        mimeType: mimeType || 'audio/m4a',
        language
      }, {
        timeout: 40000
      });
      return response.data;
    } else {
      const response = await client.post(`/voice-booking/${sessionId}/answer`, {
        textAnswer,
        mimeType: 'text/plain',
        language
      }, {
        timeout: 25000
      });
      return response.data;
    }
  },

  /**
   * Fetch current session status
   */
  getSessionStatus: async (sessionId) => {
    const response = await client.get(`/voice-booking/${sessionId}/status`);
    return response.data;
  },

  /**
   * Get direct streaming audio URL for TTS prompt or clarification
   */
  getAudioUrl: (sessionId, step, type = 'question', lang = 'mr') => {
    return `${API_BASE_URL}/voice-booking/${sessionId || 'direct'}/audio/${step}?type=${type}&lang=${lang}&t=${Date.now()}`;
  },

  /**
   * Get direct TTS synthesized audio URL for custom text
   */
  getTTSUrl: (text, lang = 'mr') => {
    return `${API_BASE_URL}/voice-booking/tts?text=${encodeURIComponent(text)}&lang=${lang}&t=${Date.now()}`;
  }
};

export default voiceBookingApi;
