'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { browserSocketAuth } from '../lib/browser-socket-auth.js';

// Singleton socket to prevent multiple connections across component remounts
let globalSocket = null;
let refCount = 0;
let connectionAttempts = 0;

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    refCount++;

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(process.env.NEXT_PUBLIC_REALTIME_URL || window.location.origin, {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        auth: (callback) => callback(browserSocketAuth(localStorage)),
      });

      // Connection event handlers for debugging and state tracking
      globalSocket.on('connect', () => {
        console.log(`[Socket.IO] Connected: ${globalSocket.id}`);
        connectionAttempts = 0;
        if (mountedRef.current) {
          setConnected(true);
        }
      });

      globalSocket.on('connect_error', (error) => {
        connectionAttempts++;
        console.warn(`[Socket.IO] Connection error (attempt ${connectionAttempts}):`, error);
      });

      globalSocket.on('disconnect', (reason) => {
        console.log(`[Socket.IO] Disconnected (reason: ${reason})`);
        if (mountedRef.current) {
          setConnected(false);
        }
      });

      globalSocket.on('reconnect', () => {
        console.log(`[Socket.IO] Reconnected: ${globalSocket.id}`);
        if (mountedRef.current) {
          setConnected(true);
        }
      });

      globalSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`[Socket.IO] Reconnection attempt #${attemptNumber}`);
      });
    }

    if (mountedRef.current) {
      setSocket(globalSocket);
      setConnected(globalSocket.connected);
    }

    return () => {
      mountedRef.current = false;
      refCount--;
      // Only disconnect if no more consumers
      if (refCount <= 0 && globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        refCount = 0;
        connectionAttempts = 0;
      }
    };
  }, []);

  // Expose connected state on socket object for easy access
  if (socket && !socket.isConnected) {
    socket.isConnected = connected;
  }

  return socket;
}
