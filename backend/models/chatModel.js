const db = require('../config/db');

// In models/chatModel.js

const getChatList = async (userId) => {
    const sql = `
    SELECT
        c.id AS conversation_id,
        c.created_at,
        c.is_group,
        
        CASE
            WHEN c.is_group = 0
            THEN (SELECT u.id
                  FROM conversation_members cm2
                  JOIN users u ON cm2.user_id = u.id
                  WHERE cm2.conversation_id = c.id AND u.id != ?
                  LIMIT 1)
            ELSE NULL
        END AS user_id,

        CASE 
            WHEN c.is_group = 0 
            THEN (SELECT u.name 
                  FROM conversation_members cm2
                  JOIN users u ON cm2.user_id = u.id
                  WHERE cm2.conversation_id = c.id AND u.id != ?)
            ELSE c.name
        END AS conversation_name,
        (SELECT u.profile_pic
         FROM conversation_members cm2
         JOIN users u ON cm2.user_id = u.id
         WHERE cm2.conversation_id = c.id AND u.id != ?
         LIMIT 1) AS profile_pic,
        (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.timestamp DESC LIMIT 1) AS last_message,
        (SELECT m.timestamp FROM messages m WHERE m.conversation_id = c.id ORDER BY m.timestamp DESC LIMIT 1) AS last_message_time
    FROM
        conversations c
    JOIN
        conversation_members cm ON c.id = cm.conversation_id
    WHERE
        cm.user_id = ?
    ORDER BY
        c.is_group DESC, 
        COALESCE(last_message_time, c.created_at) DESC
    `;
    const [rows] = await db.query(sql, [userId, userId, userId, userId]);
    return rows;
};

const getMessages = async (conversationId) => {
    const convSql = 'SELECT is_group FROM conversations WHERE id = ?';
    const [convRows] = await db.query(convSql, [conversationId]);
    if (convRows.length === 0) throw new Error('Conversation not found');
    const is_group = convRows[0].is_group;

    // ✨ Updated SQL with LEFT JOIN and IF statements
    const messagesSql = `
        SELECT
            m.id,
            m.sender_id,
            IF(m.sender_id = 0, 'Anonymous', u.name) AS sender_name,
            IF(m.sender_id = 0, 'uploads/profile/Anonymous.png', u.profile_pic) AS profile_pic,
            m.content,
            m.type,
            m.timestamp
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.timestamp ASC
    `;
    const [messages] = await db.query(messagesSql, [conversationId]);
    return { messages, is_group };
};

const sendMessage = async (data) => {
    const { conversation_id, sender_id, content, type } = data;
    const sql = `INSERT INTO messages (conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?)`;
    const [result] = await db.query(sql, [conversation_id, sender_id, content, type || 'text']);
    return result;
};

const getMessageById = async (messageId) => {
  const sql = `
    SELECT
        m.id,
        m.sender_id,
        IF(m.sender_id = 0, 'Anonymous', u.name) AS sender_name,
        IF(m.sender_id = 0, 'uploads/profile/Anonymous.png', u.profile_pic) AS profile_pic,
        m.content,
        m.type,
        m.timestamp
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.id = ?
  `;
  const [rows] = await db.query(sql, [messageId]);
  return rows[0];
};

const addUser = async (name) => {
    const [existingUsers] = await db.query('SELECT id, name, profile_pic FROM users WHERE name = ?', [name]);
    
    if (existingUsers.length > 0) {
        // --- LOGIC FOR EXISTING USERS ---
        const loggedInUser = existingUsers[0];

        // ✨ New Logic: Update the user's status and last_seen timestamp
        await db.query("UPDATE users SET status = 'Online', last_seen = NOW() WHERE id = ?", [loggedInUser.id]);
        
        const findMissingChatsSql = `
            SELECT id FROM users other_user
            WHERE other_user.id != ? AND NOT EXISTS (
                SELECT 1 FROM conversation_members m1
                JOIN conversation_members m2 ON m1.conversation_id = m2.conversation_id
                JOIN conversations c ON m1.conversation_id = c.id
                WHERE c.is_group = 0 AND ((m1.user_id = ? AND m2.user_id = other_user.id) OR (m1.user_id = other_user.id AND m2.user_id = ?))
            );
        `;
        const [usersToCreateChatsWith] = await db.query(findMissingChatsSql, [loggedInUser.id, loggedInUser.id, loggedInUser.id]);
        if (usersToCreateChatsWith.length > 0) {
            const chatCreationPromises = usersToCreateChatsWith.map(async (user) => {
                const [convResult] = await db.query('INSERT INTO conversations (is_group) VALUES (0)');
                const conversationId = convResult.insertId;
                await db.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [conversationId, loggedInUser.id, conversationId, user.id]);
            });
            await Promise.all(chatCreationPromises);
        }
        
        return { user: { ...loggedInUser, message: 'Logged in successfully!' } };
    }

    // --- LOGIC FOR BRAND NEW USERS ---
    
    // ✨ New Logic: Insert the new user with an initial 'Online' status
    const [result] = await db.query(
        "INSERT INTO users (name, profile_pic, status, last_seen) VALUES (?, ?, 'Online', NOW())",
        [name, 'uploads/profile/default.png']
    );
    const newUserId = result.insertId;
    const [otherUsers] = await db.query('SELECT id FROM users WHERE id != ?', [newUserId]);

    let [groupRows] = await db.query('SELECT id FROM conversations WHERE name = ? AND is_group = 1', ['Fun Friday Group']);
    let groupId;
    if (groupRows.length === 0) {
        const [groupRes] = await db.query('INSERT INTO conversations (name, is_group) VALUES (?, 1)', ['Fun Friday Group']);
        groupId = groupRes.insertId;
    } else {
        groupId = groupRows[0].id;
    }
    await db.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', [groupId, newUserId]);

    const newUserObject = { id: newUserId, name, profile_pic: 'uploads/profile/default.png' };

    if (otherUsers.length > 0) {
        const chatCreationPromises = otherUsers.map(async (user) => {
            const [convResult] = await db.query('INSERT INTO conversations (is_group) VALUES (0)');
            const conversationId = convResult.insertId;
            await db.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [conversationId, newUserId, conversationId, user.id]);
        });
        await Promise.all(chatCreationPromises);
    }
    
    return { user: { ...newUserObject, message: 'New user created!' } };
};

module.exports = { getChatList, getMessages, sendMessage, addUser, getMessageById };