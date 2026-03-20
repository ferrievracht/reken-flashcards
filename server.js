const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Photo directory
const photoDir = path.join(__dirname, 'photo');

// No cache headers
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Serve static files
app.use(express.static(__dirname));

// Teacher control page
app.get('/leraar', (req, res) => {
    res.sendFile(path.join(__dirname, 'leraar.html'));
});

// Monitor page (live view of student progress)
app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'monitor.html'));
});

// Serve photos from photo directory
app.use('/photos', express.static(photoDir));

// API to get list of available photos
app.get('/api/photos', (req, res) => {
    try {
        const files = fs.readdirSync(photoDir);
        const photos = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
        res.json(photos);
    } catch (err) {
        res.json(['fee.jpg']); // fallback
    }
});

// Store latest game state for new monitor connections
let latestGameState = null;

// Broadcast client count to all
function broadcastClientCount() {
    const count = io.engine.clientsCount;
    io.emit('client-count', count);
}

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, '- Total clients:', io.engine.clientsCount);

    // Notify all about new connection count
    setTimeout(() => broadcastClientCount(), 100);

    // Send latest state to new monitors
    if (latestGameState) {
        socket.emit('game-state', latestGameState);
    }

    // Teacher sends message
    socket.on('teacher-message', (msg) => {
        console.log('Teacher message:', msg, '- Broadcasting to', io.engine.clientsCount, 'clients');
        io.emit('show-message', msg);
    });

    // Teacher clears message
    socket.on('clear-message', () => {
        console.log('Clearing message');
        io.emit('hide-message');
    });

    // Teacher starts app
    socket.on('start-app', () => {
        console.log('Starting app on all clients');
        io.emit('start-game');
    });

    // Teacher toggles numberline
    socket.on('toggle-numberline', (enabled) => {
        console.log('Numberline enabled:', enabled);
        io.emit('numberline-setting', enabled);
    });

    // Teacher toggles telraam (abacus)
    socket.on('toggle-telraam', (enabled) => {
        console.log('Telraam enabled:', enabled);
        io.emit('telraam-setting', enabled);
    });

    // Teacher toggles direction hints
    socket.on('toggle-direction-hints', (enabled) => {
        console.log('Direction hints enabled:', enabled);
        io.emit('direction-hints-setting', enabled);
    });

    // Teacher changes puzzle photo
    socket.on('change-photo', (photoName) => {
        console.log('Changing photo to:', photoName);
        io.emit('set-photo', photoName);
    });

    // Teacher restarts with new sums
    socket.on('restart-game', () => {
        console.log('Restarting game with new sums');
        io.emit('restart-game');
    });

    // Teacher refreshes all clients
    socket.on('refresh-clients', () => {
        console.log('Refreshing all clients');
        io.emit('refresh-page');
    });

    // Kiosk mode: Teacher starts game with settings
    socket.on('kiosk-start-game', (settings) => {
        console.log('Kiosk start game with settings:', settings);
        io.emit('kiosk-game-start', settings);
    });

    // Student events - relay to monitors
    socket.on('student-state', (state) => {
        latestGameState = state;
        socket.broadcast.emit('game-state', state);
    });

    socket.on('student-answer', (data) => {
        io.emit('answer-event', data);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        setTimeout(() => broadcastClientCount(), 100);
    });
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Teacher panel: http://localhost:${PORT}/leraar`);
});
