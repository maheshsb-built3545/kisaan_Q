/**
 * Ephemeral 7/12 Land Record OCR & Information Extraction Service
 * STRICT PRIVACY & DATA MINIMIZATION:
 * 1. Uploaded 7/12 documents are processed in-memory or in a temporary file.
 * 2. The temporary file is ALWAYS deleted in a finally block.
 * 3. NO document file or binary is EVER stored on disk or in the database.
 * 4. Extracts SUGGESTIONS only; farmer reviews, edits, and confirms.
 * 5. Returns empty suggestions gracefully without crashing if AI keys are missing or offline.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

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
 * Heuristic Marathi/English 7/12 regex parser for fallback extraction
 * @param {string} text 
 */
function extractFieldsFromTextHeuristic(text) {
  if (!text || typeof text !== 'string') return {};

  const suggestions = {};

  // Extract Survey / Gat Number (गट क्र. / सर्व्हे क्र. / Gat No / Survey No)
  const gatMatch = text.match(/(?:गट\s*(?:क्र|नं|क्रमांक|नंबर)?|Gat\s*(?:No|Num)?|Survey\s*(?:No|Num)?|सर्व्हे\s*क्र)[\s.:\-]*([0-9]+(?:\/[0-9]+[A-Za-z]*)?)/i);
  if (gatMatch && gatMatch[1]) {
    suggestions.gatNumber = gatMatch[1].trim();
    suggestions.surveyNumber = gatMatch[1].trim();
  }

  // Extract Village (गाव / Village)
  const villageMatch = text.match(/(?:गाव|Village|मौजे)[\s.:\-]*([\u0900-\u097Fa-zA-Z\s]{2,30})/i);
  if (villageMatch && villageMatch[1]) {
    suggestions.village = villageMatch[1].trim().split(/[\n,;]/)[0].trim();
  }

  // Extract Taluka (तालुका / Taluka / Tahsil)
  const talukaMatch = text.match(/(?:तालुका|Taluka|Tahsil)[\s.:\-]*([\u0900-\u097Fa-zA-Z\s]{2,30})/i);
  if (talukaMatch && talukaMatch[1]) {
    suggestions.taluka = talukaMatch[1].trim().split(/[\n,;]/)[0].trim();
  }

  // Extract District (जिल्हा / District)
  const districtMatch = text.match(/(?:जिल्हा|District)[\s.:\-]*([\u0900-\u097Fa-zA-Z\s]{2,30})/i);
  if (districtMatch && districtMatch[1]) {
    suggestions.district = districtMatch[1].trim().split(/[\n,;]/)[0].trim();
  }

  // Extract Area (क्षेत्र / आकार / Area / Hectare / आर / H.R.)
  // 1 Hectare = 2.471 Acres. 1 Guntha = 0.025 Acres (40 Guntha = 1 Acre).
  const hrMatch = text.match(/(?:क्षेत्र|हे\.आर|H\.R\.|Hectare)[\s.:\-]*([0-9]+)(?:[.\s-]+([0-9]+))?/i);
  if (hrMatch) {
    const hectares = Number(hrMatch[1]) || 0;
    const areOrGuntha = Number(hrMatch[2]) || 0;
    const totalAcres = (hectares * 2.471) + (areOrGuntha * 0.02471);
    if (totalAcres > 0) {
      suggestions.areaAcres = Math.round(totalAcres * 100) / 100;
    }
  }

  // Extract Owner Name (खातेदाराचे नाव / भूधारक / Owner Name)
  const nameMatch = text.match(/(?:खातेदाराचे\s*नाव|भोगवटादार|खातेदार|Owner\s*Name)[\s.:\-]*([\u0900-\u097Fa-zA-Z\s]{3,50})/i);
  if (nameMatch && nameMatch[1]) {
    suggestions.ownerNameOn712 = nameMatch[1].trim().split(/[\n,;]/)[0].trim();
  }

  return suggestions;
}

