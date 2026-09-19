import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getSocket,
  subscribeConnectionStatus,
  joinCentreQueue as socketJoinCentreQueue,
  leaveCentreQueue as socketLeaveCentreQueue,
  onQueueUpdate
} from '../services/socketService';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [lastQueueUpdate, setLastQueueUpdate] = useState(null);
  const [socketError, setSocketError] = useState(null);

  useEffect(() => {
    // Consume the centralized singleton socket connection
    const socket = getSocket();

    const unsubStatus = subscribeConnectionStatus((connected) => {
      setIsConnected(connected);
      if (connected) setSocketError(null);
    });

    const handleJoinedQueue = (payload) => {
      console.log('[SocketContext] Joined room:', payload);
      setCurrentRoom(payload.room);
    };

    const handleSocketError = (err) => {
      console.error('[SocketContext] Server error:', err);
      setSocketError(err?.message || 'Socket error occurred');
    };

    socket.on('joined_queue', handleJoinedQueue);
    socket.on('error', handleSocketError);

    // Listen for queue updates via centralized handler
    const unsubQueue = onQueueUpdate((payload) => {
      console.log('[SocketContext] Received queue:update:', payload);
      setLastQueueUpdate(payload);
    });

    return () => {
      unsubStatus();
      unsubQueue();
      socket.off('joined_queue', handleJoinedQueue);
      socket.off('error', handleSocketError);
    };
  }, []);

  /**
   * Subscribe to a specific procurement centre's live queue feed
   */
  const joinCentreQueue = useCallback((centreId) => {
    if (!centreId) return;
    socketJoinCentreQueue(centreId);
    setCurrentRoom(`centre_${centreId}`);
  }, []);

  /**
   * Unsubscribe from a centre's live queue feed
   */
  const leaveCentreQueue = useCallback((centreId) => {
    if (!centreId) return;
    socketLeaveCentreQueue(centreId);
    setCurrentRoom(null);
  }, []);

  const value = {
    socket: getSocket(),
    isConnected,
    currentRoom,
    lastQueueUpdate,
    socketError,
    joinCentreQueue,
    leaveCentreQueue,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;

