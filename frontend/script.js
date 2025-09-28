// -------------------------
// DOM Elements
// -------------------------
const chatApp = document.querySelector(".chat-app");
const chatListContainer = document.getElementById("chat-list-items");
const chatListPanel = document.querySelector(".chat-list");
const leftPanel = document.querySelector(".left-panel");
const rightPanel = document.querySelector(".right-panel");
const chatScreen = document.querySelector(".chat-screen");
const chatTitle = document.getElementById("chat-title");
const chatMessages = document.getElementById("chat-messages");
const sendBtn = document.getElementById("send-btn");
const messageInput = document.getElementById("message-input");
const backBtn = document.querySelector(".back-btn");
const divider = document.querySelector(".divider");
const profileAvatar = document.getElementById("profile-avatar");
const headerAvatar = document.getElementById("header-avatar");
const anonymousToggleBtn = document.getElementById("Anonymous-toggle-btn");
const anonymousNote = document.getElementById("Anonymous-note");
// -------------------------
// Global State
// -------------------------
let userId = null;
let userName = null;
let activeConversationId = null;
let lastMessageDate = null;
let isCurrentChatGroup = false;
let isAnonymous = false;
let onlineUsers = [];

const socket = io("http://localhost:3000");
socket.on("connect", () => {
  console.log("Connected to the server with socket ID:", socket.id);
});

socket.on("update-online-status", (users) => {
  onlineUsers = users;
  if (userId) {
    loadChatList();
    if (activeConversationId) {
      openConversation(
        activeConversationId,
        chatTitle.textContent,
        headerAvatar.src
      );
    }
  }
});

socket.on("new-message", (msg) => {
  if (
    msg.conversation_id === activeConversationId &&
    (msg.sender_id !== userId || (msg.sender_id === 0 && !isAnonymous))
  ) {
    appendMessage(msg);
    scrollToBottom();
  }
  loadChatList();
});
// -------------------------
// Main Functions
// -------------------------
async function promptLogin() {
  let name = prompt("Please enter your name to join:");
  if (!name) return promptLogin();
  try {
    const response = await fetch("http://localhost:3000/api/add-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Server responded with an error");
    }
    const data = await response.json();
    const user = data.user;
    userId = user.id;
    userName = user.name;
    socket.emit("user-online", userId);
    if (user.profile_pic) {
      profileAvatar.src = `http://localhost:3000/${user.profile_pic}`;
    }
    console.log(user.message);
    if (!userId) {
      alert("Login failed: Could not determine a valid user ID.");
      return;
    }
    await loadChatList();
  } catch (err) {
    console.error("Login error:", err);
    alert("Could not log in. Please check the console and try again.");
  }
}

