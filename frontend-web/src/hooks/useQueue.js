import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { queueApi } from '../api/queue.api';

/**
 * Custom hook to automatically connect to a centre's queue room,
 * fetch initial queue state, and update on live socket broadcasts.
 */
export const useQueue = (centreId, date) => {
  const { isConnected, lastQueueUpdate, joinCentreQueue, leaveCentreQueue } = useSocket();
  const [queueState, setQueueState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial queue snapshot
  const fetchQueue = useCallback(async () => {
    if (!centreId) return;
    try {
      setIsLoading(true);
      const res = await queueApi.getLiveQueue(centreId, date);
      setQueueState(res.data || res);
      setError(null);
    } catch (err) {
      console.warn('[useQueue] Failed to fetch live queue', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [centreId, date]);

  // Join room on mount or centreId change
  useEffect(() => {
    if (!centreId) return;

    fetchQueue();
    joinCentreQueue(centreId);

    return () => {
      leaveCentreQueue(centreId);
    };
  }, [centreId, date, fetchQueue, joinCentreQueue, leaveCentreQueue]);

  // Listen for socket updates targeted to this centre
  useEffect(() => {
    if (lastQueueUpdate && String(lastQueueUpdate.centreId) === String(centreId)) {
      setQueueState((prev) => ({
        ...prev,
        ...lastQueueUpdate,
        lastUpdated: lastQueueUpdate.updatedAt || new Date().toISOString(),
      }));
    }
  }, [lastQueueUpdate, centreId]);

  return {
    queueState,
    isLoading,
    error,
    refetch: fetchQueue,
    isLive: isConnected,
  };
};

export default useQueue;