/**
 * Extract structured land details from uploaded 7/12 document buffer.
 * Processes ephemeral buffer/temp file and guarantees cleanup in finally block.
 * @param {Buffer} fileBuffer 
 * @param {string} mimeType 
 * @param {string} originalName 
 * @returns {Promise<{ suggestions: Object, extracted: boolean, source: string }>}
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

  // Create temporary scratch file for vision model consumption
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
  let source = 'ocr_fallback';

  try {
    // Write ephemeral buffer to temp file
    await fs.promises.writeFile(tempFilePath, fileBuffer);

    // Attempt Gemini Vision extraction if API key is present
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey && geminiApiKey.trim() && detectedType.startsWith('image/')) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiApiKey.trim());
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const imagePart = {
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType: detectedType
          }
        };

        const prompt = `You are an automated Maharashtra APMC Land Record (7/12 Utara / सातबारा) data extractor.
Analyze this 7/12 document and return a STRICT JSON object with these exact fields:
- surveyNumber: string (Survey number or Gat number, e.g. "142/2")
- gatNumber: string (Gat number if present, e.g. "142/2")
- village: string (Village / गाव / मौजे name)
- taluka: string (Taluka / तालुका name)
- district: string (District / जिल्हा name)
- areaAcres: number (Total land area converted to Acres as a decimal number > 0. If given in Hectare/R, convert: 1 Ha = 2.471 Acres, 1 Guntha/R = 0.025 Acres)
- ownershipType: string (Must be one of: "owner", "co_owner", "tenant", "family_holding")
- ownerNameOn712: string (Primary holder / खातेदाराचे नाव as written on the 7/12)

Do NOT include any Aadhaar numbers, PAN numbers, or bank account numbers under any circumstance.
Return ONLY valid raw JSON without markdown code fences or extra text.`;

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed === 'object') {
            if (parsed.surveyNumber) suggestions.surveyNumber = String(parsed.surveyNumber).trim();
            if (parsed.gatNumber) suggestions.gatNumber = String(parsed.gatNumber).trim();
            if (parsed.village) suggestions.village = String(parsed.village).trim();
            if (parsed.taluka) suggestions.taluka = String(parsed.taluka).trim();
            if (parsed.district) suggestions.district = String(parsed.district).trim();
            if (parsed.areaAcres && Number(parsed.areaAcres) > 0) {
              suggestions.areaAcres = Math.round(Number(parsed.areaAcres) * 100) / 100;
            }
            if (['owner', 'co_owner', 'tenant', 'family_holding'].includes(parsed.ownershipType)) {
              suggestions.ownershipType = parsed.ownershipType;
            }
            if (parsed.ownerNameOn712) suggestions.ownerNameOn712 = String(parsed.ownerNameOn712).trim();
            extracted = true;
            source = 'gemini_vision';
          }
        }
      } catch (geminiErr) {
        logger.warn(`[7/12 Extract] Gemini Vision extraction notice: ${geminiErr.message}`);
      }
    }

    // Fallback: If AI is not available or returned partial data, parse buffer text if text content exists
    if (!extracted) {
      try {
        const textSample = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 10000));
        const heuristic = extractFieldsFromTextHeuristic(textSample);
        if (Object.keys(heuristic).length > 0) {
          Object.assign(suggestions, heuristic);
          extracted = true;
        }
      } catch (heuristicErr) {
        logger.warn(`[7/12 Extract] Heuristic fallback notice: ${heuristicErr.message}`);
      }
    }
  } catch (err) {
    logger.warn(`[7/12 Extract] Processing error: ${err.message}`);
    // Safe graceful return without crashing
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
    message: 'Suggestions extracted. Please review and confirm your land details.'
  };
}

module.exports = {
  MAGIC_BYTES,
  validateMagicBytes,
  extractFieldsFromTextHeuristic,
  extract712LandDetails
};
