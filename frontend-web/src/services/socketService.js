import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000');
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let socket = null;
const connectionListeners = new Set();

/**
 * Initialize or get singleton Socket.IO client
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      withCredentials: true
    });

    socket.on('connect', () => {
      console.log('⚡ [Socket.IO] Connected to KisanQ Real-Time Gateway:', socket.id);
      connectionListeners.forEach((cb) => cb(true, socket.id));
    });

    socket.on('disconnect', (reason) => {
      console.warn('⚡ [Socket.IO] Disconnected from Real-Time Gateway:', reason);
      connectionListeners.forEach((cb) => cb(false, null));
    });

    socket.on('connect_error', (err) => {
      console.debug('⚡ [Socket.IO] Connection error (falling back to polling):', err.message);
      connectionListeners.forEach((cb) => cb(false, null));
    });
  }
  return socket;
}

/**
 * Subscribe to connection status changes (connected/disconnected)
 */
export function subscribeConnectionStatus(callback) {
  const s = getSocket();
  connectionListeners.add(callback);
  if (s) {
    callback(s.connected, s.id);
  } else {
    callback(false, null);
  }
  return () => connectionListeners.delete(callback);
}

/**
 * Join Mandi Real-Time Room
 */
export function joinMandiRoom(mandiId) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('join_mandi', mandiId);
  } else if (s) {
    s.once('connect', () => s.emit('join_mandi', mandiId));
  }
}

/**
 * Join Specific Token Room (for targeted farmer checkpoint notifications)
 */
export function joinTokenRoom(tokenNumber) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('join_token', tokenNumber);
  } else if (s) {
    s.once('connect', () => s.emit('join_token', tokenNumber));
  }
}

/**
 * Join Centre Queue Room (supports legacy/modular centre queues)
 */
export function joinCentreQueue(centreId) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('join_centre_queue', centreId);
  } else if (s) {
    s.once('connect', () => s.emit('join_centre_queue', centreId));
  }
}

/**
 * Leave Centre Queue Room
 */
export function leaveCentreQueue(centreId) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('leave_centre_queue', centreId);
  }
}

/**
 * Join Global Admin Room
 */
export function joinAdminRoom() {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('join_admin');
  } else if (s) {
    s.once('connect', () => s.emit('join_admin'));
  }
}

/**
 * Listen for legacy queue:update events
 */
export function onQueueUpdate(callback) {
  const s = getSocket();
  s.on('queue:update', callback);
  return () => s.off('queue:update', callback);
}

/**
 * Listen for NEW_BOOKING events
 */
export function onNewBooking(callback) {
  const s = getSocket();
  s.on('NEW_BOOKING', callback);
  return () => s.off('NEW_BOOKING', callback);
}

/**
 * Listen for STAGE_UPDATED events
 */
export function onStageUpdated(callback) {
  const s = getSocket();
  s.on('STAGE_UPDATED', callback);
  return () => s.off('STAGE_UPDATED', callback);
}

/**
 * Listen for HARDWARE_EVENT events
 */
export function onHardwareEvent(callback) {
  const s = getSocket();
  s.on('HARDWARE_EVENT', callback);
  return () => s.off('HARDWARE_EVENT', callback);
}

/**
 * Listen for real-time AGRIPOOL_MATCH events (500m proximity micro-pooling alerts)
 */
export function onAgriPoolMatch(callback) {
  const s = getSocket();
  s.on('AGRIPOOL_MATCH', callback);
  return () => s.off('AGRIPOOL_MATCH', callback);
}

/**
 * Listen for real-time TOKEN_COMPLETED events
 */
export function onTokenCompleted(callback) {
  const s = getSocket();
  s.on('TOKEN_COMPLETED', callback);
  return () => s.off('TOKEN_COMPLETED', callback);
}

/**
 * Listen for real-time TOKEN_CANCELLED events
 */
export function onTokenCancelled(callback) {
  const s = getSocket();
  s.on('TOKEN_CANCELLED', callback);
  return () => s.off('TOKEN_CANCELLED', callback);
}

/**
 * Listen for real-time GATE_EXIT_REQUESTED events
 */
export function onGateExitRequested(callback) {
  const s = getSocket();
  s.on('GATE_EXIT_REQUESTED', callback);
  s.on('EXIT_REQUESTED', callback);
  return () => {
    s.off('GATE_EXIT_REQUESTED', callback);
    s.off('EXIT_REQUESTED', callback);
  };
}

/**
 * Listen for real-time EXIT_APPROVED events
 */
export function onExitApproved(callback) {
  const s = getSocket();
  s.on('EXIT_APPROVED', callback);
  s.on('GATE_EXIT_APPROVED', callback);
  return () => {
    s.off('EXIT_APPROVED', callback);
    s.off('GATE_EXIT_APPROVED', callback);
  };
}

/**
 * Listen for real-time FARMER_DUES_UPDATED events
 */
export function onFarmerDuesUpdated(callback) {
  const s = getSocket();
  s.on('FARMER_DUES_UPDATED', callback);
  return () => s.off('FARMER_DUES_UPDATED', callback);
}

/**
 * Listen for real-time QUEUE_SLOT_FREED events
 */
export function onQueueSlotFreed(callback) {
  const s = getSocket();
  s.on('QUEUE_SLOT_FREED', callback);
  return () => s.off('QUEUE_SLOT_FREED', callback);
}

/**
 * Listen for real-time FAST_TRACK_NEW_REQUEST events
 */
export function onFastTrackNewRequest(callback) {
  const s = getSocket();
  s.on('FAST_TRACK_NEW_REQUEST', callback);
  return () => s.off('FAST_TRACK_NEW_REQUEST', callback);
}

/**
 * Listen for real-time FAST_TRACK_REQUESTED / FAST_TRACK_NEW_REQUEST events
 */
export function onFastTrackRequested(callback) {
  const s = getSocket();
  s.on('FAST_TRACK_NEW_REQUEST', callback);
  s.on('FAST_TRACK_REQUESTED', callback);
  return () => {
    s.off('FAST_TRACK_NEW_REQUEST', callback);
    s.off('FAST_TRACK_REQUESTED', callback);
  };
}

/**
 * Listen for real-time FAST_TRACK_APPROVED events
 */
export function onFastTrackApproved(callback) {
  const s = getSocket();
  s.on('FAST_TRACK_APPROVED', callback);
  return () => s.off('FAST_TRACK_APPROVED', callback);
}

/**
 * Listen for real-time FAST_TRACK_REJECTED events
 */
export function onFastTrackRejected(callback) {
  const s = getSocket();
  s.on('FAST_TRACK_REJECTED', callback);
  return () => s.off('FAST_TRACK_REJECTED', callback);
}

/**
 * Trigger Hardware Simulation (Boom barrier / load cell)
 */
export async function triggerHardwareSimulation({ mandiId = 'KPG-01', device, action, value, tokenNumber }) {
  try {
    const res = await fetch(`${API_BASE}/tokens/hardware-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mandiId, device, action, value, tokenNumber })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to trigger hardware simulation:', err);
    return null;
  }
}


