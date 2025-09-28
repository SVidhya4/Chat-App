const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require("socket.io");
const db = require('./config/db');

const chatRoutes = require('./routes/chat');
const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let onlineUsers = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // When a user logs in, they will emit this event
  socket.on('user-online', (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit('update-online-status', Object.keys(onlineUsers));
  });

  socket.on('join-room', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    let disconnectedUserId = null;
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        disconnectedUserId = userId;
        break;
      }
    }
    
    if (disconnectedUserId) {
      delete onlineUsers[disconnectedUserId];
      io.emit('update-online-status', Object.keys(onlineUsers));
      
      // ✨ New Logic: Update status in the database to 'Offline'
      try {
        await db.query("UPDATE users SET status = 'Offline', last_seen = NOW() WHERE id = ?", [disconnectedUserId]);
        console.log(`User ${disconnectedUserId} status updated to Offline.`);
      } catch (err) {
        console.error("Failed to update user status on disconnect:", err);
      }
    }
  });
});

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api', chatRoutes);

app.get('/', (req, res) => {
  res.send('Backend running!');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});