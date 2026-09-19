const logger = require('../utils/logger');

/**
 * Queue & Real-Time Synchronization Socket Handler
 * Manages WebSocket rooms for mandis, tokens, and admin dashboards.
 */
const initQueueSocket = (io) => {
  io.on('connection', (socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);

    // Join Mandi Room (supports both mandi:<id> and centre_<id>)
    socket.on('join_mandi', (mandiId) => {
      if (!mandiId) return;
      const room = mandiId.startsWith('mandi:') ? mandiId : `mandi:${mandiId}`;
      socket.join(room);
      socket.join(`centre_${mandiId.replace('mandi:', '')}`);
      logger.info(`[Socket.IO] Socket ${socket.id} joined room ${room}`);
      socket.emit('joined_room', { room, message: `Connected to live telemetry for ${room}` });
    });

    // Legacy centre room support
    socket.on('join_centre_queue', (centreId) => {
      if (!centreId) return;
      const room = `centre_${centreId}`;
      socket.join(room);
      socket.join(`mandi:${centreId}`);
      logger.info(`[Socket.IO] Socket ${socket.id} joined room ${room}`);
      socket.emit('joined_queue', { centreId, room, message: `Joined live queue feed for centre ${centreId}` });
    });

    // Join Token Room for targeted farmer checkpoint updates
    socket.on('join_token', (tokenNumber) => {
      if (!tokenNumber) return;
      const room = tokenNumber.startsWith('token:') ? tokenNumber : `token:${tokenNumber}`;
      socket.join(room);
      logger.info(`[Socket.IO] Socket ${socket.id} joined token room ${room}`);
      socket.emit('joined_token_room', { room, tokenNumber });
    });

    // Join Admin Global Monitoring Room
    socket.on('join_admin', () => {
      const room = 'admin_room';
      socket.join(room);
      logger.info(`[Socket.IO] Socket ${socket.id} joined ${room}`);
      socket.emit('joined_admin_room', { room, timestamp: new Date().toISOString() });
    });

    // Leave rooms
    socket.on('leave_mandi', (mandiId) => {
      if (!mandiId) return;
      socket.leave(`mandi:${mandiId}`);
      socket.leave(`centre_${mandiId}`);
    });

    socket.on('leave_token', (tokenNumber) => {
      if (!tokenNumber) return;
      socket.leave(`token:${tokenNumber}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

/**
 * Broadcast new token booking across relevant rooms
 */
const broadcastNewBooking = (io, mandiId, token) => {
  if (!io) return;
  const payload = {
    event: 'NEW_BOOKING',
    mandiId,
    token,
    timestamp: new Date().toISOString()
  };

  // Broadcast to mandi room, centre room, admin room, and globally
  io.to(`mandi:${mandiId}`).emit('NEW_BOOKING', payload);
  io.to(`centre_${mandiId}`).emit('NEW_BOOKING', payload);
  io.to('admin_room').emit('NEW_BOOKING', payload);
  io.emit('NEW_BOOKING', payload); // Global broadcast for instant sync
  logger.info(`[Socket.IO] Broadcast NEW_BOOKING for token: ${token.tokenNumber || token.id} (Mandi: ${mandiId})`);
};

/**
 * Broadcast checkpoint stage progress update
 */
const broadcastStageUpdated = (io, tokenNumber, mandiId, updateData) => {
  if (!io) return;
  const payload = {
    event: 'STAGE_UPDATED',
    tokenNumber,
    mandiId,
    ...updateData,
    timestamp: new Date().toISOString()
  };

  // Broadcast to target token room, mandi room, admin room, and globally
  io.to(`token:${tokenNumber}`).emit('STAGE_UPDATED', payload);
  if (mandiId) {
    io.to(`mandi:${mandiId}`).emit('STAGE_UPDATED', payload);
    io.to(`centre_${mandiId}`).emit('STAGE_UPDATED', payload);
  }
  io.to('admin_room').emit('STAGE_UPDATED', payload);
  io.emit('STAGE_UPDATED', payload); // Global broadcast for connected clients
  logger.info(`[Socket.IO] Broadcast STAGE_UPDATED for token: ${tokenNumber} (Stage: ${updateData.stageId || updateData.stageIndex})`);
};

/**
 * Broadcast hardware event (boom barrier, weighbridge load cell)
 */
const broadcastHardwareEvent = (io, mandiId, hardwareData) => {
  if (!io) return;
  const payload = {
    event: 'HARDWARE_EVENT',
    mandiId,
    ...hardwareData,
    timestamp: new Date().toISOString()
  };

  io.to(`mandi:${mandiId}`).emit('HARDWARE_EVENT', payload);
  io.to('admin_room').emit('HARDWARE_EVENT', payload);
  io.emit('HARDWARE_EVENT', payload);
  logger.info(`[Socket.IO] Broadcast HARDWARE_EVENT: ${hardwareData.device || 'generic'} at Mandi: ${mandiId}`);
};

/**
 * Broadcast 500m proximity-based AgriPool micro-pooling opportunity to matched farmers
 */
const broadcastAgriPoolMatch = (io, matchData) => {
  if (!io) return;
  const payload = {
    event: 'AGRIPOOL_MATCH',
    ...matchData,
    timestamp: new Date().toISOString()
  };

  const mandiId = matchData.mandiId || 'KPG-01';
  const token1 = matchData.farmer1?.tokenNumber;
  const token2 = matchData.farmer2?.tokenNumber;

  if (token1) io.to(`token:${token1}`).emit('AGRIPOOL_MATCH', payload);
  if (token2) io.to(`token:${token2}`).emit('AGRIPOOL_MATCH', payload);
  io.to(`mandi:${mandiId}`).emit('AGRIPOOL_MATCH', payload);
  io.to('admin_room').emit('AGRIPOOL_MATCH', payload);
  io.emit('AGRIPOOL_MATCH', payload); // Broadcast for all active clients
  logger.info(`[Socket.IO] Broadcast AGRIPOOL_MATCH between ${token1} & ${token2} (${matchData.distanceMeters}m away)`);
};

/**
 * Broadcast final token completion and settlement
 */
const broadcastTokenCompleted = (io, tokenNumber, mandiId, tokenData) => {
  if (!io) return;
  const payload = {
    event: 'TOKEN_COMPLETED',
    tokenNumber,
    mandiId,
    token: tokenData,
    timestamp: new Date().toISOString()
  };

  io.to(`token:${tokenNumber}`).emit('TOKEN_COMPLETED', payload);
  if (mandiId) {
    io.to(`mandi:${mandiId}`).emit('TOKEN_COMPLETED', payload);
    io.to(`centre_${mandiId}`).emit('TOKEN_COMPLETED', payload);
  }
  io.to('admin_room').emit('TOKEN_COMPLETED', payload);
  io.emit('TOKEN_COMPLETED', payload);
  logger.info(`[Socket.IO] Broadcast TOKEN_COMPLETED for token: ${tokenNumber}`);
};

/**
 * Broadcast token cancellation event
 */
const broadcastTokenCancelled = (io, tokenNumber, mandiId, cancelData) => {
  if (!io) return;
  const payload = {
    event: 'TOKEN_CANCELLED',
    tokenNumber,
    mandiId,
    ...cancelData,
    timestamp: new Date().toISOString()
  };

  io.to(`token:${tokenNumber}`).emit('TOKEN_CANCELLED', payload);
  if (mandiId) {
    io.to(`mandi:${mandiId}`).emit('TOKEN_CANCELLED', payload);
    io.to(`centre_${mandiId}`).emit('TOKEN_CANCELLED', payload);
  }
  io.to('admin_room').emit('TOKEN_CANCELLED', payload);
  io.emit('TOKEN_CANCELLED', payload);
  logger.info(`[Socket.IO] Broadcast TOKEN_CANCELLED for token: ${tokenNumber} (Penalty: ₹${cancelData?.penaltyAmount || 0})`);
};

/**
 * Broadcast priority gate exit request from farmer to gate officer
 */
const broadcastGateExitRequested = (io, tokenNumber, mandiId, exitData) => {
  if (!io) return;
  const payload = {
    event: 'GATE_EXIT_REQUESTED',
    tokenNumber,
    mandiId,
    ...exitData,
    timestamp: new Date().toISOString()
  };

  io.to(`token:${tokenNumber}`).emit('GATE_EXIT_REQUESTED', payload);
  io.to(`token:${tokenNumber}`).emit('EXIT_REQUESTED', payload);
  if (mandiId) {
    io.to(`mandi:${mandiId}`).emit('GATE_EXIT_REQUESTED', payload);
    io.to(`mandi:${mandiId}`).emit('EXIT_REQUESTED', payload);
    io.to(`centre_${mandiId}`).emit('GATE_EXIT_REQUESTED', payload);
    io.to(`centre_${mandiId}`).emit('EXIT_REQUESTED', payload);
  }
  io.to('admin_room').emit('GATE_EXIT_REQUESTED', payload);
  io.to('admin_room').emit('EXIT_REQUESTED', payload);
  io.emit('GATE_EXIT_REQUESTED', payload);
  io.emit('EXIT_REQUESTED', payload);
  logger.info(`[Socket.IO] Broadcast GATE_EXIT_REQUESTED / EXIT_REQUESTED for token: ${tokenNumber} at Mandi: ${mandiId}`);
};

/**
 * Broadcast gate exit approval by officer
 */
const broadcastExitApproved = (io, tokenNumber, mandiId, exitData) => {
  if (!io) return;
  const payload = {
    event: 'EXIT_APPROVED',
    tokenNumber,
    mandiId,
    ...exitData,
    timestamp: new Date().toISOString()
  };

  io.to(`token:${tokenNumber}`).emit('EXIT_APPROVED', payload);
  io.to(`token:${tokenNumber}`).emit('GATE_EXIT_APPROVED', payload);
  if (mandiId) {
    io.to(`mandi:${mandiId}`).emit('EXIT_APPROVED', payload);
    io.to(`mandi:${mandiId}`).emit('GATE_EXIT_APPROVED', payload);
    io.to(`centre_${mandiId}`).emit('EXIT_APPROVED', payload);
    io.to(`centre_${mandiId}`).emit('GATE_EXIT_APPROVED', payload);
  }
  io.to('admin_room').emit('EXIT_APPROVED', payload);
  io.to('admin_room').emit('GATE_EXIT_APPROVED', payload);
  io.emit('EXIT_APPROVED', payload);
  io.emit('GATE_EXIT_APPROVED', payload);
  logger.info(`[Socket.IO] Broadcast EXIT_APPROVED for token: ${tokenNumber} at Mandi: ${mandiId}`);
};

/**
 * Broadcast farmer portfolio pending dues update
 */
const broadcastFarmerDuesUpdated = (io, phone, duesData) => {
  if (!io) return;
  const payload = {
    event: 'FARMER_DUES_UPDATED',
    phone,
    ...duesData,
    timestamp: new Date().toISOString()
  };

  io.to('admin_room').emit('FARMER_DUES_UPDATED', payload);
  io.emit('FARMER_DUES_UPDATED', payload);
  logger.info(`[Socket.IO] Broadcast FARMER_DUES_UPDATED for phone: ${phone} (Pending Dues: ₹${duesData?.pendingDues || 0})`);
};

/**
 * Broadcast queue slot freed event to pull subsequent trucks forward
 */
const broadcastQueueSlotFreed = (io, mandiId, queueData) => {
  if (!io) return;
  const payload = {
    event: 'QUEUE_SLOT_FREED',
    mandiId,
    ...queueData,
    timestamp: new Date().toISOString()
  };

  if (mandiId) {
    io.to(`mandi:${mandiId}`).emit('QUEUE_SLOT_FREED', payload);
    io.to(`centre_${mandiId}`).emit('QUEUE_SLOT_FREED', payload);
  }
  io.to('admin_room').emit('QUEUE_SLOT_FREED', payload);
  io.emit('QUEUE_SLOT_FREED', payload);
  logger.info(`[Socket.IO] Broadcast QUEUE_SLOT_FREED at Mandi: ${mandiId}`);
};

/**
 * Broadcast new Fast-Track Priority Request to staff and mandi room
 */
const broadcastFastTrackRequested = (io, mandiId, request) => {
  if (!io) return;
  const cleanMandiId = (mandiId || '').replace(/^mandi:/, '');
  const payload = {
    event: 'FAST_TRACK_NEW_REQUEST',
    mandiId: cleanMandiId,
    request,
    ...request,
    timestamp: new Date().toISOString()
  };

  if (cleanMandiId) {
    io.to(`mandi:${cleanMandiId}`).emit('FAST_TRACK_NEW_REQUEST', payload);
    io.to(`mandi:[${cleanMandiId}]`).emit('FAST_TRACK_NEW_REQUEST', payload);
    io.to(`centre_${cleanMandiId}`).emit('FAST_TRACK_NEW_REQUEST', payload);
    io.to(`mandi:${cleanMandiId}`).emit('FAST_TRACK_REQUESTED', payload);
    io.to(`centre_${cleanMandiId}`).emit('FAST_TRACK_REQUESTED', payload);
  }
  if (request.tokenNumber) {
    io.to(`token:${request.tokenNumber}`).emit('FAST_TRACK_NEW_REQUEST', payload);
    io.to(`token:${request.tokenNumber}`).emit('FAST_TRACK_REQUESTED', payload);
  }
  io.to('admin_room').emit('FAST_TRACK_NEW_REQUEST', payload);
  io.to('admin_room').emit('FAST_TRACK_REQUESTED', payload);
  io.emit('FAST_TRACK_NEW_REQUEST', payload);
  io.emit('FAST_TRACK_REQUESTED', payload);
  logger.info(`[Socket.IO] Broadcast FAST_TRACK_NEW_REQUEST for ${request.tokenNumber} (Mandi: ${cleanMandiId})`);
};

/**
 * Broadcast Fast-Track Approval
 */
const broadcastFastTrackApproved = (io, mandiId, tokenNumber, request, updatedToken) => {
  if (!io) return;
  const payload = {
    event: 'FAST_TRACK_APPROVED',
    mandiId,
    tokenNumber,
    request,
    token: updatedToken,
    timestamp: new Date().toISOString()
  };

  if (tokenNumber) {
    io.to(`token:${tokenNumber}`).emit('FAST_TRACK_APPROVED', payload);
  }
  if (mandiId) {
    io.to(`mandi:${mandiId}`).emit('FAST_TRACK_APPROVED', payload);
    io.to(`centre_${mandiId}`).emit('FAST_TRACK_APPROVED', payload);
  }
  io.to('admin_room').emit('FAST_TRACK_APPROVED', payload);
  io.emit('FAST_TRACK_APPROVED', payload);
  logger.info(`[Socket.IO] Broadcast FAST_TRACK_APPROVED for ${tokenNumber}`);
};

/**
 * Broadcast Fast-Track Rejection
 */
const broadcastFastTrackRejected = (io, mandiId, tokenNumber, request) => {
  if (!io) return;
  const payload = {
    event: 'FAST_TRACK_REJECTED',
    mandiId,
    tokenNumber,
    request,
    timestamp: new Date().toISOString()
  };

  if (tokenNumber) {
    io.to(`token:${tokenNumber}`).emit('FAST_TRACK_REJECTED', payload);
  }
  if (mandiId) {
    io.to(`mandi:${mandiId}`).emit('FAST_TRACK_REJECTED', payload);
    io.to(`centre_${mandiId}`).emit('FAST_TRACK_REJECTED', payload);
  }
  io.to('admin_room').emit('FAST_TRACK_REJECTED', payload);
  io.emit('FAST_TRACK_REJECTED', payload);
  logger.info(`[Socket.IO] Broadcast FAST_TRACK_REJECTED for ${tokenNumber}`);
};

/** Legacy queue update helper */
const broadcastQueueUpdate = (io, centreId, queueData) => {
  if (!io) return;
  const room = `centre_${centreId}`;
  io.to(room).emit('queue:update', {
    centreId,
    updatedAt: new Date().toISOString(),
    ...queueData
  });
};

module.exports = {
  initQueueSocket,
  broadcastNewBooking,
  broadcastStageUpdated,
  broadcastHardwareEvent,
  broadcastAgriPoolMatch,
  broadcastTokenCompleted,
  broadcastTokenCancelled,
  broadcastGateExitRequested,
  broadcastExitApproved,
  broadcastFarmerDuesUpdated,
  broadcastQueueSlotFreed,
  broadcastFastTrackRequested,
  broadcastFastTrackApproved,
  broadcastFastTrackRejected,
  broadcastQueueUpdate
};
