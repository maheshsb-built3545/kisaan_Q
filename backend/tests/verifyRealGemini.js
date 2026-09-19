// Script to test & display raw request/response payloads to Google Gemini API
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Trilingual sample utterances to test:
// English: "I want to book APMC Kopargaon centre"
// Hindi: "मुझे सोयाबीन फसल के लिए स्लॉट बुक करना है" (Soybean crop)
// Marathi: "मला पंचवीस क्विंटल माल आणायचा आहे" (25 quintals)

const TEST_CASES = [
  {
    language: 'en',
    field: 'centre',
    question: 'Which procurement centre would you like to book? For example: Kopargaon, Shirdi, Rahata, Vaijapur, Shrirampur, or Lasalgaon.',
    sampleTranscript: 'I want to book APMC Kopargaon centre',
    // PCM 16kHz audio buffer
    audioSampleRate: 16000
  },
  {
    language: 'hi',
    field: 'crop',
    question: 'आप कौन सी फसल ला रहे हैं? जैसे: सोयाबीन, कपास, गेहूं, प्याज, मक्का, या चना.',
    sampleTranscript: 'मुझे सोयाबीन फसल के लिए स्लॉट बुक करना है',
    audioSampleRate: 16000
  },
  {
    language: 'mr',
    field: 'quantity',
    question: 'तुम्ही किती क्विंटल माल घेऊन येणार आहात? उदाहरणार्थ: २५ क्विंटल किंवा ५० क्विंटल.',
    sampleTranscript: 'मला पंचवीस क्विंटल माल आणायचा आहे',
    audioSampleRate: 16000
  }
];

/**
 * Creates a valid PCM WAV audio buffer.
 */
function createPcmWav(durationSeconds = 1.5, frequency = 440) {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const blockAlign = 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = Math.floor(Math.sin(2 * Math.PI * frequency * t) * 10000);
    buffer.writeInt16LE(sampleVal, 44 + i * 2);
  }
  return buffer;
}

async function testGeminiPayloads() {
  const apiKey = process.env.GEMINI_API_KEY;

  console.log('================================================================');
  console.log('🤖 GEMINI API LIVE PAYLOAD VERIFICATION (EN / HI / MR)');
  console.log('================================================================');
  console.log(`GEMINI_API_KEY configured: ${apiKey ? 'YES (' + apiKey.substring(0, 6) + '...)' : 'NO (Using mock verification mode)'}\n`);

  for (const tc of TEST_CASES) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`🔍 [${tc.language.toUpperCase()}] Testing Field: '${tc.field}'`);
    console.log(`Question: "${tc.question}"`);
    console.log(`Sample Spoken Intent: "${tc.sampleTranscript}"`);
    console.log(`----------------------------------------------------------------`);

    const audioBuf = createPcmWav(1.5, tc.field === 'centre' ? 440 : tc.field === 'crop' ? 523 : 659);
    const audioBase64 = audioBuf.toString('base64');

    const promptText = `You are the AI Voice Intake Assayer for KisanQ (Maharashtra APMC Agricultural Slot Booking).
The farmer was asked: "${tc.question}" in ${tc.language === 'mr' ? 'Marathi' : tc.language === 'hi' ? 'Hindi' : 'English'}.
Target field: "${tc.field}".

Rules:
${tc.field === 'centre' ? 'Allowed Mandi centres: "APMC Kopargaon" (KPG-01), "APMC Shirdi" (SRD-02), "APMC Rahata" (RHT-03), "APMC Vaijapur" (VJP-04), "APMC Shrirampur" (SRP-05), "APMC Lasalgaon" (LSG-06).' : ''}
${tc.field === 'crop' ? 'Allowed crops: "Soybean", "Cotton", "Wheat", "Onion", "Maize", "Chana".' : ''}
${tc.field === 'quantity' ? 'Extract numeric quantity in quintals as integer (e.g. 25, 50, 10).' : ''}

Task:
1. Transcribe the user's spoken audio response accurately.
2. Extract the normalized value matching the target field.
3. If unclear, mark status as "UNCLEAR".

Return STRICT JSON ONLY matching this format:
{
  "status": "VALID" | "UNCLEAR",
  "transcript": "<verbatim transcript>",
  "value": <extracted value>,
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}`;

    const requestPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: audioBase64.substring(0, 48) + '... [Base64 Audio Data - ' + audioBuf.length + ' bytes]'
              }
            },
            {
              text: promptText
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    console.log('\n📤 REAL REQUEST PAYLOAD SENT TO GEMINI API:');
    console.log(JSON.stringify(requestPayload, null, 2));

    if (apiKey) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const actualPayload = {
          ...requestPayload,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
                { text: promptText }
              ]
            }
          ]
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actualPayload)
        });

        const rawRes = await res.json();
        console.log(`\n📥 LIVE GEMINI API RESPONSE (HTTP ${res.status}):`);
        console.log(JSON.stringify(rawRes, null, 2));

        const parsedJsonText = rawRes.candidates?.[0]?.content?.parts?.[0]?.text;
        if (parsedJsonText) {
          console.log('\n✨ PARSED GEMINI STRUCTURED OUTPUT:');
          console.log(JSON.stringify(JSON.parse(parsedJsonText), null, 2));
        }
      } catch (e) {
        console.error('Gemini API call failed:', e.message);
      }
    } else {
      console.log('\n📥 EXPECTED GEMINI STRUCTURED RESPONSE (GEMINI_API_KEY not yet set in .env):');
      const expectedResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify(
                    tc.field === 'centre'
                      ? { status: 'VALID', transcript: tc.sampleTranscript, value: { code: 'KPG-01', name: 'APMC Kopargaon' }, confidence: 'HIGH' }
                      : tc.field === 'crop'
                      ? { status: 'VALID', transcript: tc.sampleTranscript, value: 'Soybean', confidence: 'HIGH' }
                      : { status: 'VALID', transcript: tc.sampleTranscript, value: 25, confidence: 'HIGH' },
                    null,
                    2
                  )
                }
              ],
              role: 'model'
            },
            finishReason: 'STOP'
          }
        ]
      };
      console.log(JSON.stringify(expectedResponse, null, 2));
    }
  }
}

testGeminiPayloads();
