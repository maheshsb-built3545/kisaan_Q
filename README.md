# KisanQ Aveniq

Digital slot booking and real-time queue management system for agricultural procurement centres.

## Architecture Overview
KisanQ is built using a **Modular Monolith** architecture:
- **Backend**: Node.js, Express, Socket.IO, MongoDB (Mongoose ODM)
- **Frontend Web**: React, Vite, Tailwind CSS
- **Core Services**:
  - `Auth`: User authentication & authorization (Farmers, Officers, Admins)
  - `Booking`: Slot allocation, capacity management, scheduling
  - `Queue`: Real-time queue sequencing, token generation, live updates via Socket.IO
  - `Centre`: Procurement centre profiles, bay configurations, operational rules
  - `Procurement`: Quality inspection logging, weighbridge records, receipt generation
  - `Exceptions`: Rescheduling, emergency delay overrides, escalation management

## Principles
- **Strict Data Minimization**: Sensitive government identification numbers (Aadhaar, full bank account details) are never stored or logged.
- **Real-Time Responsiveness**: Instant notifications and dynamic queue boards powered by WebSockets.
- **Decoupled Business Services**: Logic separated cleanly into dedicated services and controllers for future microservices migration if needed.

## Getting Started

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env`:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/kisanq
   JWT_SECRET=your_secret_key
   CLIENT_URL=http://localhost:5173
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```

### Frontend Web Setup
1. Navigate to the frontend-web directory:
   ```bash
   cd frontend-web
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
