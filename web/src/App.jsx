import React, { useState, useEffect } from 'react';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';

// 1. Matches Mobile language choices directly
const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu'];

// 2. Matches Mobile topic IDs directly
const TOPICS = [
  { id: 'general-support', label: 'General Support' },
  { id: 'anxiety', label: 'Anxiety & Stress' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'loneliness', label: 'Feeling Lonely' },
];

const TOKEN_SERVER_URL = 'http://localhost:3000/api/get-token';

export default function App() {
  const [language, setLanguage] = useState('English');
  const [topic, setTopic] = useState('general-support');
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(false);

  const joinCircle = async () => {
    setLoading(true);
    try {
      const res = await fetch(TOKEN_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: topic, 
          language: language.toLowerCase() // Sends "english", matching mobile payload
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch token');
      setConnection(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {!connection ? (
        <div style={styles.card}>
          <h2 style={{ margin: '0 0 10px 0' }}>Anonymous Peer Support (Web)</h2>
          <p style={{ color: '#aaa', fontSize: 14 }}>Select your language and circle topic</p>

          <h4>Language</h4>
          <div style={styles.grid}>
            {LANGUAGES.map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                style={language === l ? styles.activeBtn : styles.btn}>
                {l}
              </button>
            ))}
          </div>

          <h4>Topic</h4>
          <div style={styles.grid}>
            {TOPICS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTopic(t.id)}
                style={topic === t.id ? styles.activeBtn : styles.btn}>
                {t.label}
              </button>
            ))}
          </div>

          <button onClick={joinCircle} disabled={loading} style={styles.joinBtn}>
            {loading ? 'Connecting...' : 'Join Circle in Browser'}
          </button>
        </div>
      ) : (
        <LiveKitRoom
          serverUrl={connection.wsUrl}
          token={connection.token}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={() => setConnection(null)}
          style={{ width: '100%', maxWidth: 600 }}>
          <RoomAudioRenderer />
          <WebAudioCircle roomName={connection.roomName} onLeave={() => setConnection(null)} />
        </LiveKitRoom>
      )}
    </div>
  );
}

function WebAudioCircle({ roomName, onLeave }) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [timeLeft, setTimeLeft] = useState(900);

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          if (room) room.disconnect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [room]);

  const toggleMic = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  };

  const handleLeave = () => {
    if (room) room.disconnect();
    onLeave();
  };

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>{roomName.replace(/_/g, ' ')}</h3>
          <span style={{ fontSize: 12, color: '#aaa' }}>{participants.length} Online</span>
        </div>
        <div style={styles.timerBadge}>
          {Math.floor(timeLeft / 60)}:{timeLeft % 60 < 10 ? '0' : ''}{timeLeft % 60}
        </div>
      </div>

      <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {participants.map((p) => (
          <div key={p.sid} style={styles.participantRow(p.isSpeaking)}>
            <span>{p.identity} {p.sid === localParticipant?.sid ? '(You)' : ''}</span>
            <span style={{ fontSize: 12, color: p.isSpeaking ? '#10B981' : '#888' }}>
              {p.isSpeaking ? 'Speaking...' : 'Quiet'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={toggleMic} style={isMicrophoneEnabled ? styles.activeBtn : styles.btn}>
          {isMicrophoneEnabled ? '🎙️ Mic On' : '🔇 Mic Off'}
        </button>
        <button onClick={() => window.open('tel:14416')} style={styles.sosBtn}>
          🚨 Tele-MANAS (14416)
        </button>
        <button onClick={handleLeave} style={styles.leaveBtn}>
          Leave
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: { background: '#121212', color: '#fff', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif', padding: 20 },
  card: { background: '#1e1e1e', padding: 24, borderRadius: 12, width: '100%', maxWidth: 480, boxSizing: 'border-box' },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  btn: { background: '#2e2e2e', border: 'none', color: '#ccc', padding: '10px 14px', borderRadius: 20, cursor: 'pointer' },
  activeBtn: { background: '#4f46e5', border: 'none', color: '#fff', padding: '10px 14px', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' },
  joinBtn: { background: '#10b981', color: '#fff', border: 'none', padding: 14, borderRadius: 8, width: '100%', cursor: 'pointer', fontWeight: 'bold', marginTop: 16 },
  sosBtn: { background: '#dc2626', color: '#fff', border: 'none', padding: 10, borderRadius: 8, cursor: 'pointer' },
  leaveBtn: { background: '#4b5563', color: '#fff', border: 'none', padding: 10, borderRadius: 8, cursor: 'pointer' },
  timerBadge: { background: '#312e81', color: '#818cf8', padding: '6px 12px', borderRadius: 12, fontWeight: 'bold' },
  participantRow: (isSpeaking) => ({
    background: '#282828',
    padding: 12,
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'space-between',
    borderLeft: isSpeaking ? '4px solid #10B981' : '4px solid transparent',
  }),
};