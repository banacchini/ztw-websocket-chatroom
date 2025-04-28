const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = ['general']; // Default room
const activeNicknames = new Set(); // Track active nicknames
const users = {}; // Map socket.id -> user info

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Handle socket.io connections
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Send the current room list to the client
    socket.emit('roomList', getRoomsWithCounts());

    // Handle user joining a room
    socket.on('joinRoom', ({ nickname, room }) => {
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

        // Clean up empty rooms and update the room list
        deleteEmptyRooms();
        io.emit('roomList', getRoomsWithCounts());
    });

    // Handle chat messages
    socket.on('chatMessage', ({ nickname, room, message, image }) => {
        const time = moment().format('HH:mm');
        io.to(room).emit('message', { nickname, message, image, time });
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
                const index = rooms.indexOf(room);
                if (index > -1) {
                    rooms.splice(index, 1);
                }
            }
        }
    }
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});