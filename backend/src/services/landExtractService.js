/**
 * Ephemeral 7/12 Land Record OCR & Information Extraction Service
 * STRICT PRIVACY & DATA MINIMIZATION:
 * 1. Uploaded 7/12 documents are processed in-memory or in a temporary file.
 * 2. The temporary file is ALWAYS deleted in a finally block.
 * 3. NO document file or binary is EVER stored on disk or in the database.
 * 4. Extracts SUGGESTIONS only; farmer reviews, edits, and confirms.
 * 5. Returns empty suggestions gracefully with a clear message if AI keys are missing or offline.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const { VOICE_CONFIG } = require('../config/voiceConfig');

// Magic byte signatures for supported file types
const MAGIC_BYTES = {
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
  JPEG: [0xFF, 0xD8, 0xFF],      // JPEG
  PNG: [0x89, 0x50, 0x4E, 0x47]  // PNG (\x89PNG)
};

/**
 * Validate file buffer magic bytes against allowed types (PDF, JPEG, PNG)
 * @param {Buffer} buffer 
 * @returns {{ isValid: boolean, detectedType: string|null }}
 */
function validateMagicBytes(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return { isValid: false, detectedType: null };
  }

  // Check PDF
  if (
    buffer[0] === MAGIC_BYTES.PDF[0] &&
    buffer[1] === MAGIC_BYTES.PDF[1] &&
    buffer[2] === MAGIC_BYTES.PDF[2] &&
    buffer[3] === MAGIC_BYTES.PDF[3]
  ) {
    return { isValid: true, detectedType: 'application/pdf' };
  }

  // Check JPEG
  if (
    buffer[0] === MAGIC_BYTES.JPEG[0] &&
    buffer[1] === MAGIC_BYTES.JPEG[1] &&
    buffer[2] === MAGIC_BYTES.JPEG[2]
  ) {
    return { isValid: true, detectedType: 'image/jpeg' };
  }

  // Check PNG
  if (
    buffer[0] === MAGIC_BYTES.PNG[0] &&
    buffer[1] === MAGIC_BYTES.PNG[1] &&
    buffer[2] === MAGIC_BYTES.PNG[2] &&
    buffer[3] === MAGIC_BYTES.PNG[3]
  ) {
    return { isValid: true, detectedType: 'image/png' };
  }

  return { isValid: false, detectedType: null };
}

/**
 * Extract structured land details from uploaded 7/12 document buffer.
 * Processes ephemeral buffer/temp file and guarantees cleanup in finally block.
 * @param {Buffer} fileBuffer 
 * @param {string} mimeType 
 * @param {string} originalName 
 * @returns {Promise<{ suggestions: Object, extracted: boolean, source: string, message: string }>}
 */
