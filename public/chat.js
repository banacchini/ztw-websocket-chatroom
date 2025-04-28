const socket = io();

let nickname = "";
let currentRoom = "general";

// Ukrywamy czat, dopóki użytkownik nie poda nicku
document.getElementById('joinBtn').addEventListener('click', () => {
    const input = document.getElementById('nicknameInput');
    if (input.value.trim() !== "") {
        nickname = input.value.trim();
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'block';
        socket.emit('joinRoom', { nickname, room: currentRoom });
    }
});

// Zmieniamy pokój
document.getElementById('changeRoomBtn').addEventListener('click', () => {
    const select = document.getElementById('roomSelect');
    const input = document.getElementById('roomInput');

    let newRoom = input.value.trim() || select.value;

    if (newRoom !== "" && newRoom !== currentRoom) {
        socket.emit('changeRoom', { nickname, newRoom, oldRoom: currentRoom });
        currentRoom = newRoom;
        clearMessages();
        input.value = ""; // Czyścimy input po stworzeniu nowego pokoju
    }
});


// Wysyłanie wiadomości i/lub obrazu
document.getElementById('messageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const messageInput = document.getElementById('messageInput');
    const imageInput = document.getElementById('imageInput');

    if (messageInput.value.trim() !== "") {
        socket.emit('chatMessage', { nickname, room: currentRoom, message: messageInput.value });
        messageInput.value = "";
    }

    if (imageInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            socket.emit('chatImage', { nickname, room: currentRoom, image: e.target.result });
        };
        reader.readAsDataURL(imageInput.files[0]);
        imageInput.value = ""; // Czyścimy input
    }
});

// "Typing..." event
const messageInputField = document.getElementById('messageInput');
messageInputField.addEventListener('input', () => {
    socket.emit('typing', { nickname, room: currentRoom });
});

// Wyświetlanie wiadomości
socket.on('message', (data) => {
    addMessage(data);
});

// Wyświetlanie zdjęcia
socket.on('image', (data) => {
    addImage(data);
});

// Pokazywanie "typing..." informacji
socket.on('typing', (data) => {
    const typingIndicator = document.getElementById('typingIndicator');
    typingIndicator.innerText = `${data.nickname} is typing...`;
    setTimeout(() => {
        typingIndicator.innerText = "";
    }, 2000);
});

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


// Helper: dodaj wiadomość do okna czatu
function addMessage(data) {
    const chatWindow = document.getElementById('chatWindow');
    const div = document.createElement('div');
    const isOwnMessage = data.nickname === nickname;
    div.className = isOwnMessage ? 'message own' : 'message';
    div.innerHTML = `<strong>${data.nickname}</strong> [${data.time}]: ${data.message}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Helper: dodaj zdjęcie do okna czatu
function addImage(data) {
    const chatWindow = document.getElementById('chatWindow');
    const div = document.createElement('div');
    const isOwnMessage = data.nickname === nickname;
    div.className = isOwnMessage ? 'message own' : 'message';
    div.innerHTML = `<strong>${data.nickname}</strong> [${data.time}]:<br><img src="${data.image}" alt="Image" style="max-width: 200px;">`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Helper: czyścimy okno czatu (np. po zmianie pokoju)
function clearMessages() {
    document.getElementById('chatWindow').innerHTML = "";
}
