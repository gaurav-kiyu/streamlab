# StreamLab

React Native app for phones and TVs (Android, Android TV, Fire TV, iOS, Apple TV).
Browse screen uses TMDB metadata. Playback uses HLS via react-native-video.

## Setup
1. `npm install`
2. Start the app, open the Settings tab, add your TMDB key and Jellyfin server.
3. Run:
   - Phone: `npx expo prebuild && npm run android` or `npm run ios`
   - TV: `npx expo prebuild --clean` with `EXPO_TV=1`, then `npm run android-tv` or `npm run apple-tv`

Needs a dev build (not Expo Go) because react-native-video is a native module.

## Using your own content
Point `SAMPLE_STREAMS` at HLS URLs you own or are licensed to stream, for example a Jellyfin or self-hosted server.

## Added
- Search tab (TMDB `/search/movie`, debounced)
- Resume playback (position saved every ~5s, cleared near the end)
- Subtitle picker (shows when the stream has text tracks)
- Audio track picker (shows when the stream has more than one audio track)
- Continue watching row on Browse, with a progress bar on each poster

- Settings tab: enter TMDB key and Jellyfin server in the app
- Jellyfin library row: streams your own media over HLS
- react-navigation: tabs (Browse, Search, Settings) plus Details and Player screens
- India-first Browse: Hindi popular, top rated, TV shows, South Indian films (often dubbed in Hindi)
- Details shows legal watch options in India (free, subscription, rent) via TMDB
- First-run language screen: one tap on your own language, no English needed
- App text in 10 languages: English, Hindi, Tamil, Telugu, Bengali, Marathi, Malayalam, Kannada, Punjabi, Gujarati (have native speakers review before release)
- Simpler screens: big touch targets, tab icons, a large Play button, screen-reader labels
- Settings show only language, quality and data saver; technical fields sit under Advanced settings
- Offline downloads for direct video files (Jellyfin and Internet Archive MP4); works without internet
- Fixed: typing in Settings no longer loses focus after each key
- Playback quality: in-player picker with SD, HD, FHD, QHD and 4K badges when the stream offers those levels; Jellyfin stream quality setting (Auto up to 4K)
- Language chips: All India, Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi, Gujarati (choice is remembered)
- Genre shelves per language: Action, Romance, Comedy, Drama, Thriller, Family
- Data saver switch in Settings (caps video at about 1.2 Mbps)
- Hindi films free on Internet Archive row
- Free public-domain films row (Internet Archive)
- Jellyfin password kept in expo-secure-store
- My list: save titles from the details screen
- Playback error message

## Production checklist (not done yet)
- TV focus guides (react-navigation is in; tune D-pad order on a real TV)
- Offline downloads, Chromecast/AirPlay, Picture-in-Picture
- Crash reporting, analytics opt-in, unit and device tests
- App icons, splash, TV banner (320x180), store listings and privacy policy

## Roadmap for wider reach in India
- Parental controls with a PIN, and a kids profile
- Chromecast and AirPlay, Picture-in-Picture
- Notifications for new releases in your languages
- TalkBack/VoiceOver labels and large-text support

## Next steps
- react-navigation for real routing
