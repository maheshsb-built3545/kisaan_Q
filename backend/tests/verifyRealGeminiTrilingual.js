require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const voiceBookingService = require('../src/services/voiceBookingService');

// Helper to fetch real native spoken audio from TTS audio service
async function getSpokenAudio(text, lang) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch spoken audio: ${res.statusText}`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function runLiveVerification() {
  console.log('================================================================');
  console.log('🎙️  KISANQ GEMINI 2.0 FLASH LIVE TRILINGUAL VERIFICATION');
  console.log('================================================================');
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`API Key Status: ${apiKey ? 'Loaded (Length ' + apiKey.length + ', Prefix: ' + apiKey.substring(0, 8) + '...)' : 'MISSING'}\n`);

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in process.env!');
    process.exit(1);
  }

  const testCases = [
    {
      step: 1,
      lang: 'en',
      langName: 'English',
      field: 'centre',
      spokenUtterance: 'I want to book APMC Kopargaon centre',
      question: 'Which procurement centre would you like to book?'
    },
    {
      step: 2,
      lang: 'hi',
      langName: 'Hindi',
      field: 'crop',
      spokenUtterance: 'मुझे सोयाबीन फसल के लिए स्लॉट बुक करना है',
      question: 'आप कौन सी फसल ला रहे हैं?'
    },
    {
      step: 3,
      lang: 'mr',
      langName: 'Marathi',
      field: 'quantity',
      spokenUtterance: 'मला पंचवीस क्विंटल माल आणायचा आहे',
      question: 'तुम्ही किती क्विंटल माल घेऊन येणार आहात?'
    },
    {
      step: 4,
      lang: 'mr',
      langName: 'Marathi',
      field: 'slot',
      spokenUtterance: 'उद्या सकाळी',
      question: 'तुम्हाला कोणत्या दिवशी व वेळेत यायचे आहे?'
    }
  ];

  // 1. Test full interactive session across steps
  console.log('🚀 Starting Voice Booking Session with farmer details...');
  const startRes = await voiceBookingService.startSession({
    language: 'mr',
    farmerPhone: '9876543210',
    farmerName: 'Mahesh Borde'
  });
  const sessionId = startRes.sessionId;
  console.log(`✅ Voice Session initialized: ${sessionId}\n`);

  for (const tc of testCases) {
    console.log('----------------------------------------------------------------');
    console.log(`🌐 [${tc.langName.toUpperCase()}] Step ${tc.step}: Field '${tc.field}'`);
    console.log(`Spoken farmer audio utterance: "${tc.spokenUtterance}"`);
    console.log(`Question: "${tc.question}"`);

    // Fetch real recorded spoken audio
    const audioBuf = await getSpokenAudio(tc.spokenUtterance, tc.lang);
    console.log(`Generated real speech audio buffer: ${audioBuf.length} bytes (audio/mpeg)`);

    // Call raw Gemini endpoint directly first to inspect exact wire request/response
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const promptText = `You are the AI Voice Intake Assayer for KisanQ (Maharashtra APMC Agricultural Slot Booking).
The farmer was asked: "${tc.question}" in ${tc.langName}.
Target field: "${tc.field}".

Extract field instructions:
${tc.field === 'centre' ? 'Allowed Mandi centres: "APMC Kopargaon" (code: "KPG-01"), "APMC Shirdi" (code: "SRD-02"), "APMC Rahata" (code: "RHT-03"), "APMC Vaijapur" (code: "VJP-04"), "APMC Shrirampur" (code: "SRP-05"), "APMC Lasalgaon" (code: "LSG-06"). Return matched centre object: { "code": string, "name": string }' : ''}
${tc.field === 'crop' ? 'Allowed crops: "Soybean", "Cotton", "Wheat", "Onion", "Maize", "Chana". Return matched crop string (e.g. "Soybean")' : ''}
${tc.field === 'quantity' ? 'Extract numeric quantity in quintals as a positive integer (e.g. 25, 50, 10). Parse Marathi/Hindi numerals (e.g. "पंचवीस" -> 25). Return integer number.' : ''}
${tc.field === 'slot' ? 'Extract arrival date offset and time slot: dateOffset: 0 for today, 1 for tomorrow ("udya", "उद्या", "kal", "कल"), 2 for day after. slotLabel: One of "08:00 AM - 11:00 AM" (morning / sakali / subah), "11:00 AM - 02:00 PM", "02:00 PM - 05:00 PM". Return object: { "dateOffset": number, "slotLabel": string, "period": "morning"|"midday"|"afternoon" }' : ''}

Task:
1. Transcribe the user's spoken audio response accurately in ${tc.langName}.
2. If the user mentioned a valid ${tc.field}, extract the normalized value.
3. If the audio is silent or unclear, mark status as "UNCLEAR".

Return STRICT JSON ONLY matching this format:
{
  "status": "VALID" | "UNCLEAR",
  "transcript": "<verbatim transcript>",
  "value": <extracted value or null>,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "clarificationNote": "<short helpful note if UNCLEAR>"
}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/mpeg',
                data: audioBuf.toString('base64')
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

    console.log('\n📤 [WIRE REQUEST TO GEMINI]:');
    console.log(`Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=[REDACTED]`);
    console.log(`Audio mimeType: audio/mpeg, Base64 length: ${requestBody.contents[0].parts[0].inlineData.data.length} chars`);
    console.log(`Prompt: ${promptText.split('\n')[0]}...`);

    const geminiRawRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000)
    });

    const geminiRawJson = await geminiRawRes.json();
    console.log('\n📥 [RAW RESPONSE FROM GEMINI]:');
    if (!geminiRawRes.ok) {
      console.error('Gemini API Error:', geminiRawJson);
    } else {
      const candidateText = geminiRawJson.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`HTTP Status: ${geminiRawRes.status}`);
      console.log('Gemini Parsed JSON Output:');
      console.log(candidateText);
    }

    // Now execute through the official service workflow: processAnswer
    console.log('\n🔄 [SERVICE PIPELINE EXECUTION]:');
    const stepResult = await voiceBookingService.processAnswer(sessionId, {
      audioBuffer: audioBuf,
      mimeType: 'audio/mpeg',
      language: tc.lang
    });
    console.log('Service step result:', JSON.stringify(stepResult, null, 2));

    if (tc.step === 4) {
      console.log('\n🎉 [FINAL STEP BOOKING CONFIRMATION]:');
      console.log(`Is Complete: ${stepResult.complete}`);
      console.log(`Generated Token:`, stepResult.token || stepResult.booking);
    }
  }
}

runLiveVerification().catch(err => {
  console.error('Execution failure:', err);
  process.exit(1);
});
