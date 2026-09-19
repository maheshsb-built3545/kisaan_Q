import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false, // Do not auto-connect until explicitly triggered
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1500
    });

    socket.on('connect', () => {
      console.log(`[Socket.IO] Connected to KisanQ Gateway (${socket.id})`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Disconnected: ${reason}`);
    });

    socket.on('connect_error', (err) => {
      console.warn(`[Socket.IO] Connection error: ${err.message}`);
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

export const joinMandiRoom = (mandiId) => {
  const s = getSocket();
  if (s && mandiId) {
    s.emit('join_mandi', mandiId);
    s.emit('join_centre_queue', mandiId);
  }
};

export const joinCentreRoom = (centreId) => {
  const s = getSocket();
  if (s && centreId) {
    s.emit('join_centre_queue', centreId);
    s.emit('join_mandi', centreId);
  }
};

export const joinTokenRoom = (tokenNumber) => {
  const s = getSocket();
  if (s && tokenNumber) {
    s.emit('join_token', tokenNumber);
  }
};

export const leaveMandiRoom = (mandiId) => {
  const s = getSocket();
  if (s && mandiId) {
    s.emit('leave_mandi', mandiId);
  }
};

export const leaveTokenRoom = (tokenNumber) => {
  const s = getSocket();
  if (s && tokenNumber) {
    s.emit('leave_token', tokenNumber);
  }
};

export default {
  getSocket,
  connectSocket,
  disconnectSocket,
  joinMandiRoom,
  joinCentreRoom,
  joinTokenRoom,
  leaveMandiRoom,
  leaveTokenRoom
};
