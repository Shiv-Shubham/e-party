const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth.js');
const dotenv = require('dotenv');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

dotenv.config();
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB connected"))
.catch(err => console.error(err));


// Message schema
const messageSchema = new mongoose.Schema({
  from: String,
  to: {
    type: String,
    default: "all"
  },
  msg: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model("Message", messageSchema);
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/home.html');
});

// Middleware

app.use(express.json());
app.use(express.static('public'));
app.use('/auth', authRoutes);

let users = {};
let sockets = {};

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); 
    socket.username = decoded.username;
    socket.role = decoded.role;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const username = socket.username;
  users[username] = socket.id;
  sockets[socket.id] = username;

  console.log(`${username} connected`);

  io.emit("systemMessage", `${username} joined the chat`);
  io.emit("userList", Object.keys(users));

  // Group chat
  socket.on("chatMessage", async (msg) => {
    const from = sockets[socket.id] || "Anonymous";
    const message = new Message({ from, to: "all", msg });
    await message.save();

    io.emit("chatMessage", {
      from,
      msg,
      timestamp: message.timestamp
    });
  });

  // Private chat
  socket.on("privateMessage", async ({ to, msg }) => {
    const from = sockets[socket.id];
    const targetSocketId = users[to];
    const message = new Message({ from, to, msg });
    await message.save();

    if (targetSocketId) {
      io.to(targetSocketId).emit("privateMessage", {
        from,
        msg,
        timestamp: message.timestamp,
      });
    }
    socket.emit("privateMessage", {
      from,
      msg,
      timestamp: message.timestamp,
      to,
      self: true,
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const username = sockets[socket.id];
    if (username) {
      delete users[username];
      delete sockets[socket.id];
      io.emit("systemMessage", `${username} left the chat`);
      io.emit("userList", Object.keys(users));
    }
    console.log("user disconnected:", socket.id);
  });
  socket.on("removeUser", ({ target }) => {
  if (socket.role !== "admin") {
    socket.emit("systemMessage", "You are not authorized to remove users.");
    return;
  }

  const targetSocketId = users[target];
  if (targetSocketId) {
    io.to(targetSocketId).emit("forceLogout", "You have been removed by admin.");
    io.sockets.sockets.get(targetSocketId)?.disconnect(true);

    delete users[target];
    delete sockets[targetSocketId];
    io.emit("systemMessage", `${target} was removed by admin.`);
    io.emit("userList", Object.keys(users));
  }
});
});

server.listen(process.env.PORT, () => console.log("server started at ",process.env.PORT));
