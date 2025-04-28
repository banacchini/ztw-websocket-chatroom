const socket = io();

let nickname = "";
let currentRoom = "general";

// Hide chat until the user provides a nickname
document.getElementById('joinBtn').addEventListener('click', () => {
    const input = document.getElementById('nicknameInput');
    if (input.value.trim() !== "") {
        nickname = input.value.trim();
        socket.emit('joinRoom', { nickname, room: currentRoom });
    }
});

// Remove existing listeners and add a single listener for nicknameError
socket.off('nicknameError').on('nicknameError', (errorMessage) => {
    alert(errorMessage); // Show an alert or display the error in the UI
    document.getElementById('nicknameInput').value = ""; // Clear the input field
});

// Remove existing listeners and add a single listener for nicknameAccepted
socket.off('nicknameAccepted').on('nicknameAccepted', () => {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'block';
});

// Emit "typing" event when the user types
const messageInputField = document.getElementById('messageInput');
messageInputField.addEventListener('input', () => {
    socket.emit('typing', { nickname, room: currentRoom });
});

// Show "typing..." information
// Show "typing..." as a message in the chat window
socket.off('typing').on('typing', (data) => {
    const chatWindow = document.getElementById('chatWindow');
    const typingMessageId = `typing-${data.nickname}`;

    // Check if a typing message for this user already exists
    if (!document.getElementById(typingMessageId)) {
        const div = document.createElement('div');
        div.id = typingMessageId;
        div.className = 'message typing';
        div.innerHTML = `<em>${data.nickname} is typing...</em>`;
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // Remove the typing message after 2 seconds
    setTimeout(() => {
        const typingMessage = document.getElementById(typingMessageId);
        if (typingMessage) {
            typingMessage.remove();
        }
    }, 2000);
});

// Change room
document.getElementById('changeRoomBtn').addEventListener('click', () => {
    const select = document.getElementById('roomSelect');
    const input = document.getElementById('roomInput');

    let newRoom = input.value.trim() || select.value;

    if (newRoom !== "" && newRoom !== currentRoom) {
        socket.emit('changeRoom', { nickname, newRoom, oldRoom: currentRoom });
        currentRoom = newRoom;
        clearMessages();
        input.value = ""; // Clear input after creating a new room
    }
});

// Send message and/or image
document.getElementById('messageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const messageInput = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');

    const message = messageInput.value.trim();
    const file = fileInput.files[0];

    if (message || file) {
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                // Emit both message and image
                socket.emit('chatMessage', {
                    nickname,
                    room: currentRoom,
                    message,
                    image: reader.result // Send image as Base64
                });

                // Clear inputs
                messageInput.value = "";
                fileInput.value = "";
            };
            reader.readAsDataURL(file);
        } else {
            // Emit only the message if no file is selected
            socket.emit('chatMessage', { nickname, room: currentRoom, message });

            // Clear input
            messageInput.value = "";
        }
    }
});

// Display messages
socket.off('message').on('message', (data) => {
    addMessage(data);
});

// Update room list
socket.off('roomList').on('roomList', (rooms) => {
    const select = document.getElementById('roomSelect');
    select.innerHTML = "";

    rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.name;
        option.innerText = `# ${room.name} (${room.count})`;
        select.appendChild(option);
    });
});

// Helper: Add message to chat window
function addMessage({ nickname: senderNickname, message, image, time }) {
    const chatWindow = document.getElementById('chatWindow');
    const div = document.createElement('div');
    const isOwnMessage = senderNickname === nickname; // Compare sender's nickname with the current user's nickname
    div.className = isOwnMessage ? 'message own' : 'message';
    div.innerHTML = `<strong>${senderNickname}</strong> [${time}]: ${message || ""}`;
    if (image) {
        div.innerHTML += `<br><img src="${image}" alt="Image" style="max-width: 200px;">`;
    }
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Helper: Clear chat window (e.g., after changing rooms)
function clearMessages() {
    document.getElementById('chatWindow').innerHTML = "";
}