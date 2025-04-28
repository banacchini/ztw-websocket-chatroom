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

    socket.emit('roomList', rooms); // Wysyłamy listę pokoi do nowego użytkownika

    socket.on('joinRoom', ({ nickname, room }) => {
        users[socket.id] = { nickname, room };
        socket.join(room);
        io.emit('roomList', getRoomsWithCounts());



        // Jeśli pokój nie istnieje, dodaj
        if (!rooms.includes(room)) {
            rooms.push(room);
            io.emit('roomList', rooms); // aktualizuj listę pokoi
        }

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
        io.emit('roomList', getRoomsWithCounts());

        // Dodaj nowy pokój jeśli nie istnieje
        if (!rooms.includes(newRoom)) {
            rooms.push(newRoom);
            io.emit('roomList', rooms); // wysyłamy nową listę pokoi
        }

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
    });


    // Obsługa wiadomości tekstowej
    socket.on('chatMessage', ({ nickname, room, message }) => {
        io.to(room).emit('message', {
            nickname,
            message,
            time: moment().format('HH:mm')
        });
    });

    // Obsługa przesyłania zdjęcia
    socket.on('chatImage', ({ nickname, room, image }) => {
        io.to(room).emit('image', {
            nickname,
            image,
            time: moment().format('HH:mm')
        });
    });

    // Obsługa eventu "typing..."
    socket.on('typing', ({ nickname, room }) => {
        socket.to(room).emit('typing', { nickname });
    });

    // Obsługa rozłączenia użytkownika
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


// Nasłuch na porcie 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
