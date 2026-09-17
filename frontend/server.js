import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Attach io to global so API routes can access it
  global.io = io;

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join a specific practical room for real-time updates
    socket.on('join_practical_room', (practicalId) => {
      const room = `practical_${practicalId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on('leave_practical_room', (practicalId) => {
      const room = `practical_${practicalId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left room ${room}`);
    });

    socket.on('join_course_room', (courseId) => {
      const room = `course_${courseId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on('leave_course_room', (courseId) => {
      const room = `course_${courseId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left room ${room}`);
    });

    socket.on('faculty_practical_added', (data) => {
      // Emit to the specific course room
      io.to(`course_${data.course_id}`).emit('practical_added', data.practical);
      // Also broadcast globally so all students in the Workspace receive it
      io.emit('practical_added', data.practical);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> CodeRank Server ready:`);
      console.log(`  - Local:   http://localhost:${port}`);
      console.log(`  - Network: http://${hostname === '0.0.0.0' ? '0.0.0.0' : hostname}:${port}`);
    });
});
