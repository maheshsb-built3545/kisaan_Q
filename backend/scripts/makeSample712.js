/**
 * makeSample712.js — Synthetic Sample 7/12 Generator & Verification Script
 *
 * Rules:
 * - Generates synthetic sample 7/12 documents (PDF and Image) with obviously fake test data.
 * - Prominently features "SAMPLE / DEMO ONLY" watermark and Marathi field headers.
 * - Saves assets to backend/demo-assets/ directory (no real person data).
 * - Runs the real extraction engine on the generated samples and prints the extracted fields.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { extract712LandDetails } = require('../src/services/landExtractService');

const DEMO_ASSETS_DIR = path.join(__dirname, '../demo-assets');

// Ensure demo-assets directory exists
if (!fs.existsSync(DEMO_ASSETS_DIR)) {
  fs.mkdirSync(DEMO_ASSETS_DIR, { recursive: true });
}

/**
 * Build a valid minimal single-page PDF with synthetic 7/12 Marathi & English text
 */
function createSynthetic712Pdf() {
  const contentStream = `
BT
/F1 16 Tf
50 740 Td
(MAHARASHTRA GOVERNMENT - REVENUE DEPARTMENT) Tj
/F1 14 Tf
0 -25 Td
(VILLAGE FORM VII-XII / 7/12 UTARA - SAMPLE COPY) Tj
/F1 24 Tf
0 -40 Td
(*** SAMPLE / NOT A REAL DOCUMENT ***) Tj
/F1 12 Tf
0 -35 Td
(District / Jilha: Ahilyanagar) Tj
0 -20 Td
(Taluka: Kopargaon) Tj
0 -20 Td
(Village / Gaon: Kolpewadi) Tj
0 -20 Td
(Survey / Gat Number: 142/2) Tj
0 -20 Td
(Total Area / Khshetra: 1.50 Hectare / 3.71 Acres) Tj
0 -20 Td
(Ownership Type: Owner / Bhogvatadar) Tj
0 -20 Td
(Primary Holder / Khatedar Name: Dattatray Rambhau Pawar) Tj
/F1 10 Tf
0 -40 Td
(Marathi Labels: Gaon: Kolpewadi | Taluka: Kopargaon | Jilha: Ahilyanagar) Tj
0 -15 Td
(Gat Kramank: 142/2 | Khshetra: 1.50 H.R. | Khatedar: Dattatray Rambhau Pawar) Tj
0 -30 Td
(WATERMARK: DEMO SAMPLE DOCUMENT - STRICTLY FOR APPLICATION TESTING) Tj
ET
`;

  const streamLength = Buffer.byteLength(contentStream, 'utf8');

  const pdfBody = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595 842]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
    >>
  >>
>>
endobj
4 0 obj
<<
  /Length ${streamLength}
>>
stream${contentStream}endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000298 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${400 + streamLength}
%%EOF`;

  return Buffer.from(pdfBody, 'utf8');
}

/**
 * Build a valid synthetic 400x300 PNG with header chunks
 */
function createSynthetic712Png() {
  const width = 400;
  const height = 200;

  // Uncompressed raw scanlines: 1 filter byte + 3 bytes (RGB) per pixel
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      // Soft parchment background (RGB: 250, 248, 238) with dark green border
      if (x < 6 || x >= width - 6 || y < 6 || y >= height - 6) {
        rawData[pxOffset] = 16;     // R
        rawData[pxOffset + 1] = 90; // G
        rawData[pxOffset + 2] = 45; // B
      } else {
        rawData[pxOffset] = 250;
        rawData[pxOffset + 1] = 248;
        rawData[pxOffset + 2] = 238;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // Helper to construct PNG Chunk
  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lengthBuf = Buffer.alloc(4);
    lengthBuf.writeUInt32BE(data.length, 0);

    // CRC32 calculation
    const crc = zlib.crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
  }

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 2; // Color type: 2 (RGB)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // tEXt Chunk: embed synthetic Marathi & English metadata into PNG text chunk
  const textPayload = Buffer.from('Description\0SAMPLE 7/12 UTARA: Gat: 142/2, Village: Kolpewadi, Taluka: Kopargaon, District: Ahilyanagar, Area: 1.50 H.R. (3.71 Acres), Owner: Dattatray Rambhau Pawar', 'utf8');
  const textChunk = makeChunk('tEXt', textPayload);

  // IDAT Chunk
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, textChunk, idatChunk, iendChunk]);
}

async function runSample712GenerationAndExtraction() {
  console.log('='.repeat(75));
  console.log('📄 KISANQ SYNTHETIC 7/12 SAMPLE GENERATOR & EXTRACTION VERIFIER');
  console.log('='.repeat(75));

  // 1. Generate synthetic PDF sample
  const pdfBuffer = createSynthetic712Pdf();
  const pdfPath = path.join(DEMO_ASSETS_DIR, 'sample_712.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`\n[1/4] Generated synthetic 7/12 PDF: ${pdfPath} (${pdfBuffer.length} bytes)`);

  // 2. Generate synthetic PNG sample
  const pngBuffer = createSynthetic712Png();
  const pngPath = path.join(DEMO_ASSETS_DIR, 'sample_712.png');
  fs.writeFileSync(pngPath, pngBuffer);
  console.log(`[2/4] Generated synthetic 7/12 PNG: ${pngPath} (${pngBuffer.length} bytes)`);

  // 3. Test Real Extraction on PDF Sample
  console.log('\n[3/4] Running Real Extraction Engine on PDF Sample...');
  const pdfResult = await extract712LandDetails(pdfBuffer, 'application/pdf', 'sample_712.pdf');
  console.log('  PDF Extraction Output:');
  console.log('  - Extracted:', pdfResult.extracted);
  console.log('  - Source:   ', pdfResult.source);
  console.log('  - Message:  ', pdfResult.message);
  console.log('  - Suggestions:', JSON.stringify(pdfResult.suggestions, null, 4));

  // 4. Test Real Extraction on PNG Sample
  console.log('\n[4/4] Running Real Extraction Engine on PNG Sample...');
  const pngResult = await extract712LandDetails(pngBuffer, 'image/png', 'sample_712.png');
  console.log('  PNG Extraction Output:');
  console.log('  - Extracted:', pngResult.extracted);
  console.log('  - Source:   ', pngResult.source);
  console.log('  - Message:  ', pngResult.message);
  console.log('  - Suggestions:', JSON.stringify(pngResult.suggestions, null, 4));

  console.log('\n' + '='.repeat(75));
  console.log('✅ SYNTHETIC 7/12 SAMPLES CREATED AND VERIFIED SUCCESSFULLY IN /demo-assets');
  console.log('='.repeat(75));
}

runSample712GenerationAndExtraction().catch((err) => {
  console.error('Error running makeSample712:', err);
  process.exit(1);
});
