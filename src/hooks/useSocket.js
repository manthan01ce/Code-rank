'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    // Use the same origin since we're running socket.io on the same Node server
    const socketInstance = io(window.location.origin, {
      reconnectionDelayMax: 10000,
    });

    setSocket(socketInstance);

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);

  return socket;
}
