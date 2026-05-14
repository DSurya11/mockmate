import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import logger from '../config/logger';

interface RoomUser {
  socketId: string;
  userId: string;
  name: string;
  role: string;
}

const rooms = new Map<string, RoomUser[]>();

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

export function setupSocketHandlers(io: SocketServer) {
  // Auth middleware for sockets
  io.use((socket, next) => {
    const headerToken = socket.handshake.auth?.token;
    const cookies = parseCookies(socket.handshake.headers.cookie as string | undefined);
    const cookieToken = cookies[config.cookies.accessName];
    const token = headerToken || cookieToken;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.info({ userId: user.id, socketId: socket.id }, 'Socket connected');

    // Join interview room
    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);
      const roomUser: RoomUser = {
        socketId: socket.id, userId: user.id, name: user.name, role: user.role,
      };

      if (!rooms.has(roomId)) rooms.set(roomId, []);
      const roomUsers = rooms.get(roomId)!;
      roomUsers.push(roomUser);

      // Notify others in the room
      socket.to(roomId).emit('user-joined', { userId: user.id, name: user.name, role: user.role });
      socket.emit('room-users', roomUsers.filter(u => u.socketId !== socket.id));

      logger.info({ userId: user.id, roomId }, 'User joined room');
    });

    // WebRTC Signaling
    socket.on('offer', ({ roomId, offer, targetUserId }) => {
      socket.to(roomId).emit('offer', { offer, userId: user.id, name: user.name });
    });

    socket.on('answer', ({ roomId, answer, targetUserId }) => {
      socket.to(roomId).emit('answer', { answer, userId: user.id });
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('ice-candidate', { candidate, userId: user.id });
    });

    // Chat messages
    socket.on('chat-message', ({ roomId, message }) => {
      io.to(roomId).emit('chat-message', {
        userId: user.id, name: user.name, message, timestamp: new Date().toISOString(),
      });
    });

    // Live transcript updates
    socket.on('transcript-update', ({ roomId, text, isFinal }) => {
      socket.to(roomId).emit('transcript-update', {
        userId: user.id, name: user.name, text, isFinal,
      });
    });

    // Interview control events
    socket.on('next-question', ({ roomId, questionIndex }) => {
      io.to(roomId).emit('next-question', { questionIndex });
    });

    socket.on('interview-end', ({ roomId }) => {
      io.to(roomId).emit('interview-ended');
    });

    // Leave room
    socket.on('leave-room', (roomId: string) => {
      handleLeaveRoom(socket, roomId, user, io);
    });

    socket.on('disconnect', () => {
      // Remove from all rooms
      rooms.forEach((users, roomId) => {
        handleLeaveRoom(socket, roomId, user, io);
      });
      logger.info({ userId: user.id }, 'Socket disconnected');
    });
  });
}

function handleLeaveRoom(socket: Socket, roomId: string, user: any, io: SocketServer) {
  socket.leave(roomId);
  const roomUsers = rooms.get(roomId);
  if (roomUsers) {
    const index = roomUsers.findIndex(u => u.socketId === socket.id);
    if (index !== -1) roomUsers.splice(index, 1);
    if (roomUsers.length === 0) rooms.delete(roomId);
    else io.to(roomId).emit('user-left', { userId: user.id, name: user.name });
  }
}
