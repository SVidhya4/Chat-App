// backend/config/db.js

// ✨ Import the promise-wrapped version of mysql2
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Sri2004',
    database: 'chat_app',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;