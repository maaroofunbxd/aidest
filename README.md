🎙️ Anonymous Peer Support Audio PlatformA cross-platform (Android & Web) real-time anonymous audio room platform designed for peer support. Users can join topic-based, language-specific voice circles without creating accounts or revealing personal data. Built with React Native, React Web, Express.js, and LiveKit WebRTC.🌟 Key FeaturesCross-Platform Audio Parity: Real-time two-way voice communication between Android native devices and web browsers.Normalized Topic & Language Routing: Seamless room matching using standardized room slugs (e.g., general-support_en).Real-Time Participant Tracking: Live guest counters, mute indicators, and active speaker visual highlights (useParticipants & useLocalParticipant).Privacy & Anonymity: No registration required; participants are assigned ephemeral, non-persistent guest identities.Timed Sessions: Automatic 15-minute room countdown timer with auto-disconnect safety logic.Crisis Hotline Integration: One-touch access to crisis resources (e.g., Tele-MANAS).🛠️ Tech StackLayerTechnologies UsedMobile AppReact Native, Expo (Development Client), @livekit/react-nativeWeb AppReact.js, @livekit/components-react, @livekit/components-stylesBackend APINode.js, Express.js, livekit-server-sdk, CORSAudio EngineLiveKit Cloud / WebRTC Engine📁 Repository StructurePlaintext├── server/               # Express.js token server
│   ├── server.js         # Token generation & room slug normalization
│   └── .env.example      # Backend environment variables
├── web/                  # React web application
│   ├── src/              # Web room & UI controls
│   └── package.json
└── mobile/               # React Native Expo project
    ├── App.js            # Native audio session & active room UI
    └── android/          # Native Android build folder
🚀 Quick Start GuidePrerequisitesNode.js: v18+ installedJava Development Kit: JDK 17 (Required for Android native WebRTC builds)Android Device: Connected via USB with USB Debugging enabled1. Backend Server SetupBashcd server
npm install
Create a .env file inside /server:Code snippetPORT=3000
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=https://your-project.livekit.cloud
Start the token server:Bashnpm start
2. Web Client SetupBashcd web
npm install
npm start
The web client will open at http://localhost:3000 (or http://localhost:8081).3. Mobile Client Setup (Android)Because @livekit/react-native uses native C++ and WebRTC bindings, the app requires a custom Expo Development Client build.Connect your Android phone via USB and confirm detection:Bashadb devices
Build and install the development client onto your phone:macOS (Homebrew OpenJDK 17):BashJAVA_HOME=$(/usr/libexec/java_home -v 17) npx expo run:android
Windows:Bashnpx expo run:android
Start the Metro Bundler over Wi-Fi:Ensure App.js points to your laptop's Wi-Fi IP address (e.g., [http://192.168.1.](http://192.168.1.)X:3000/api/get-token), then run:Bashnpx expo start
Open the anonymous-peer-support app on your phone.🔄 Room Logic & NormalizationTo ensure mobile and web clients join the same LiveKit audio room, room identifiers are constructed by concatenating the normalized topic slug and language code:$$\text{Room Identifier} = \text{topic\_slug} + \text{"\_"} + \text{language\_code}$$Example Request: { topic: "general-support", language: "English" }Normalized Room ID: general-support_en🔒 Security & Best PracticesSecrets Management: Never commit .env files containing LIVEKIT_API_SECRET.Audio Routing: Mobile uses AudioSession.configureAudio({ android: { preferredOutputList: ['speaker'] } }) to ensure audio routes to the main speakerphone rather than the internal earpiece.


## 🛠️ Troubleshooting & Common Issues

### 1. JDK & Gradle Errors (`JAVA_HOME is set to an invalid directory`)
* **Problem**: Running `npx expo run:android` fails on macOS with `JAVA_HOME is set to an invalid directory: /opt/homebrew/opt/openjdk@17`.
* **Cause**: Homebrew installs OpenJDK inside a nested `libexec` directory structure that Gradle cannot detect from the base path.
* **Solution**: Use dynamic Java path resolution when executing the build:
  ```bash
  JAVA_HOME=$(/usr/libexec/java_home -v 17) npx expo run:android
Explicit Path Fallback:

Bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home npx expo run:android
2. ADB Authorization & Device Detection (unauthorized or No devices found)
Problem: Build fails with This computer is not authorized for developing on Device... or device is not listed.

Solution:

Verify the device connection:

Bash
adb devices
If the output shows unauthorized:

Unlock your phone screen.

Accept the "Allow USB Debugging?" popup and check "Always allow from this computer".

If no prompt appears:

Navigate to Settings > Developer Options on your phone.

Tap Revoke USB debugging authorizations.

Unplug the USB cable, re-plug it, and tap Allow on the new prompt.

3. Web Client CORS Errors (Blocked by CORS Policy)
Problem: Web browser fails to fetch LiveKit tokens from http://localhost:3000/api/get-token.

Cause: Express backend is missing cross-origin resource sharing headers.

Solution: Ensure cors middleware is installed and initialized in server/server.js:

Bash
npm install cors
JavaScript
const cors = require('cors');
const app = express();

app.use(cors()); // Enable CORS for development
app.use(express.json());
4. Mobile Network Request Failed (Could not connect to backend server)
Problem: Mobile app displays "Could not connect to backend server" when tapping Join Anonymous Call.

Cause: Mobile device cannot reach localhost because localhost refers to the mobile phone itself, not your host computer.

Solution:

Find your computer's local Wi-Fi IP address:

macOS: ipconfig getifaddr en0

Windows: ipconfig (Look for IPv4 Address)

Update the fetch endpoint in mobile/App.js with your IP address:

JavaScript
const response = await fetch('[http://192.168.1.](http://192.168.1.)X:3000/api/get-token', { ... });
Confirm both your phone and laptop are connected to the exact same Wi-Fi network.

5. Mobile & Web Users Isolated in Separate Rooms
Problem: Web and Mobile users join at the same time, but cannot hear each other or see each other in the participant list.

Cause: Room slug mismatch due to inconsistent language naming (e.g., Web sending english vs Mobile sending en).

Solution: Verify both frontends normalize payloads before requesting tokens:

Payload format: { topic: 'general-support', language: 'english' }

Resulting Room Name: general-support_english

