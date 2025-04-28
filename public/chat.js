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

// Handle incoming reactions
socket.off('reaction').on('reaction', ({ messageId, reaction }) => {
    console.log('Reaction received for messageId:', messageId); // Debugging log
    const messageDiv = document.querySelector(`[data-id="${messageId}"]`);
    if (messageDiv) {
        console.log('Found messageDiv with data-id:', messageDiv.dataset.id); // Debugging log
        const reactionsDiv = messageDiv.querySelector('.reactions');
        const existingReaction = reactionsDiv.querySelector(`[data-reaction="${reaction}"]`);

        if (existingReaction) {
            const countSpan = existingReaction.querySelector('.reaction-count');
            countSpan.innerText = parseInt(countSpan.innerText) + 1;
        } else {
            const span = document.createElement('span');
            span.dataset.reaction = reaction;
            span.innerHTML = `${reaction} <span class="reaction-count">1</span>`;
            reactionsDiv.appendChild(span);
        }
    } else {
        console.error('No messageDiv found for messageId:', messageId); // Debugging log
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

// Add message with reaction support
function addMessage({ id, nickname: senderNickname, message, image, time }) {
    console.log('Adding message with id:', id); // Debugging log
    const chatWindow = document.getElementById('chatWindow');
    const div = document.createElement('div');
    const isOwnMessage = senderNickname === nickname;
    div.className = isOwnMessage ? 'message own' : 'message';
    div.dataset.id = id; // Ensure `id` is unique for each message
    div.innerHTML = `
        <strong>${senderNickname}</strong> [${time}]: ${message || ""}
        ${image ? `<br><img src="${image}" alt="Image" style="max-width: 200px;">` : ""}
        <div class="reactions"></div>
        <button class="react-button">React</button>
    `;

    const reactButton = div.querySelector('.react-button');
    reactButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showReactionOptions(e, id);
    });

    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showReactionOptions(event, messageId) {
    console.log('Opening reaction menu for messageId:', messageId); // Debugging log
    const existingMenu = document.querySelector('.reaction-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const reactionOptions = ['👍', '❤️', '😂', '😮', '😢', '👎'];
    const reactionMenu = document.createElement('div');
    reactionMenu.className = 'reaction-menu';
    reactionOptions.forEach(reaction => {
        const button = document.createElement('button');
        button.innerText = reaction;
        button.addEventListener('click', () => {
            console.log('Reacting with:', reaction, 'to messageId:', messageId); // Debugging log
            socket.emit('reaction', { messageId, reaction, room: currentRoom });
            reactionMenu.remove();
        });
        reactionMenu.appendChild(button);
    });

    const buttonRect = event.currentTarget.getBoundingClientRect();
    reactionMenu.style.position = 'absolute';
    reactionMenu.style.top = `${buttonRect.bottom + window.scrollY}px`;
    reactionMenu.style.left = `${buttonRect.left + window.scrollX}px`;
    document.body.appendChild(reactionMenu);
}

// Helper: Clear chat window (e.g., after changing rooms)
function clearMessages() {
    document.getElementById('chatWindow').innerHTML = "";
}