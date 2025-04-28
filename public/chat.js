const socket = io();

let nickname = "";
let currentRoom = "general";

// Hide chat until the user provides a nickname
document.getElementById('joinBtn').addEventListener('click', () => {
    const input = document.getElementById('nicknameInput');
    if (input.value.trim() !== "") {
        nickname = input.value.trim();
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'block';
        socket.emit('joinRoom', { nickname, room: currentRoom });
    }
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

// "Typing..." event
const messageInputField = document.getElementById('messageInput');
messageInputField.addEventListener('input', () => {
    socket.emit('typing', { nickname, room: currentRoom });
});

// Display messages
socket.on('message', (data) => {
    addMessage(data);
});

// Display images
socket.on('image', (data) => {
    addImage(data);
});

// Show "typing..." information
socket.on('typing', (data) => {
    const typingIndicator = document.getElementById('typingIndicator');
    typingIndicator.innerText = `${data.nickname} is typing...`;
    setTimeout(() => {
        typingIndicator.innerText = "";
    }, 2000);
});

// Update room list
socket.on('roomList', (rooms) => {
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
function addMessage({ nickname, message, image, time }) {
    const chatWindow = document.getElementById('chatWindow');
    const div = document.createElement('div');
    const isOwnMessage = nickname === nickname;
    div.className = isOwnMessage ? 'message own' : 'message';
    div.innerHTML = `<strong>${nickname}</strong> [${time}]: ${message || ""}`;
    if (image) {
        div.innerHTML += `<br><img src="${image}" alt="Image" style="max-width: 200px;">`;
    }
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Helper: Add image to chat window
function addImage(data) {
    const chatWindow = document.getElementById('chatWindow');
    const div = document.createElement('div');
    const isOwnMessage = data.nickname === nickname;
    div.className = isOwnMessage ? 'message own' : 'message';
    div.innerHTML = `<strong>${data.nickname}</strong> [${data.time}]:<br><img src="${data.image}" alt="Image" style="max-width: 200px;">`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Helper: Clear chat window (e.g., after changing rooms)
function clearMessages() {
    document.getElementById('chatWindow').innerHTML = "";
}