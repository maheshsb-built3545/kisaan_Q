# KisanQ

> **Digital Slot Booking & Real-Time Queue Management Network for Agricultural Mandis**

KisanQ is an end-to-end digital logistics and queue orchestration platform designed for agricultural produce procurement centres (APMC mandis). It eliminates chaotic physical queues, reduces farmer wait times from days to minutes, and provides complete transparency across the procurement lifecycle—from departure dispatch and automated boom-gate intake to digital NIR assaying, electronic gross/tare weighment, MSP deed generation, and direct bank treasury payouts (DBT).

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, Socket.IO (real-time telemetry and push events), MongoDB with Mongoose ODM
- **Frontend Web**: React 18, Vite, Tailwind CSS, Leaflet (interactive mandi logistics mapping), Lucide Icons
- **Voice Intelligence**: Groq Whisper (ultra-low-latency multilingual speech-to-text audio transcription) and Google Gemini (conversational slot extraction & 7/12 land extract analysis)
- **Routing & Navigation**: OSRM (Open Source Routing Machine) for real-time highway travel times and Leave-By departure alerts (no proprietary map API dependencies required)
- **Security & Privacy**: Zero storage of sensitive government identification numbers, 256-bit encrypted session authentication, role-based access control (RBAC), and strict cross-area session isolation

---

## 🏛️ System Architecture & Major Modules

KisanQ is structured into ten coordinated functional modules designed for high availability and offline resiliency:

1. **Trilingual Notification Engine**: Real-time alerts delivered in Marathi, Hindi, and English across in-app channels and SMS notifications for slot confirmations, arrival windows, gate calls, and payout updates.
2. **Dynamic Queue & Turn Management**: Live token queue progression with exact integer positioning, status indicators, and dynamic "Leave-By" travel countdowns powered by real-time road distances.
3. **Multi-Mandi Resource Planning & 7-Day Forecasting**: Predictive load forecasting, hourly slot capacity caps, what-if demand simulation, and inter-mandi resource borrowing across regional procurement centres.
4. **Automated Slot Reallocation & Waitlists**: Dynamic detection of no-show arrivals with automatic slot recovery, 10-minute grace windows, and fair first-in-first-out waitlist offers.
5. **Fast-Track Priority Pooling**: Demand-responsive group pooling that aggregates smallholders with verified lots into expedited processing batches once a quorum of farmers assemble.
6. **Grievance Redressal & Dispute Resolution**: Transparent in-line complaint filing for moisture disputes, tare weight disputes, or grade disagreements, complete with supervisor override audits.
7. **5-Station Mandi Operations Pipeline**: A unified, role-gated operations desk for mandi staff covering:
   - **Station 1 (Security Gate)**: ANPR vehicle plate intake, slot check-in, and boom barrier operation.
   - **Station 2 (Assaying Lab)**: NIR moisture spectrometer analysis, foreign matter grading, and quality sign-off.
   - **Station 3 (Weighbridge Scale)**: Electronic gross and tare weighment telemetry with automated net weight calculation.
   - **Station 4 (Procurement Desk)**: Guaranteed Minimum Support Price (MSP) deed formulation and official digital signing.
   - **Station 5 (DBT Treasury)**: Public Financial Management System (PFMS) electronic batch dispatch and payment advice generation.
8. **Digital Land Holding & 7/12 Verification**: Parsing of land holding extracts to verify acreages, owner identity, and trigger rule-based anomaly flags when declared yields exceed permissible thresholds.
9. **AgriPool Freight Consolidation**: Geo-proximity matching that pairs neighboring farmers travelling along the same corridor within ~500 meters to share vehicle transportation and reduce transit costs.
10. **Multilingual Voice Booking**: Hands-free slot reservation supporting local dialects via Groq Whisper audio transcription and Gemini conversational extraction.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.x or v20.x recommended)
- MongoDB instance (local or MongoDB Atlas connection string)
- npm or yarn

### 1. Repository Setup
```bash
git clone <repository-url>
cd KisanQ-Aveniq
```

### 2. Backend Configuration & Setup
```bash
cd backend
cp .env.example .env
npm install
```

Configure your `backend/.env` file:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/kisanq_aveniq
MONGO_URI=mongodb://localhost:27017/kisanq_aveniq
JWT_SECRET=your_super_secret_jwt_key_min_32_characters
CLIENT_URL=http://localhost:5185
FAST2SMS_API_KEY=your_fast2sms_key_optional
GEMINI_API_KEY=your_gemini_api_key_optional
GROQ_API_KEY=your_groq_api_key_optional
DEMO_MODE=true
DEMO_STATIC_MODE=true
```

Start the backend development server:
```bash
npm run dev
```
The backend API and Socket.IO server will start at `http://localhost:5000`.

### 3. Frontend Web Configuration & Setup
Open a second terminal window:
```bash
cd frontend-web
cp .env.example .env
npm install
npm run dev
```
The frontend will start at `http://localhost:5185`.

---

## 🌾 Live Showcase & Demonstration Mode

KisanQ includes an integrated showcase data engine that simulates an active procurement day across 6 APMC mandis with realistic tokens, queues, weighments, and staff operations.

1. **Seed or Sync Demo Data**:
   ```bash
   cd backend
   # Re-times bookings, fast-track pools, and countdown timers relative to the live clock:
   npm run showcase:live
   ```

2. **Verify Demo Health**:
   ```bash
   npm run demo:check
   ```

3. **Accessing the Demo**:
   Open [http://localhost:5185](http://localhost:5185) in your browser.
   - Click **"⚡ 1-Click Quick Citizen Login (Ramesh Kadam)"** to access the Farmer Command Center.
   - Or click **"Explore KisanQ Demonstration"** to jump into any of the 8 Staff Desks (Security Gate, Assaying Lab, Weighbridge, Procurement, Treasury, Resource Officer, Mandi Supervisor, District Administrator).

---

## 📸 Screenshots

<!-- Add interface screenshots below -->
| Farmer Command Center | Staff Operations Desk |
| :---: | :---: |
| *(Add screenshot of farmer dashboard & live token)* | *(Add screenshot of 5-station operator terminal)* |

| Live Queue Board | Resource Forecasting & Analytics |
| :---: | :---: |
| *(Add screenshot of digital mandi queue)* | *(Add screenshot of 7-day demand heatmaps)* |

---

## ⚠️ Known Limitations

- **Real SMS Gateway**: While Fast2SMS is integrated in code, live SMS delivery requires an active paid transactional DLT route; local development gracefully logs SMS notifications to the console and in-app inbox.
- **Mobile Application**: The core operational interface is focused on the progressive web client (`frontend-web`); the React Native mobile codebase (`frontend-mobile`) is deferred and secondary.
- **Payment Collection / Escrow**: KisanQ generates official PFMS-compliant bank payment advice and DBT payout status records, but does not directly execute direct bank fund transfers.

---

## 📄 License

This project is open-source. Please see the [LICENSE](LICENSE) file for terms.
