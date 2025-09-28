// backend/controllers/chatController.js

const chatModel = require('../models/chatModel');

const addUser = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const result = await chatModel.addUser(name);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add user' });
    }
};

const getChatList = async (req, res) => {
    try {
        const userId = req.params.userId;
        const result = await chatModel.getChatList(userId);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get chat list' });
    }
};

const getMessages = async (req, res) => {
    try {
        const conversationId = req.params.conversationId;
        const result = await chatModel.getMessages(conversationId);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get messages' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const io = req.io;
        const result = await chatModel.sendMessage(req.body);
        const messageId = result.insertId;
        const conversationId = req.body.conversation_id;

        const messageDetails = await chatModel.getMessageById(messageId);
        if (!messageDetails) {
            return res.status(500).json({ error: "Could not fetch message details." });
        }

        io.to(conversationId.toString()).emit('new-message', messageDetails);
        res.json(messageDetails);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

module.exports = { addUser, getChatList, getMessages, sendMessage };