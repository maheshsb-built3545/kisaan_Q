const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

/**
 * Queue & Real-Time Synchronization Socket Handler
 * Manages WebSocket rooms for mandis, tokens, and admin dashboards with JWT security.
 */
const initQueueSocket = (io) => {
  // Handshake Authentication Middleware
  io.use((socket, next) => {
    const rawToken = socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
      socket.handshake.query?.token;

    if (!rawToken) {
      // Unauthenticated socket: allowed for public telemetry boards only
      socket.user = null;
      socket.isAuthenticated = false;
      return next();
    }

    try {
      const decoded = jwt.verify(rawToken, JWT_SECRET);

      // Reject intermediate OTP or 2FA challenge tokens (only fully authenticated tokens accepted)
      if (decoded.isTwoFactorPending || decoded.challengeToken || decoded.isPending2FA || decoded.otp) {
        return next(new Error('Authentication failed: Intermediate 2FA tokens are not authorized for socket sessions.'));
      }

      socket.user = decoded;
      socket.isAuthenticated = true;
      return next();
    } catch (err) {
      logger.warn(`[Socket.IO Auth] Handshake token verification failed: ${err.message}`);
      return next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id} (Authenticated: ${socket.isAuthenticated}, User: ${socket.user?.name || 'Guest'})`);

    // Public Mandi Telemetry Room (Unauthenticated permitted)
    socket.on('join_mandi', (mandiId) => {
      if (!mandiId) return;
      const cleanMandi = mandiId.toString().replace(/^mandi:/, '');
      socket.join(`mandi:${cleanMandi}`);
      socket.join(`centre_${cleanMandi}`);
      logger.info(`[Socket.IO] Socket ${socket.id} joined public telemetry room mandi:${cleanMandi}`);
      socket.emit('joined_room', { room: `mandi:${cleanMandi}`, message: `Connected to live telemetry for mandi:${cleanMandi}` });
    });

    // Public Legacy Centre Queue Feed
    socket.on('join_centre_queue', (centreId) => {
      if (!centreId) return;
      const cleanCentre = centreId.toString().replace(/^centre_/, '');
      socket.join(`centre_${cleanCentre}`);
      socket.join(`mandi:${cleanCentre}`);
      socket.emit('joined_queue', { centreId: cleanCentre, room: `centre_${cleanCentre}`, message: `Joined live queue feed for centre ${cleanCentre}` });
    });

    // Public Token Room (for checkpoint HUD / tracking)
    socket.on('join_token', (tokenNumber) => {
      if (!tokenNumber) return;
      const cleanToken = tokenNumber.toString().replace(/^token:/, '');
      socket.join(`token:${cleanToken}`);
      socket.emit('joined_token_room', { room: `token:${cleanToken}`, tokenNumber: cleanToken });
    });

    // Private Personal User Room (Farmer or Staff personal notifications)
    socket.on('join_user', (targetUserId) => {
      if (!socket.isAuthenticated || !socket.user) {
        logger.warn(`[Socket.IO Auth] Unauthenticated socket ${socket.id} attempted to join private user room: ${targetUserId}`);
        socket.emit('error:unauthorized', { message: 'Authentication required to join private user notification room' });
        return;
      }

      const currentUserId = (socket.user.id || socket.user.staffId || socket.user._id || socket.user.phone || '').toString();
      const currentUserPhone = (socket.user.phone || '').toString();
      const requestedId = (targetUserId || '').toString();

      // Authorization guard: user can ONLY join their own personal room
      if (requestedId !== currentUserId && requestedId !== currentUserPhone) {
        logger.warn(`[Socket.IO Auth] User ${currentUserId} forbidden from joining other farmer room ${requestedId}`);
        socket.emit('error:forbidden', { message: 'Access denied: Cannot join notification room of another user' });
        return;
      }

      const room = `user:${requestedId}`;
      socket.join(room);
      logger.info(`[Socket.IO] Socket ${socket.id} joined verified user room ${room}`);
      socket.emit('joined_user_room', { room, userId: requestedId });
    });

    // Private Staff Centre-Role Room
    socket.on('join_staff_role', (data) => {
      if (!socket.isAuthenticated || !socket.user) {
        logger.warn(`[Socket.IO Auth] Unauthenticated socket ${socket.id} attempted to join staff room`);
        socket.emit('error:unauthorized', { message: 'Authentication required for staff operational rooms' });
        return;
      }

      const userRole = socket.user.role;
      const userCentre = socket.user.assignedMandi || socket.user.mandiId || socket.user.centreId;
      const requestedRole = typeof data === 'object' && data !== null ? data.role : data;
      const requestedCentre = typeof data === 'object' && data !== null ? data.centreId : userCentre;

      // District Admin Room
      if (userRole === 'district_admin' || requestedRole === 'district_admin') {
        if (userRole !== 'district_admin') {
          socket.emit('error:forbidden', { message: 'Only district administrators can join district_admin room' });
          return;
        }
        socket.join('district_admin');
        socket.join('admin_room');
        logger.info(`[Socket.IO] Socket ${socket.id} (District Admin) joined district_admin room`);
        socket.emit('joined_staff_room', { room: 'district_admin' });
        return;
      }

      // Check Centre Scope: Shirdi supervisor cannot join Kopargaon room
      if (requestedCentre && userCentre && requestedCentre !== userCentre && userRole !== 'district_admin') {
        logger.warn(`[Socket.IO Auth] Supervisor ${socket.user.name} (${userCentre}) rejected from centre ${requestedCentre}`);
        socket.emit('error:forbidden', { message: `Access denied: Duty station is ${userCentre}, cannot access ${requestedCentre}` });
        return;
      }

      const effectiveRole = requestedRole || userRole;
      const effectiveCentre = requestedCentre || userCentre;

      if (effectiveCentre && effectiveRole) {
        const room = `centre:${effectiveCentre}:role:${effectiveRole}`;
        socket.join(room);
        logger.info(`[Socket.IO] Socket ${socket.id} joined centre-scoped room ${room}`);
        socket.emit('joined_staff_room', { room, centreId: effectiveCentre, role: effectiveRole });
      }
    });

    // Join Admin Room (Restricted to district_admin)
    socket.on('join_admin', () => {
      if (socket.user?.role === 'district_admin') {
        socket.join('district_admin');
        socket.join('admin_room');
        socket.emit('joined_admin_room', { room: 'district_admin' });
      } else {
        socket.emit('error:forbidden', { message: 'District administrator privileges required' });
      }
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
