const express = require('express');
const cors = require('cors');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration pulled from environment variables or LiveKit Cloud credentials
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secretkey_change_me_in_prod';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880';

// Convert WebSocket URL to HTTP protocol for RoomServiceClient management
const roomServiceHost = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
const roomService = new RoomServiceClient(roomServiceHost, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

app.post('/api/get-token', async (req, res) => {
  console.log('Received token request for:', req.body);
  try {
    const { topic, language } = req.body;
    if (!topic || !language) {
      return res.status(400).json({ error: 'Topic and language are required parameters.' });
    }

    // Generate ephemeral anonymous identity (No user profiles or PII stored)
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const identity = `Guest_${randomId}`;
    const baseRoomName = `${topic.replace(/\s+/g, '_')}_${language}`;

    // CONSTRAINED ROOM ENGINE: Auto-scale sub-rooms to enforce MAX 5 participants per circle
    let targetRoomName = baseRoomName;
    let roomIndex = 1;
    const MAX_PARTICIPANTS = 5;

    while (true) {
      try {
        const participants = await roomService.listParticipants(targetRoomName);
        if (participants.length < MAX_PARTICIPANTS) {
          break; // Slot available in current room
        }
        // Room full (>= 5 users), iterate to next room index
        roomIndex++;
        targetRoomName = `${baseRoomName}_${roomIndex}`;
      } catch (err) {
        // Room does not exist yet on server; safe to create as new room
        break;
      }
    }

    // Construct 15-minute short-lived LiveKit access token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: identity,
      ttl: '15m',
    });

    // Grant permissions to join and publish data/audio streams
    at.addGrant({
      room: targetRoomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return res.json({
      token,
      wsUrl: LIVEKIT_URL,
      roomName: targetRoomName,
      identity,
    });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LiveKit Token Server running on port ${PORT}`));