function formatTimestamp(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function loadChatList() {
  if (!userId) return;
  try {
    const response = await fetch(
      `http://localhost:3000/api/chat-list/${userId}`
    );
    const chats = await response.json();

    chatListContainer.innerHTML = "";
    chats.forEach((chat) => {
      const chatItem = document.createElement("div");
      chatItem.className = "chat-item";

      if (chat.is_group === 0) {
        // is_group is 0 for 1-on-1 chats
        const userIsOnline = onlineUsers.includes(chat.user_id?.toString());
        if (userIsOnline) {
          chatItem.classList.add("online");
        }
      }
      chatItem.innerHTML = `
                <div class="avatar-container">
                    <img src="http://localhost:3000/${
                      chat.profile_pic || "uploads/profile/default.png"
                    }" class="chat-avatar" alt="Avatar"/>
                    <div class="status-dot"></div>
                </div>
                <div class="chat-details">
                    <div class="chat-details-top">
                        <h3 class="chat-name">${chat.conversation_name}</h3>
                        <span class="chat-timestamp">${formatTimestamp(
                          chat.last_message_time
                        )}</span>
                    </div>
                    <div class="chat-details-bottom">
                        <p class="chat-last-message">${
                          chat.last_message || "No messages yet"
                        }</p>
                    </div>
                </div>
            `;
      chatItem.addEventListener("click", () => {
        openConversation(
          chat.conversation_id,
          chat.conversation_name,
          chat.profile_pic
        );
      });
      chatListContainer.appendChild(chatItem);
    });
  } catch (err) {
    console.error("Error loading chat list:", err);
  }
}

async function openConversation(conversationId, name, avatarUrl) {
  chatScreen.classList.add("conversation-active");
  activeConversationId = conversationId;
  chatTitle.textContent = name;

  if (avatarUrl) {
    headerAvatar.src = `http://localhost:3000/${avatarUrl}`;
  } else {
    headerAvatar.src = "avatar-group.png"; // Fallback to a default
  }

  chatMessages.innerHTML = "";
  lastMessageDate = null;
  messageInput.disabled = false;
  messageInput.placeholder = "Type a message...";
  messageInput.focus();
  if (window.innerWidth <= 480) {
    chatScreen.classList.add("active");
  }
  socket.emit("join-room", activeConversationId);
  try {
    const response = await fetch(
      `http://localhost:3000/api/messages/${conversationId}`
    );
    const data = await response.json();
    isCurrentChatGroup = data.is_group;
    data.messages.forEach((msg) => appendMessage(msg));
    scrollToBottom();
  } catch (err) {
    console.error("Error loading messages:", err);
  }
}

function formatDateHeader(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const paddedMonth = month < 10 ? "0" + month : month;
  return `${day}/${paddedMonth}/${year}`;
}

function appendMessage(msg) {
  const messageDate = new Date(msg.timestamp).toDateString();
  if (messageDate !== lastMessageDate) {
    const dateEl = document.createElement("div");
    dateEl.className = "date-separator";
    dateEl.textContent = formatDateHeader(msg.timestamp);
    chatMessages.appendChild(dateEl);
    lastMessageDate = messageDate;
  }
  const msgEl = document.createElement("div");
  const isSent = msg.sender_id === userId;
  msgEl.classList.add("message", isSent ? "sent" : "received");
  let avatarHtml = "";
  if (isCurrentChatGroup && !isSent) {
    const senderIsOnline = onlineUsers.includes(msg.sender_id.toString());
    avatarHtml = `
        <div class="avatar-container ${senderIsOnline ? "online" : ""}">
            <img src="http://localhost:3000/${
              msg.profile_pic || "uploads/profile/default.png"
            }" class="message-avatar" alt="Avatar"/>
            <div class="status-dot"></div>
        </div>
    `;
  }
  let senderNameHtml = "";
  if (isCurrentChatGroup && !isSent) {
    senderNameHtml = `<div class="sender-name">${msg.sender_name}</div>`;
  }
  msgEl.innerHTML = `
        ${avatarHtml}
        <div class="message-bubble">
            ${senderNameHtml}
            <div class="message-content">${msg.content}</div>
            <div class="message-info">
                <span class="timestamp">${formatTimestamp(msg.timestamp)}</span>
                ${
                  isSent
                    ? '<img src="assets/double-tick.svg" class="status-tick" alt="Delivered"/>'
                    : ""
                }
            </div>
        </div>
    `;
  chatMessages.appendChild(msgEl);
}

async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !activeConversationId) return;
  const messageContent = content;
  messageInput.value = "";
  try {
    const response = await fetch("http://localhost:3000/api/send-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: activeConversationId,
        sender_id: isAnonymous ? 0 : userId,
        content: messageContent,
      }),
    });
    if (!response.ok) throw new Error("Failed to send message");
    const newMessage = await response.json();
  } catch (err) {
    console.error("Error sending message:", err);
    messageInput.value = messageContent;
  }
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// -------------------------
// Event Listeners & Layout
// -------------------------
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
backBtn.addEventListener("click", () => {
  chatScreen.classList.remove("active");
  activeConversationId = null;
});

anonymousToggleBtn.addEventListener("click", () => {
  isAnonymous = !isAnonymous;

  const toggleImg = anonymousToggleBtn.querySelector("img");
  const noteImages = document.querySelectorAll(".Anonymous-note .note-image");

  if (isAnonymous) {
    // Change to "active" state
    anonymousToggleBtn.classList.add("active");
    anonymousNote.hidden = false;
    toggleImg.src = "assets/Anonymous-filled.svg";
    anonymousNote.hidden = false;
  } else {
    // Change back to default state
    anonymousToggleBtn.classList.remove("active");
    anonymousNote.hidden = true;
    toggleImg.src = "assets/Group 1261156928.svg";
    anonymousNote.hidden = true;
  }
});

// Layout, Resizing, & Initialisation
let isResizing = false;

// Divider drag logic (desktop only)
divider.addEventListener("mousedown", () => {
  if (window.innerWidth <= 480) return;
  isResizing = true;
  document.body.style.cursor = "ew-resize";
});

document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;
  const newWidth = Math.max(220, Math.min(e.clientX, window.innerWidth - 200));
  chatListPanel.style.flex = `0 0 ${newWidth}px`;
});

document.addEventListener("mouseup", () => {
  isResizing = false;
  document.body.style.cursor = "";
});

promptLogin();
