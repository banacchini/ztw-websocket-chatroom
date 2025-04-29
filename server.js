const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 2e6 // 2 MB
});

const rooms = ['general']; // Default room
const activeNicknames = new Set(); // Track active nicknames
const users = {}; // Map socket.id -> user info


let messageIdCounter = 0;
const messageReactions = new Map(); // Map to track reactions per message
const messageHistory = new Map();

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Handle socket.io connections
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Send the current room list to the client
    socket.emit('roomList', getRoomsWithCounts());

    // Handle user joining a room
    socket.on('joinRoom', ({ nickname, room }) => {
        if (nickname.length > 16) {
            socket.emit('nicknameError', 'Nickname cannot exceed 16 characters.');
            return;
        }

        if (activeNicknames.has(nickname)) {
            socket.emit('nicknameError', 'This nickname is already in use. Please choose another one.');
            return;
        }

        // Add nickname to active list and confirm login
        activeNicknames.add(nickname);
        socket.emit('nicknameAccepted');
        users[socket.id] = { nickname, room };
        socket.join(room);

        if (!rooms.includes(room)) {
            rooms.push(room);
        }

        io.emit('roomList', getRoomsWithCounts());

        console.log(`${nickname} joined room: ${room}`);

        socket.to(room).emit('message', {
            nickname: 'System',
            message: `${nickname} joined the room.`,
            time: moment().format('HH:mm')
        });

        if (messageHistory.has(room)) {
            const roomHistory = messageHistory.get(room);
            socket.emit('messageHistory', roomHistory);
        }
    });

    // Handle user disconnecting
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            const { nickname, room } = user;

            // Remove nickname from active list
            activeNicknames.delete(nickname);

            // Notify the room about the user leaving
            socket.to(room).emit('message', {
                nickname: 'System',
                message: `${nickname} left the chat.`,
                time: moment().format('HH:mm')
            });

            // Remove user from the users map
            delete users[socket.id];

            // Clean up empty rooms
            deleteEmptyRooms();

            // Update the room list for all clients
            io.emit('roomList', getRoomsWithCounts());
        }
    });

    // Handle room changes
    socket.on('changeRoom', ({ nickname, newRoom, oldRoom }) => {
        socket.leave(oldRoom);
        socket.join(newRoom);
        users[socket.id].room = newRoom;

        if (!rooms.includes(newRoom)) {
            rooms.push(newRoom);
        }

        // Notify the old and new rooms
        socket.to(oldRoom).emit('message', {
            nickname: 'System',
            message: `${nickname} left the room.`,
            time: moment().format('HH:mm')
        });

        socket.to(newRoom).emit('message', {
            nickname: 'System',
            message: `${nickname} joined the room.`,
            time: moment().format('HH:mm')
        });

        console.log(`${nickname} switched from ${oldRoom} to ${newRoom}`);

        if (messageHistory.has(newRoom)) {
            const roomHistory = messageHistory.get(newRoom);
            socket.emit('messageHistory', roomHistory);
        }

        // Clean up empty rooms and update the room list
        deleteEmptyRooms();
        io.emit('roomList', getRoomsWithCounts());
    });

    // Handle "typing" event
    socket.on('typing', ({ nickname, room }) => {
        socket.to(room).emit('typing', { nickname });
    });

    // Handle "reaction" event
    socket.on('reaction', ({ messageId, reaction, room }) => {
        if (!messageReactions.has(messageId)) {
            messageReactions.set(messageId, new Map());
        }

        const userReactions = messageReactions.get(messageId);

        // Remove the user's previous reaction if it exists
        if (userReactions.has(socket.id)) {
            const previousReaction = userReactions.get(socket.id);
            io.to(room).emit('reactionRemoved', { messageId, reaction: previousReaction });
        }

        // Add the new reaction
        userReactions.set(socket.id, reaction);

        // Emit the updated reaction to the room
        io.to(room).emit('reaction', { messageId, reaction });

        updateMessageReaction(messageId, room, reaction, socket.id);
    });


// Update the `chatMessage` event to include the generated ID
    socket.on('chatMessage', ({ nickname, room, message, image }) => {
        const time = moment().format('HH:mm');
        const id = generateUniqueId(); // Generate a unique ID for the message
        const messageData = { id, nickname, message, image, time };

        io.to(room).emit('message', messageData);
        saveMessageToHistory(room, messageData);
        console.log(`[${room}] ${nickname}: ${message || "Image sent"}`);
    });
});

// Helper function: Get rooms with user counts
function getRoomsWithCounts() {
    const roomCounts = {};

    for (const id in users) {
        const room = users[id].room;
        roomCounts[room] = (roomCounts[room] || 0) + 1;
    }

    return rooms.map(room => ({
        name: room,
        count: roomCounts[room] || 0
    }));
}

// Helper function: Delete empty rooms
function deleteEmptyRooms() {
    for (const room of rooms) {
        if (room !== 'general') {
            const roomCount = io.sockets.adapter.rooms.get(room)?.size || 0;
            if (roomCount === 0) {
                //Remove the room message history
                messageHistory.delete(room);

                const index = rooms.indexOf(room);
                if (index > -1) {
                    rooms.splice(index, 1);
                }
            }
        }
    }
}

function saveMessageToHistory(room, messageData) {
    if (!messageHistory.has(room)) {
        messageHistory.set(room, []);
    }

    const roomHistory = messageHistory.get(room);
    roomHistory.push({ ...messageData, reactions: {} }); // Ensure reactions are initialized

    // Limit history to the last 50 messages
    if (roomHistory.length > 50) {
        roomHistory.shift();
    }
}


//Helper function: Generate a unique ID for each message
function generateUniqueId() {
    return `msg-${messageIdCounter++}`;
}


function updateMessageReaction(messageId, room, reaction, socketId) {
    if (messageHistory.has(room)) {
        const history = messageHistory.get(room);
        const messageIndex = history.findIndex(msg => msg.id === messageId);

        if (messageIndex !== -1) {
            const message = history[messageIndex];

            // Initialize reactions if not present
            if (!message.reactions) {
                message.reactions = {};
            }

            // Remove the user's previous reaction if it exists
            for (const [type, users] of Object.entries(message.reactions)) {
                if (users.includes(socketId)) {
                    message.reactions[type] = users.filter(id => id !== socketId);
                    if (message.reactions[type].length === 0) {
                        delete message.reactions[type];
                    }
                }
            }

            // Add the new reaction
            if (!message.reactions[reaction]) {
                message.reactions[reaction] = [];
            }
            message.reactions[reaction].push(socketId);
        }
    }
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});