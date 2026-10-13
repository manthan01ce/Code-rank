'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Singleton socket instance to prevent multiple connections across remounts
let globalSocket = null;
let refCount = 0;
let connectionAttempts = 0;

/**
 * useSocket
 * ---------
 * Singleton Socket.IO client hook for Admin and Faculty real-time synchronization.
 *
 * Features:
 *  - Shared single WebSocket connection across mounted components.
 *  - Automatic authentication handshake with JWT token, role, and userId.
 *  - Reconnection handling with exponential backoff.
 *  - Exposes `connected` status state for live indicator badges.
 *  - Clean reference counting: disconnects only when all consumers unmount.
 */
export function useSocket() {
  const [socket, setSocket] = useState(globalSocket);
  const [connected, setConnected] = useState(globalSocket ? globalSocket.connected : false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    refCount++;

    if (!globalSocket) {
      let token = null;
      let user = null;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token');
        try {
          const stored = localStorage.getItem('user');
          if (stored) user = JSON.parse(stored);
        } catch (e) {}
      }

      globalSocket = io(window.location.origin, {
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        auth: {
          token,
          role: user?.role,
          userId: user?.id,
        },
      });

      globalSocket.on('connect', () => {
        connectionAttempts = 0;
        if (mountedRef.current) {
          setConnected(true);
        }
      });

      globalSocket.on('connect_error', (error) => {
        connectionAttempts++;
        if (mountedRef.current) {
          setConnected(false);
        }
      });

      globalSocket.on('disconnect', () => {
        if (mountedRef.current) {
          setConnected(false);
        }
      });

      globalSocket.on('reconnect', () => {
        if (mountedRef.current) {
          setConnected(true);
        }
      });
    }

    if (mountedRef.current) {
      setSocket(globalSocket);
      setConnected(globalSocket.connected);
    }

    return () => {
      mountedRef.current = false;
      refCount--;
      if (refCount <= 0 && globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        refCount = 0;
        connectionAttempts = 0;
      }
    };
  }, []);

  if (socket) {
    socket.isConnected = connected;
  }

  return socket;
}

export default useSocket;
