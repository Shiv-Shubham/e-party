// Retrieve token and username from localStorage
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');
const role = localStorage.getItem('role');

if (!token) {
  alert("Please login first");
  window.location.href = "/home.html";
}
const socket = io({ auth: { token } });

const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const usersList = document.getElementById("users");
const recipientSelect = document.getElementById("recipient");

// Logout functionality
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  socket.disconnect();
  window.location.href = "/home.html";
});

// Helper to format time
function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Confetti animation
function launchConfetti() {
  const confettiContainer = document.createElement("div");
  confettiContainer.className = "confetti";
  messages.parentNode.appendChild(confettiContainer);
  for (let i = 0; i < 30; i++) {
    const dot = document.createElement("div");
    dot.className = "confetti-dot";
    dot.style.left = Math.random() * 100 + "%";
    dot.style.top = Math.random() * 20 + "%";
    dot.style.background = `radial-gradient(circle, #${Math.floor(Math.random()*16777215).toString(16)} 60%, #ffb86c 100%)`;
    confettiContainer.appendChild(dot);
  }
  setTimeout(() => confettiContainer.remove(), 1800);
}

// Add message to UI
function addMessage(text, cssClass) {
  const item = document.createElement("li");
  item.className = cssClass;
  item.textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
  launchConfetti();
}

// Send message
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    const recipient = recipientSelect.value;
    if (recipient === "all") {
      socket.emit("chatMessage", input.value);
    } else {
      socket.emit("privateMessage", { to: recipient, msg: input.value });
    }
    input.value = "";
  }
});

// Group messages
socket.on("chatMessage", (data) => {
  const isSelf = data.from === username;
  const cssClass = isSelf ? "self-msg" : "group-msg";
  addMessage(`[${formatTime(data.timestamp)}] ${data.from}: ${data.msg}`, cssClass);
});

// Private messages
socket.on("privateMessage", ({ from, to, msg, timestamp, self }) => {
  if (self) {
    addMessage(`[${formatTime(timestamp)}] You → ${to}: ${msg}`, "self-msg");
  } else {
    addMessage(`[${formatTime(timestamp)}] 🔒 ${from}: ${msg}`, "private-msg");
  }
});

// System messages
socket.on("systemMessage", (msg) => {
  addMessage(msg, "system-msg");
});

// Online users
socket.on("userList", (users) => {
  usersList.innerHTML = "";
  recipientSelect.innerHTML = `<option value="all">All</option>`;
  users.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = user;
    usersList.appendChild(li);
    if (role === "admin" && user !== username) {
      const btn = document.createElement("button");
      btn.textContent = "Remove";
      btn.style.marginLeft = "10px";
      btn.style.background = "#f44336";
      btn.style.color = "white";
      btn.style.border = "none";
      btn.style.borderRadius = "4px";
      btn.style.cursor = "pointer";
      btn.onclick = () => {
        socket.emit("removeUser", { target: user });
      };
      li.appendChild(btn);
    }

    usersList.appendChild(li)

    if (user !== username) {
      const option = document.createElement("option");
      option.value = user;
      option.textContent = user;
      recipientSelect.appendChild(option);
    }
  });
});
socket.on("forceLogout", (msg) => {
  // Clear local storage
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");

  // Show message nicely
  alert(msg); // or use your inline message system if you prefer

  // Redirect to home
  window.location.href = "/home.html";
});