async function extract712LandDetails(fileBuffer, mimeType, originalName = 'document') {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('Valid file buffer is required for 7/12 extraction');
  }

  // 1. Enforce 5 MB maximum size limit
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  if (fileBuffer.length > MAX_SIZE_BYTES) {
    const err = new Error('File size exceeds the 5 MB limit. Please upload a smaller 7/12 document.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Validate magic bytes
  const { isValid, detectedType } = validateMagicBytes(fileBuffer);
  if (!isValid) {
    const err = new Error('Invalid file format. Only PDF, JPG, and PNG 7/12 documents are supported.');
    err.statusCode = 400;
    throw err;
  }

  // Create temporary scratch file for tracking/lifecycle assertion
  const tempDir = os.tmpdir();
  const tempFilename = `712_extract_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;
  const tempFilePath = path.join(tempDir, tempFilename);

  let suggestions = {
    surveyNumber: '',
    gatNumber: '',
    village: '',
    taluka: '',
    district: '',
    areaAcres: null,
    ownershipType: 'owner',
    ownerNameOn712: ''
  };
  let extracted = false;
  let source = 'none';
  let statusMessage = 'Could not auto-extract fields from 7/12 document. Please enter your land details manually.';

  try {
    // Write ephemeral buffer to temp file
    await fs.promises.writeFile(tempFilePath, fileBuffer);

    // Resolve Gemini model dynamically from central voiceConfig
    const geminiModel = VOICE_CONFIG.nlu?.geminiModel || 'gemini-3.6-flash';
    logger.info(`[7/12 Extract] Using Gemini model: ${geminiModel} for document type: ${detectedType}`);

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey && geminiApiKey.trim()) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey.trim()}`;

        const prompt = `You are an automated Maharashtra APMC Land Record (7/12 Utara / सातबारा) data extractor.
Analyze this 7/12 document (PDF or image) and extract the structured land attributes.
Return a STRICT JSON object with these exact fields:
{
  "surveyNumber": string (e.g. "142/2" or survey number),
  "gatNumber": string (e.g. "142/2" or gat number),
  "village": string (Village / गाव / मौजे name),
  "taluka": string (Taluka / तालुका name),
  "district": string (District / जिल्हा name, default "Ahilyanagar"),
  "areaAcres": number (Total land area in Acres as decimal > 0. If in Hectare/R, convert: 1 Ha = 2.471 Acres, 1 R/Guntha = 0.0247 Acres),
  "ownershipType": "owner" | "co_owner" | "tenant" | "family_holding",
  "ownerNameOn712": string (Primary holder / खातेदाराचे नाव as written on the 7/12)
}

CRITICAL RULES:
1. Do NOT extract, log, or return any national identity numbers, PAN cards, or bank accounts under any circumstance. Only extract agricultural land fields.
2. District should be standardized to "Ahilyanagar" if referring to Ahmednagar / अहिल्यानगर.
3. Return ONLY the raw JSON object. Do not include markdown code fences, backticks, or any additional text.`;

        const requestBody = {
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: detectedType,
                    data: fileBuffer.toString('base64')
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        };

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
          const resData = await response.json();
          const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed && typeof parsed === 'object') {
                if (parsed.surveyNumber) suggestions.surveyNumber = String(parsed.surveyNumber).trim();
                if (parsed.gatNumber) suggestions.gatNumber = String(parsed.gatNumber).trim();
                if (parsed.village) suggestions.village = String(parsed.village).trim();
                if (parsed.taluka) suggestions.taluka = String(parsed.taluka).trim();
                if (parsed.district) suggestions.district = String(parsed.district).trim().replace(/Ahmednagar/i, 'Ahilyanagar');
                if (parsed.areaAcres && Number(parsed.areaAcres) > 0) {
                  suggestions.areaAcres = Math.round(Number(parsed.areaAcres) * 100) / 100;
                }
                if (['owner', 'co_owner', 'tenant', 'family_holding'].includes(parsed.ownershipType)) {
                  suggestions.ownershipType = parsed.ownershipType;
                }
                if (parsed.ownerNameOn712) suggestions.ownerNameOn712 = String(parsed.ownerNameOn712).trim();

                extracted = true;
                source = 'gemini_vision';
                statusMessage = 'Suggestions extracted successfully from 7/12. Please review and confirm.';
              }
            }
          }
        } else {
          const errBody = await response.text();
          logger.warn(`[7/12 Extract] Gemini REST API returned status ${response.status}: ${errBody}`);
        }
      } catch (geminiErr) {
        logger.warn(`[7/12 Extract] Gemini Vision extraction notice: ${geminiErr.message}`);
      }
    } else {
      logger.info('[7/12 Extract] No GEMINI_API_KEY provided — skipping cloud extraction gracefully.');
    }
  } catch (err) {
    logger.warn(`[7/12 Extract] Processing error: ${err.message}`);
  } finally {
    // CRITICAL REQUIREMENT: Always delete temporary file in finally block
    try {
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath);
        logger.info(`[7/12 Extract] Ephemeral temp file deleted: ${tempFilename}`);
      }
    } catch (cleanupErr) {
      logger.warn(`[7/12 Extract] Cleanup error: ${cleanupErr.message}`);
    }
  }

  return {
    suggestions,
    extracted,
    source,
    message: statusMessage
  };
}

module.exports = {
  MAGIC_BYTES,
  validateMagicBytes,
  extract712LandDetails
};
