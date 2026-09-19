import apiClient, { BASE_URL } from './client';

/**
 * API client for KisanQ Voice Booking Engine (Multimodal Gemini AI)
 */
export const voiceBookingApi = {
  /**
   * Start a new voice booking interactive session
   */
  startSession: async ({ language = 'mr', farmerId, phone, farmerName }) => {
    const response = await apiClient.post('/voice-booking/start', {
      language,
      farmerId,
      phone,
      farmerName
    });
    return response.data;
  },

  /**
   * Submit audio blob or text answer for the active step
   */
  sendAnswer: async (sessionId, { audioBlob, mimeType, textAnswer }) => {
    if (audioBlob) {
      const formData = new FormData();
      const fileExt = mimeType?.includes('wav') ? 'wav' : mimeType?.includes('mp4') ? 'mp4' : mimeType?.includes('mpeg') || mimeType?.includes('mp3') ? 'mp3' : 'webm';
      formData.append('audio', audioBlob, `speech.${fileExt}`);
      if (mimeType) formData.append('mimeType', mimeType);

      const response = await apiClient.post(`/voice-booking/${sessionId}/answer`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 35000 // Allow up to 35s for Gemini multimodal reasoning
      });
      return response.data;
    } else {
      const response = await apiClient.post(`/voice-booking/${sessionId}/answer`, {
        textAnswer,
        mimeType: 'text/plain'
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
    const response = await apiClient.get(`/voice-booking/${sessionId}/status`);
    return response.data;
  },

  /**
   * Get direct streaming audio URL for TTS prompt/clarification
   */
  getAudioUrl: (sessionId, step, type = 'question', lang = 'mr') => {
    return `${BASE_URL}/voice-booking/${sessionId || 'direct'}/audio/${step}?type=${type}&lang=${lang}&t=${Date.now()}`;
  },

  /**
   * Get direct TTS synthesized audio URL for custom text
   */
  getTTSUrl: (text, lang = 'mr') => {
    return `${BASE_URL}/voice-booking/tts?text=${encodeURIComponent(text)}&lang=${lang}&t=${Date.now()}`;
  }
};

export default voiceBookingApi;
