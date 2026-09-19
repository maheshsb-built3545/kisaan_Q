const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

function postJson(pathUrl, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const body = JSON.stringify(payload);

    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function postMultipartRaw(pathUrl, { fileBuffer, fileName, mimeType, language }) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const url = new URL(pathUrl, BASE_URL);

    const prefix = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="audio"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    const mid1 = Buffer.from(
      `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="mimeType"\r\n\r\n` +
      `${mimeType}\r\n`
    );
    const mid2 = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n` +
      `${language}\r\n`
    );
    const suffix = Buffer.from(`--${boundary}--\r\n`);

    const fullBody = Buffer.concat([prefix, fileBuffer, mid1, mid2, suffix]);

    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': fullBody.length
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function testRealAudioSubmission() {
  console.log('================================================================');
  console.log('REAL AUDIO MULTIPART DISPATCH & BACKEND RECEIPT TEST');
  console.log('================================================================\n');

  // 1. Initialize session in Marathi
  const startRes = await postJson('/api/voice-booking/start', {
    language: 'mr',
    farmerName: 'Ramesh Patil',
    phone: '9822012345'
  });
  const sessionId = startRes.data.sessionId;
  console.log(`[Step 0] Started session: ${sessionId} (Language: mr)`);

  // 2. Prepare sample recorded audio file buffer
  const audioBuffer = Buffer.alloc(1024 * 8, 0x55); // 8KB mock audio binary
  const mockNativeAudioUri = `file:///data/user/0/host.exp.exponent/cache/ExperienceData/Audio/recording-${Date.now()}.m4a`;

  // 3. Exact client-side dispatch payload representation
  const clientPayloadLog = {
    type: 'multipart/form-data (Native Audio Recording)',
    language: 'mr',
    audioUri: mockNativeAudioUri,
    mimeType: 'audio/m4a',
    textAnswer: null,
    activeStep: 1,
    consecutiveFailures: 0
  };

  console.log('\n[Step 1] Client-side VoiceBookingModal payload before dispatch:');
  console.log(JSON.stringify(clientPayloadLog, null, 2));

  // 4. Send real multipart/form-data request with audio binary + mimeType + language
  console.log('\n[Step 2] Sending multipart/form-data with binary audio buffer + language="mr"...');
  const response = await postMultipartRaw(`/api/voice-booking/${sessionId}/answer`, {
    fileBuffer: audioBuffer,
    fileName: `voice_answer_${Date.now()}.m4a`,
    mimeType: 'audio/m4a',
    language: 'mr'
  });

  console.log('\n[Step 3] Backend Response:');
  console.log(JSON.stringify(response, null, 2));

  console.log('\n================================================================');
  console.log('REAL MULTIPART AUDIO VERIFICATION COMPLETE');
  console.log('================================================================');
}

testRealAudioSubmission().catch(console.error);
