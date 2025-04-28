const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const moment = require('moment'); // Użyjemy do formatowania daty

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = ['general']; // Startowy pokój


// Serwujemy pliki z katalogu 'public'
app.use(express.static('public'));

// Mapowanie socket.id -> nick
const users = {};



io.on('connection', (socket) => {
    console.log('Nowe połączenie:', socket.id);

    // Emit the correct room list structure
    socket.emit('roomList', getRoomsWithCounts());

    socket.on('joinRoom', ({ nickname, room }) => {
        users[socket.id] = { nickname, room };
        socket.join(room);

        // Add the room if it doesn't exist
        if (!rooms.includes(room)) {
            rooms.push(room);
        }

        // Emit the updated room list
        io.emit('roomList', getRoomsWithCounts());

        console.log(`${nickname} dołączył do pokoju: ${room}`);

        socket.to(room).emit('message', {
            nickname: 'System',
            message: `${nickname} dołączył do pokoju.`,
            time: moment().format('HH:mm')
        });
    });

    socket.on('changeRoom', ({ nickname, newRoom, oldRoom }) => {
        socket.leave(oldRoom);
        socket.join(newRoom);
        users[socket.id].room = newRoom;

        // Add the new room if it doesn't exist
        if (!rooms.includes(newRoom)) {
            rooms.push(newRoom);
        }

        // Send messages before deleting empty rooms
        socket.to(oldRoom).emit('message', {
            nickname: 'System',
            message: `${nickname} opuścił pokój.`,
            time: moment().format('HH:mm')
        });

        socket.to(newRoom).emit('message', {
            nickname: 'System',
            message: `${nickname} dołączył do pokoju.`,
            time: moment().format('HH:mm')
        });

        console.log(`${nickname} zmienił pokój z ${oldRoom} na ${newRoom}`);

        // Delete empty rooms after sending messages
        deleteEmptyRooms();

        // Emit the updated room list
        io.emit('roomList', getRoomsWithCounts());
    });

    // Handle chatMessage event
    socket.on('chatMessage', ({ nickname, room, message, image }) => {
        const time = moment().format('HH:mm');
        io.to(room).emit('message', { nickname, message, image, time });
        console.log(`[${room}] ${nickname}: ${message || "Image sent"}`);
    });

    socket.on('sendImage', ({ room, image }) => {
        io.to(room).emit('imageMessage', {
            nickname: users[socket.id]?.nickname || 'Unknown',
            image,
            time: moment().format('HH:mm')
        });
        console.log(`[${room}] Image sent by ${users[socket.id]?.nickname || 'Unknown'}`);
    });

    socket.on('imageMessage', ({ nickname, image, time }) => {
        const chatWindow = document.getElementById('chatWindow');
        const messageElement = document.createElement('div');
        messageElement.innerHTML = `
        <p><strong>${nickname}</strong> <span>${time}</span></p>
        <img src="${image}" alt="Sent image" style="max-width: 100%; height: auto;" />
    `;
        chatWindow.appendChild(messageElement);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const { nickname, room } = users[socket.id];
            socket.to(room).emit('message', {
                nickname: 'System',
                message: `${nickname} opuścił czat.`,
                time: moment().format('HH:mm')
            });
            console.log(`${nickname} (${socket.id}) rozłączył się`);
            delete users[socket.id];
        }

        // Delete empty rooms and emit the updated room list
        deleteEmptyRooms();
        io.emit('roomList', getRoomsWithCounts());
    });
});

function getRoomsWithCounts() {
    const roomCounts = {};

    for (const id in users) {
        const room = users[id].room;
        if (roomCounts[room]) {
            roomCounts[room]++;
        } else {
            roomCounts[room] = 1;
        }
    }

    // Zwracamy tablicę obiektów {name, count}
    return rooms.map(room => ({
        name: room,
        count: roomCounts[room] || 0
    }));
}

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


// Nasłuch na porcie 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
