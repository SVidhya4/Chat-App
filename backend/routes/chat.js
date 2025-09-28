const express = require("express");
const router = express.Router();

// ✨ Import the controller functions
const { 
  addUser, 
  getChatList, 
  getMessages, 
  sendMessage 
} = require('../controllers/chatController');

// ✨ Define routes and link them to controller functions
// ✨ These paths now match your frontend's fetch calls exactly
router.post('/add-user', addUser);
router.get('/chat-list/:userId', getChatList);
router.get('/messages/:conversationId', getMessages);
router.post('/send-message', sendMessage);

module.exports = router;