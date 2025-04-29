const socket = io();
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

let nickname = "";
let currentRoom = "general";

document.getElementById('nicknameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('joinBtn').click();
    }
})

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
    const input = document.getElementById('nicknameInput');
    input.classList.add('error');
    
    // Pokaż komunikat o błędzie pod inputem
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = errorMessage;
    
    const loginContainer = document.getElementById('loginContainer');
    const existingError = loginContainer.querySelector('.error-message');
    
    if (existingError) {
        loginContainer.removeChild(existingError);
    }
    
    loginContainer.insertBefore(errorDiv, document.getElementById('joinBtn'));
    
    setTimeout(() => {
        input.classList.remove('error');
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 3000);
    
    input.value = "";
    input.focus();
});

// Remove existing listeners and add a single listener for nicknameAccepted
socket.off('nicknameAccepted').on('nicknameAccepted', () => {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';
    document.getElementById('messageInput').focus();

    addSystemMessage(`Welcome ${nickname}! You joined to room ${currentRoom}`);
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

        addSystemMessage(`You joined to room ${currentRoom}`);
    }
});

document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Create or show the image preview container
        let previewContainer = document.getElementById('imagePreviewContainer');
        if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.id = 'imagePreviewContainer';
            previewContainer.className = 'image-preview-container';
            
            // Insert before the message form
            const messageForm = document.getElementById('messageForm');
            messageForm.parentNode.insertBefore(previewContainer, messageForm);
        } else {
            previewContainer.innerHTML = ''; // Clear previous preview
            previewContainer.style.display = 'block';
        }
        
        // Create image preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'image-preview';
            
            // Create remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-image-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remove image';
            removeBtn.addEventListener('click', () => {
                document.getElementById('fileInput').value = '';
                previewContainer.style.display = 'none';
            });
            
            // Append elements to preview container
            previewContainer.appendChild(img);
            previewContainer.appendChild(removeBtn);
        };
        reader.readAsDataURL(file);
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
            if (file.size > MAX_IMAGE_SIZE) {
                alert('Plik jest za duży (maksymalnie 2 MB).');
                e.target.value = '';
                return;
            }
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

                const previewContainer = document.getElementById('imagePreviewContainer');
                if (previewContainer) {
                    previewContainer.style.display = 'none';
                }
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
    if (data.nickname === 'System') {
        addSystemMessage(data.message);
    } else {
        addMessage(data);
    }
});

socket.off('reactionRemoved').on('reactionRemoved', ({ messageId, reaction }) => {
    const messageDiv = document.querySelector(`[data-id="${messageId}"]`);
    if (messageDiv) {
        const reactionsDiv = messageDiv.querySelector('.reactions');
        const existingReaction = reactionsDiv.querySelector(`[data-reaction="${reaction}"]`);

        if (existingReaction) {
            const countSpan = existingReaction.querySelector('.reaction-count');
            const newCount = parseInt(countSpan.innerText) - 1;

            if (newCount > 0) {
                countSpan.innerText = newCount;
            } else {
                existingReaction.remove();
            }
        }
    }
});

// Update room list
socket.off('roomList').on('roomList', (rooms) => {
    const select = document.getElementById('roomSelect');
    select.innerHTML = "";

    rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.name;
        option.selected = room.name === currentRoom;
        option.innerText = `# ${room.name} (${room.count})`;
        select.appendChild(option);
    });
});

function addSystemMessage(message) {
    const chatWindow = document.getElementById('chatWindow');
    const div = document.createElement('div');
    div.className = 'message system';
    div.textContent = message;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Add message with reaction support
function addMessage({ id, nickname: senderNickname, message, image, time }) {
    console.log('Adding message with id:', id); // Debugging log
    const chatWindow = document.getElementById('chatWindow');
    const div = document.createElement('div');
    const isOwnMessage = senderNickname === nickname;
    div.className = isOwnMessage ? 'message own' : 'message';
    div.dataset.id = id; // Ensure `id` is unique for each message
    let content = `<strong>${senderNickname}</strong> <time>${time}</time>`;
    
    if (message) {
        content += `<div class="message-content">${message}</div>`;
    }
    
    if (image) {
        content += `<img src="${image}" alt="Wysłany obraz" >`;
    }
    
    content += `
        <div class="reactions"></div>
        <button class="react-button">
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
            </svg>
        </button>
    `;
    
    div.innerHTML = content;

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

    document.addEventListener('click', function closeMenu(e) {
        if (!reactionMenu.contains(e.target) && e.target !== event.currentTarget) {
            reactionMenu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
}

// Helper: Clear chat window (e.g., after changing rooms)
function clearMessages() {
    document.getElementById('chatWindow').innerHTML = "";
}

document.addEventListener('click', (e) => {
    const reactionMenu = document.querySelector('.reaction-menu');
    if (reactionMenu && !reactionMenu.contains(e.target) && !e.target.classList.contains('react-button')) {
        reactionMenu.remove();
    }
});

const chatWindow = document.getElementById('chatWindow');
chatWindow.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatWindow.classList.add('drag-over');
});

chatWindow.addEventListener('dragleave', () => {
    chatWindow.classList.remove('drag-over');
});

chatWindow.addEventListener('drop', (e) => {
    e.preventDefault();
    chatWindow.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        const file = files[0];
        if (file.size > MAX_IMAGE_SIZE) {
            alert('Plik jest za duży (maksymalnie 2 MB).');
            return;
        }

        const fileInput = document.getElementById('fileInput');
        fileInput.files = files;

        fileInput.dispatchEvent(new Event('change'));
    }
});
