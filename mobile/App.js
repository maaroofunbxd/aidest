import { 
  registerGlobals, 
  LiveKitRoom, 
  AudioSession,
  useLocalParticipant,
  useParticipants,
  useRoomContext
} from '@livekit/react-native';

// 1. MUST run at the file root before any WebRTC code executes
registerGlobals();

import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator
} from 'react-native';

const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu'];
const TOPICS = [
  { id: 'general-support', label: 'General Support' },
  { id: 'anxiety', label: 'Anxiety & Stress' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'loneliness', label: 'Feeling Lonely' },
];

// --- 2. ACTIVE ROOM UI (Participant list, speaker states & controls) ---
function ActiveRoomControls({ roomTopic, roomLanguage, onLeave }) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [timeLeft, setTimeLeft] = useState(900); // 15-minute countdown

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (room) room.disconnect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
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
    <View style={styles.roomContainer}>
      <View style={styles.roomCard}>
        {/* Header: Topic, Language, Online Count & Timer */}
        <View style={styles.roomHeader}>
          <View>
            <Text style={styles.roomTitle}>
              {roomTopic.replace(/-/g, ' ')}
            </Text>
            <Text style={styles.onlineCount}>
              {roomLanguage} • {participants.length} Online
            </Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>
              {Math.floor(timeLeft / 60)}:{timeLeft % 60 < 10 ? '0' : ''}{timeLeft % 60}
            </Text>
          </View>
        </View>

        {/* Participant List */}
        <ScrollView style={styles.participantList}>
          {participants.map((p) => {
            const isLocal = p.sid === localParticipant?.sid;
            const isSpeaking = p.isSpeaking;
            const isMuted = !p.isMicrophoneEnabled;

            return (
              <View
                key={p.sid}
                style={[
                  styles.participantRow,
                  isSpeaking && styles.participantRowSpeaking,
                ]}
              >
                <Text style={styles.identityText}>
                  {p.identity} {isLocal ? '(You)' : ''}
                </Text>
                <Text
                  style={[
                    styles.statusText,
                    isSpeaking && styles.speakingText,
                    isMuted && styles.mutedText,
                  ]}
                >
                  {isSpeaking ? '🎙️ Speaking' : isMuted ? '🔇 Muted' : '🎧 Listening'}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Action Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={[
              styles.controlButton, 
              isMicrophoneEnabled ? styles.activeButton : styles.mutedButton
            ]} 
            onPress={toggleMic}
          >
            <Text style={styles.buttonText}>
              {isMicrophoneEnabled ? '🎙️ Mic On' : '🔇 Mic Off'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, styles.leaveButton]} 
            onPress={handleLeave}
          >
            <Text style={styles.buttonText}>Leave Room</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// --- 3. ROOM CONTAINER (Memoized to prevent reconnect loops) ---
function RoomContainer({ serverUrl, token, roomTopic, roomLanguage, onLeave }) {
  const roomOptions = useMemo(() => ({
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: { audioPreset: 'telephone' },
  }), []);

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      audio={true}
      video={false}
      options={roomOptions}
      style={styles.container}
    >
      <ActiveRoomControls 
        roomTopic={roomTopic} 
        roomLanguage={roomLanguage} 
        onLeave={onLeave} 
      />
    </LiveKitRoom>
  );
}

// --- 4. MAIN APP COMPONENT ---
export default function App() {
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [selectedTopic, setSelectedTopic] = useState('general-support');
  
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Request mic permission on boot
    async function requestPermission() {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Microphone access is required for peer audio chat.',
            buttonPositive: 'OK',
          }
        );
      }
    }
    requestPermission();
  }, []);

  const joinRoom = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      // Route audio to the main speakerphone instead of the internal ear receiver
      await AudioSession.configureAudio({
        android: {
          preferredOutputList: ['speaker'],
        },
      });

      await AudioSession.startAudioSession();

      const response = await fetch('http://192.168.1.5:3000/api/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedTopic,
          language: selectedLanguage.toLowerCase(),
        }),
      });

      const data = await response.json();

      if (data.token && data.wsUrl) {
        setToken(data.token);
        setServerUrl(data.wsUrl);
      } else {
        setErrorMsg('Invalid response from token server.');
      }
    } catch (err) {
      console.error('Failed to get token:', err);
      setErrorMsg('Could not connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    await AudioSession.stopAudioSession();
    setToken('');
    setServerUrl('');
  };

  // If connected, render the active audio room
  if (token && serverUrl) {
    return (
      <RoomContainer 
        serverUrl={serverUrl} 
        token={token} 
        roomTopic={selectedTopic}
        roomLanguage={selectedLanguage}
        onLeave={handleLeave} 
      />
    );
  }

  // Otherwise, render the Lobby / Topic Selection screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.lobbyContainer}>
        <Text style={styles.headerTitle}>Peer Support Lobby</Text>
        <Text style={styles.subTitle}>Select your preferred topic and language</Text>

        {/* Topic Selector */}
        <Text style={styles.sectionHeader}>Topic</Text>
        <View style={styles.chipGroup}>
          {TOPICS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.chip,
                selectedTopic === item.id && styles.selectedChip,
              ]}
              onPress={() => setSelectedTopic(item.id)}
            >
              <Text style={[styles.chipText, selectedTopic === item.id && styles.selectedChipText]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Language Selector */}
        <Text style={styles.sectionHeader}>Language</Text>
        <View style={styles.chipGroup}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.chip,
                selectedLanguage === lang && styles.selectedChip,
              ]}
              onPress={() => setSelectedLanguage(lang)}
            >
              <Text style={[styles.chipText, selectedLanguage === lang && styles.selectedChipText]}>
                {lang}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        {/* Join Button */}
        <TouchableOpacity 
          style={styles.joinButton} 
          onPress={joinRoom}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.joinButtonText}>Join Anonymous Call</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- 5. STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  lobbyContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 14,
    color: '#AAA',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EEE',
    marginTop: 16,
    marginBottom: 10,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#444',
  },
  selectedChip: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  chipText: {
    color: '#CCC',
    fontSize: 14,
  },
  selectedChipText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  joinButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
  },
  joinButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#EF4444',
    marginTop: 12,
    textAlign: 'center',
  },
  roomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#121212',
  },
  roomCard: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    maxHeight: 520,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    textTransform: 'capitalize',
  },
  onlineCount: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 2,
  },
  timerBadge: {
    backgroundColor: '#312E81',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  timerText: {
    color: '#818CF8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  participantList: {
    marginVertical: 10,
    maxHeight: 280,
  },
  participantRow: {
    backgroundColor: '#282828',
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  participantRowSpeaking: {
    borderLeftColor: '#10B981',
    backgroundColor: '#1F2923',
  },
  identityText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 12,
    color: '#888',
  },
  speakingText: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  mutedText: {
    color: '#EF4444',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#3B82F6',
  },
  mutedButton: {
    backgroundColor: '#374151',
  },
  leaveButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});