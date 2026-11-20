import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator, type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  useNavigation,
  useNavigationState,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type Track = {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  audioUrl: string;
};

type Playlist = {
  id: string;
  name: string;
  cover: string;
  description: string;
  source: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
  lastPlayedAt?: number;
  lastTrackId?: string;
};

type SaveTarget =
  | { mode: 'new'; name: string }
  | { mode: 'existing'; id: string };

type PlaylistStackParamList = {
  Playlists: undefined;
  PlaylistDetail: { playlistId: string };
};

type RootTabParamList = {
  Home: undefined;
  'My Playlist': NavigatorScreenParams<PlaylistStackParamList>;
  Browse: undefined;
};

type PlaylistStackNavigation = NativeStackNavigationProp<PlaylistStackParamList>;

const COLORS = {
  bg: '#080B0C',
  surface: '#101516',
  surfaceRaised: '#161D1E',
  border: '#202A2B',
  text: '#F4F7F6',
  muted: '#8B9A9A',
  green: '#39F0A0',
  greenSoft: '#1FD98A',
  cyan: '#38D9F5',
  darkGreen: '#0D2E28',
};

const TAB_BAR_HEIGHT = 58;
const STORAGE_KEY = '@spotroll:playlists:v1';

const GRADIENT_ACCENT = ['#123F36', '#0B191A'] as const;
const GRADIENT_BUTTON = ['#35F0A0', '#20C9C6'] as const;
const coverUrl = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

const makeTrack = (
  id: string,
  title: string,
  artist: string,
  duration: number,
  artSeed: string,
  audioIndex: number,
): Track => ({
  id,
  title,
  artist,
  duration,
  thumbnail: coverUrl(artSeed),
  audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${audioIndex}.mp3`,
});

const MOCK_TRACKS: Track[] = [
  makeTrack('tr-01', 'Neon Skyline', 'Aero Bloom', 224, 'neon-skyline', 1),
  makeTrack('tr-02', 'Glasshouse', 'Kilo Rivers', 198, 'glasshouse', 2),
  makeTrack('tr-03', 'Static Hearts', 'Nova Vale', 251, 'static-hearts', 3),
  makeTrack('tr-04', 'Afterglow', 'The Midnight Arcade', 207, 'afterglow', 4),
  makeTrack('tr-05', 'Velvet Circuit', 'Sora Lane', 236, 'velvet-circuit', 5),
  makeTrack('tr-06', 'Blue Hour', 'Halcyon Drive', 189, 'blue-hour', 6),
  makeTrack('tr-07', 'Gravity Wells', 'Echo Meridian', 263, 'gravity-wells', 7),
  makeTrack('tr-08', 'Paper Planes', 'Lush Static', 212, 'paper-planes', 8),
  makeTrack('tr-09', 'Slow Motion', 'Juno Hayes', 241, 'slow-motion', 9),
  makeTrack('tr-10', 'Daybreak FM', 'Polar Youth', 226, 'daybreak-fm', 10),
];

const SEED_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-midnight-drive',
    name: 'Midnight Drive',
    cover: coverUrl('midnight-drive-cover'),
    description: 'Synthwave and neon nights for the long way home.',
    source: 'Imported from Spotify',
    tracks: MOCK_TRACKS.slice(0, 6),
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
    updatedAt: Date.now() - 1000 * 60 * 60 * 5,
    lastPlayedAt: Date.now() - 1000 * 60 * 42,
    lastTrackId: 'tr-03',
  },
  {
    id: 'pl-lofi-focus',
    name: 'Lo-Fi Focus',
    cover: coverUrl('lofi-focus-cover'),
    description: 'Soft textures and steady rhythms for deep work.',
    source: 'Imported from YouTube Music',
    tracks: [MOCK_TRACKS[1], MOCK_TRACKS[4], MOCK_TRACKS[7], MOCK_TRACKS[8]],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    updatedAt: Date.now() - 1000 * 60 * 60 * 26,
    lastPlayedAt: Date.now() - 1000 * 60 * 60 * 20,
    lastTrackId: 'tr-05',
  },
  {
    id: 'pl-gym-signal',
    name: 'Gym Signal',
    cover: coverUrl('gym-signal-cover'),
    description: 'High-voltage cues to keep the pace up.',
    source: 'Imported from Apple Music',
    tracks: [
      MOCK_TRACKS[0],
      MOCK_TRACKS[3],
      MOCK_TRACKS[6],
      MOCK_TRACKS[9],
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
];

const KNOWN_PLAYLIST_NAMES: Record<string, string> = {
  '37i9dQZF1DXcBWIGoYBM5M': "Today's Top Hits",
  '37i9dQZF1DX0XUsuxWHRQd': 'RapCaviar',
  '37i9dQZF1DX4WYpdgoIcn6': 'Chill Hits',
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function totalDurationLabel(tracks: Track[]) {
  const mins = Math.round(tracks.reduce((sum, track) => sum + track.duration, 0) / 60);
  return `${mins} min`;
}

function timeAgo(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function prettify(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function inferPlaylistName(url: string) {
  const cleaned = url.trim();
  if (!cleaned) return 'Neon After Hours';

  try {
    const parsed = new URL(cleaned);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] ?? '';
    if (KNOWN_PLAYLIST_NAMES[last]) return KNOWN_PLAYLIST_NAMES[last];
    const decoded = decodeURIComponent(last || parsed.hostname);
    return prettify(decoded) || 'Imported Mix';
  } catch {
    return prettify(cleaned.slice(0, 60)) || 'Imported Mix';
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchMockPlaylist(url: string): Promise<Playlist> {
  await wait(850);
  const name = inferPlaylistName(url);
  const now = Date.now();

  return {
    id: `browse-${now}`,
    name,
    cover: coverUrl(`browse-${Math.abs(name.length * 37)}`),
    description: 'A fresh mix discovered from your link. Ready to save offline.',
    source: url.trim() || 'mock://spotroll/featured-mix',
    tracks: MOCK_TRACKS,
    createdAt: now,
    updatedAt: now,
  };
}

type LibraryContextValue = {
  playlists: Playlist[];
  saveImportedPlaylist: (imported: Playlist, target: SaveTarget) => string;
  markPlayed: (playlistId: string, trackId: string) => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function useLibrary() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('LibraryContext is missing');
  return value;
}

function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>(SEED_PLAYLISTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && !cancelled) {
          const parsed = JSON.parse(stored) as Playlist[];
          if (Array.isArray(parsed) && parsed.length > 0) setPlaylists(parsed);
        }
      } catch {
        if (!cancelled) setPlaylists(SEED_PLAYLISTS);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(playlists)).catch(() => {});
  }, [playlists, hydrated]);

  const saveImportedPlaylist = useCallback(
    (imported: Playlist, target: SaveTarget) => {
      const now = Date.now();

      if (target.mode === 'new') {
        const id = `pl-${now}-${Math.random().toString(36).slice(2, 7)}`;
        const next: Playlist = {
          ...imported,
          id,
          name: target.name.trim() || imported.name,
          createdAt: now,
          updatedAt: now,
          lastPlayedAt: undefined,
          lastTrackId: undefined,
        };
        setPlaylists((current) => [next, ...current]);
        return id;
      }

      setPlaylists((current) =>
        current.map((playlist) => {
          if (playlist.id !== target.id) return playlist;
          const existingIds = new Set(playlist.tracks.map((track) => track.id));
          const added = imported.tracks.filter((track) => !existingIds.has(track.id));
          return {
            ...playlist,
            tracks: [...playlist.tracks, ...added],
            updatedAt: now,
          };
        }),
      );
      return target.id;
    },
    [],
  );

  const markPlayed = useCallback((playlistId: string, trackId: string) => {
    const now = Date.now();
    setPlaylists((current) =>
      current.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, lastPlayedAt: now, lastTrackId: trackId }
          : playlist,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({ playlists, saveImportedPlaylist, markPlayed }),
    [playlists, saveImportedPlaylist, markPlayed],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

type PlayerContextValue = {
  activePlaylist: Playlist | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  progress: number;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  playTrack: (playlistId: string, trackId: string) => void;
  playPlaylist: (playlist: Playlist, trackId?: string) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('PlayerContext is missing');
  return value;
}

function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { playlists, markPlayed } = useLibrary();
  const [active, setActive] = useState<{ playlistId: string; trackId: string } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const playedTokenRef = useRef(0);
  const finishedTrackRef = useRef<string | null>(null);

  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === active?.playlistId) ?? null,
    [playlists, active?.playlistId],
  );

  const activeIndex = activePlaylist?.tracks.findIndex((track) => track.id === active?.trackId) ?? -1;
  const currentTrack =
    activePlaylist && activeIndex >= 0 ? activePlaylist.tracks[activeIndex] : null;

  const player = useAudioPlayer(currentTrack?.audioUrl ?? null, { updateInterval: 400 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (currentTrack) {
        player.setActiveForLockScreen(true, {
          title: currentTrack.title,
          artist: currentTrack.artist,
          albumTitle: activePlaylist?.name,
          artworkUrl: currentTrack.thumbnail,
        });
      } else {
        player.clearLockScreenControls();
      }
    } catch {
      return;
    }
  }, [currentTrack, activePlaylist?.name, player]);

  useEffect(() => {
    if (currentTrack && playToken > playedTokenRef.current) {
      playedTokenRef.current = playToken;
      player.seekTo(0).catch(() => {});
      player.play();
    }
  }, [playToken, currentTrack, player]);

  const playTrack = useCallback(
    (playlistId: string, trackId: string) => {
      setActive({ playlistId, trackId });
      markPlayed(playlistId, trackId);
      setPlayToken((token) => token + 1);
    },
    [markPlayed],
  );

  const playPlaylist = useCallback(
    (playlist: Playlist, trackId?: string) => {
      const targetId = trackId ?? playlist.tracks[0]?.id;
      if (!targetId) return;
      if (currentTrack?.id === targetId) {
        if (!status.playing) player.play();
        return;
      }
      playTrack(playlist.id, targetId);
    },
    [currentTrack?.id, playTrack, player, status.playing],
  );

  const toggle = useCallback(() => {
    if (!currentTrack) return;
    if (status.playing) player.pause();
    else player.play();
  }, [currentTrack, player, status.playing]);

  const next = useCallback(() => {
    if (!activePlaylist || activePlaylist.tracks.length === 0 || activeIndex < 0) return;
    const nextIndex = (activeIndex + 1) % activePlaylist.tracks.length;
    playTrack(activePlaylist.id, activePlaylist.tracks[nextIndex].id);
  }, [activeIndex, activePlaylist, playTrack]);

  const previous = useCallback(() => {
    if (!activePlaylist || activePlaylist.tracks.length === 0 || activeIndex < 0) return;
    if (status.currentTime > 3) {
      player.seekTo(0).catch(() => {});
      return;
    }
    const previousIndex =
      (activeIndex - 1 + activePlaylist.tracks.length) % activePlaylist.tracks.length;
    playTrack(activePlaylist.id, activePlaylist.tracks[previousIndex].id);
  }, [activeIndex, activePlaylist, playTrack, player, status.currentTime]);

  const seek = useCallback(
    (seconds: number) => {
      player.seekTo(Math.max(0, seconds)).catch(() => {});
    },
    [player],
  );

  useEffect(() => {
    if (!status.didJustFinish || !currentTrack) return;
    if (finishedTrackRef.current === currentTrack.id) return;
    finishedTrackRef.current = currentTrack.id;
    next();
    const timer = setTimeout(() => {
      finishedTrackRef.current = null;
    }, 1200);
    return () => clearTimeout(timer);
  }, [status.didJustFinish, currentTrack, next]);

  const duration = status.duration > 0 ? status.duration : currentTrack?.duration ?? 0;
  const position = Math.min(status.currentTime, duration || status.currentTime);
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const value = useMemo(
    () => ({
      activePlaylist,
      currentTrack,
      isPlaying: status.playing,
      isBuffering: status.isBuffering,
      position,
      duration,
      progress,
      expanded,
      setExpanded,
      playTrack,
      playPlaylist,
      toggle,
      next,
      previous,
      seek,
    }),
    [
      activePlaylist,
      currentTrack,
      status.playing,
      status.isBuffering,
      position,
      duration,
      progress,
      expanded,
      playTrack,
      playPlaylist,
      toggle,
      next,
      previous,
      seek,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

function Artwork({
  uri,
  size,
  radius = 14,
  style,
}: {
  uri: string;
  size: number;
  radius?: number;
  style?: { width?: number; height?: number };
}) {
  const [failed, setFailed] = useState(false);

  return (
    <View
      style={[
        styles.artwork,
        { width: style?.width ?? size, height: style?.height ?? size, borderRadius: radius },
      ]}>
      <LinearGradient
        colors={['#16463D', '#0B1415']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!failed && uri ? (
        <Image
          source={{ uri }}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.artworkFallback}>
          <Ionicons name="musical-notes" size={size * 0.32} color="rgba(255,255,255,0.55)" />
        </View>
      )}
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function PlaylistCard({
  playlist,
  onPress,
  width = 158,
}: {
  playlist: Playlist;
  onPress: () => void;
  width?: number;
}) {
  return (
    <TouchableOpacity style={[styles.playlistCard, { width }]} onPress={onPress} activeOpacity={0.86}>
      <Artwork uri={playlist.cover} size={width} radius={16} />
      <View style={styles.offlineBadge}>
        <Ionicons name="checkmark-circle" size={11} color={COLORS.green} />
        <Text style={styles.offlineBadgeText}>Offline Ready</Text>
      </View>
      <Text style={styles.playlistCardName} numberOfLines={1}>
        {playlist.name}
      </Text>
      <Text style={styles.playlistCardMeta}>
        {playlist.tracks.length} tracks · {timeAgo(playlist.updatedAt)}
      </Text>
    </TouchableOpacity>
  );
}

function TrackRow({
  track,
  index,
  onPress,
  isActive = false,
  isPlaying = false,
}: {
  track: Track;
  index: number;
  onPress: () => void;
  isActive?: boolean;
  isPlaying?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.trackRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.trackIndex, isActive && styles.trackIndexActive]}>
        {isActive && isPlaying ? (
          <Ionicons name="volume-high" size={14} color={COLORS.green} />
        ) : (
          (index + 1).toString().padStart(2, '0')
        )}
      </Text>
      <Artwork uri={track.thumbnail} size={46} radius={9} />
      <View style={styles.trackInfo}>
        <Text style={[styles.trackTitle, isActive && styles.trackTitleActive]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      <Text style={styles.trackDuration}>{formatTime(track.duration)}</Text>
    </TouchableOpacity>
  );
}

function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const slide = useMemo(() => new Animated.Value(340), []);
  const fade = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (!visible) return;
    slide.setValue(340);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        damping: 26,
        stiffness: 260,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, slide, fade]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 340,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start(onClose);
  }, [fade, onClose, slide]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent>
      <View style={styles.sheetRoot}>
        <Animated.View style={[styles.sheetBackdrop, { opacity: fade }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetKeyboard}>
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: slide }] },
            ]}>
            <View style={styles.sheetHandle} />
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function HomeScreen() {
  const { playlists } = useLibrary();
  const { playPlaylist } = usePlayer();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const recent = useMemo(
    () => [...playlists].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8),
    [playlists],
  );

  const resume = useMemo(
    () =>
      playlists
        .filter((playlist) => playlist.lastPlayedAt)
        .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
        .slice(0, 3),
    [playlists],
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.homeScrollContent}>
        <View style={styles.homeHeader}>
          <View>
            <Text style={styles.eyebrow}>{greeting}</Text>
            <Text style={styles.bigTitle}>Spotroll</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>SR</Text>
          </View>
        </View>

        <LinearGradient colors={GRADIENT_ACCENT} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroTag}>YOUR LIBRARY, UNLIMITED</Text>
          <Text style={styles.heroTitle}>Music that travels with you.</Text>
          <Text style={styles.heroCopy}>
            Import any playlist, save it offline, and keep the good stuff playing.
          </Text>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={() => navigation.navigate('Browse')}
            activeOpacity={0.88}>
            <Ionicons name="add-circle" size={18} color={COLORS.bg} />
            <Text style={styles.heroButtonText}>Import a playlist</Text>
          </TouchableOpacity>
        </LinearGradient>

        <SectionHeader
          title="Recently Downloaded"
          subtitle="Fresh in your offline library"
          action="See all"
          onAction={() => navigation.navigate('My Playlist', { screen: 'Playlists' })}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}>
          {recent.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onPress={() =>
                navigation.navigate('My Playlist', {
                  screen: 'PlaylistDetail',
                  params: { playlistId: playlist.id },
                })
              }
            />
          ))}
        </ScrollView>

        <SectionHeader title="Quick Resume" subtitle="Jump back into where you left off" />
        <View style={styles.resumeList}>
          {resume.map((playlist) => {
            const lastTrack = playlist.tracks.find((track) => track.id === playlist.lastTrackId);
            return (
              <TouchableOpacity
                key={playlist.id}
                style={styles.resumeCard}
                onPress={() => playPlaylist(playlist, playlist.lastTrackId)}
                activeOpacity={0.85}>
                <Artwork uri={playlist.cover} size={56} radius={12} />
                <View style={styles.resumeInfo}>
                  <Text style={styles.resumeTitle} numberOfLines={1}>
                    {lastTrack?.title ?? playlist.name}
                  </Text>
                  <Text style={styles.resumeSubtitle} numberOfLines={1}>
                    {playlist.name} · {timeAgo(playlist.lastPlayedAt ?? 0)}
                  </Text>
                </View>
                <View style={styles.resumePlay}>
                  <Ionicons name="play" size={18} color={COLORS.bg} />
                </View>
              </TouchableOpacity>
            );
          })}
          {resume.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineText}>Start a playlist to see quick resume here.</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.shortcutCard}
          onPress={() => navigation.navigate('Browse')}
          activeOpacity={0.88}>
          <View style={styles.shortcutIcon}>
            <Ionicons name="link" size={22} color={COLORS.green} />
          </View>
          <View style={styles.shortcutCopy}>
            <Text style={styles.shortcutTitle}>Got a playlist link?</Text>
            <Text style={styles.shortcutSubtitle}>Paste it in Browse and move it offline.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlaylistsScreen() {
  const { playlists } = useLibrary();
  const navigation = useNavigation<PlaylistStackNavigation>();
  const insets = useSafeAreaInsets();

  const sorted = useMemo(
    () => [...playlists].sort((a, b) => b.updatedAt - a.updatedAt),
    [playlists],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
          <Text style={styles.bigTitle}>My Playlist</Text>
          <Text style={styles.headerMeta}>
            {playlists.length} playlists · available offline
          </Text>
        </View>
        <TouchableOpacity
          style={styles.roundButton}
          onPress={() => navigation.navigate('Playlists')}
          hitSlop={8}>
          <Ionicons name="reload" size={19} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <FlatListPlaceholderless
        data={sorted}
        insets={insets}
        onSelect={(playlistId) =>
          navigation.navigate('PlaylistDetail', { playlistId })
        }
      />
    </SafeAreaView>
  );
}

function FlatListPlaceholderless({
  data,
  insets,
  onSelect,
}: {
  data: Playlist[];
  insets: { bottom: number };
  onSelect: (playlistId: string) => void;
}) {
  if (data.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="musical-notes-outline" size={40} color={COLORS.muted} />
        <Text style={styles.emptyTitle}>No playlists yet</Text>
        <Text style={styles.emptyCopy}>Import one from Browse to get started.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.grid,
        { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 96 },
      ]}>
      {data.map((playlist) => (
        <PlaylistCard
          key={playlist.id}
          playlist={playlist}
          width={160}
          onPress={() => onSelect(playlist.id)}
        />
      ))}
    </ScrollView>
  );
}

function PlaylistDetailScreen({
  route,
}: NativeStackScreenProps<PlaylistStackParamList, 'PlaylistDetail'>) {
  const { playlists } = useLibrary();
  const { playTrack, playPlaylist, activePlaylist, currentTrack, isPlaying } = usePlayer();
  const navigation = useNavigation<PlaylistStackNavigation>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const playlist = playlists.find((item) => item.id === route.params.playlistId);

  if (!playlist) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerFill]}>
        <Text style={styles.emptyTitle}>Playlist not found</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.detailContent,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 100 },
        ]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.detailHero}>
          <Artwork uri={playlist.cover} size={Math.min(190, width - 96)} radius={22} />
          <Text style={styles.detailName}>{playlist.name}</Text>
          <Text style={styles.detailDescription}>{playlist.description}</Text>
          <Text style={styles.detailMeta}>
            {playlist.tracks.length} tracks · {totalDurationLabel(playlist.tracks)} · Offline Ready
          </Text>
        </View>

        <View style={styles.detailActions}>
          <TouchableOpacity
            style={styles.playAllButton}
            onPress={() => playPlaylist(playlist)}
            activeOpacity={0.88}>
            <Ionicons name="play" size={20} color={COLORS.bg} />
            <Text style={styles.playAllText}>Play all</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shuffleButton}
            onPress={() => {
              const randomTrack = playlist.tracks[Math.floor(Math.random() * playlist.tracks.length)];
              if (randomTrack) playTrack(playlist.id, randomTrack.id);
            }}
            activeOpacity={0.88}>
            <Ionicons name="shuffle" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <SectionHeader title="Tracks" subtitle={totalDurationLabel(playlist.tracks)} />
        <View style={styles.trackList}>
          {playlist.tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              onPress={() => playTrack(playlist.id, track.id)}
              isActive={activePlaylist?.id === playlist.id && currentTrack?.id === track.id}
              isPlaying={isPlaying}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ImportStep = 'choose' | 'new' | 'existing' | 'progress' | 'done';

function BrowseScreen() {
  const { playlists, saveImportedPlaylist } = useLibrary();
  const { currentTrack } = usePlayer();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const insets = useSafeAreaInsets();

  const [url, setUrl] = useState('');
  const [browsed, setBrowsed] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetStep, setSheetStep] = useState<ImportStep>('choose');
  const [newName, setNewName] = useState('');
  const [selectedExisting, setSelectedExisting] = useState<string | null>(null);
  const [target, setTarget] = useState<SaveTarget | null>(null);
  const [progress, setProgress] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const downloadTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (downloadTimer.current) clearInterval(downloadTimer.current);
    },
    [],
  );

  const handleBrowse = useCallback(async () => {
    setLoading(true);
    const result = await fetchMockPlaylist(url);
    setBrowsed(result);
    setLoading(false);
  }, [url]);

  const handlePaste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setUrl(text.trim());
  }, []);

  const openSheet = useCallback(() => {
    if (!browsed) return;
    setNewName(browsed.name);
    setSelectedExisting(null);
    setTarget(null);
    setProgress(0);
    setSavedId(null);
    setSheetStep('choose');
    setSheetVisible(true);
  }, [browsed]);

  const closeSheet = useCallback(() => {
    if (downloadTimer.current) {
      clearInterval(downloadTimer.current);
      downloadTimer.current = null;
    }
    setSheetVisible(false);
  }, []);

  const beginDownload = useCallback(
    (chosen: SaveTarget) => {
      if (!browsed) return;

      setTarget(chosen);
      setProgress(0);
      setSheetStep('progress');

      let value = 0;
      downloadTimer.current = setInterval(() => {
        value = Math.min(100, value + 5 + Math.random() * 9);
        setProgress(value);

        if (value >= 100) {
          if (downloadTimer.current) clearInterval(downloadTimer.current);
          downloadTimer.current = null;
          setTimeout(() => {
            const id = saveImportedPlaylist(browsed, chosen);
            setSavedId(id);
            setSheetStep('done');
          }, 420);
        }
      }, 230);
    },
    [browsed, saveImportedPlaylist],
  );

  const confirmChoice = useCallback(() => {
    if (sheetStep === 'new') {
      if (!newName.trim()) return;
      beginDownload({ mode: 'new', name: newName.trim() });
    } else if (sheetStep === 'existing' && selectedExisting) {
      beginDownload({ mode: 'existing', id: selectedExisting });
    }
  }, [beginDownload, newName, selectedExisting, sheetStep]);

  const downloadedCount = browsed
    ? Math.min(browsed.tracks.length, Math.floor((progress / 100) * browsed.tracks.length))
    : 0;
  const currentDownloadTrack = browsed?.tracks[Math.max(0, downloadedCount - 1)];
  const selectedName =
    target?.mode === 'new'
      ? target.name
      : playlists.find((playlist) => playlist.id === target?.id)?.name ?? 'your playlist';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.browseScrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + (currentTrack ? 150 : 100) },
        ]}>
        <View style={styles.browseHeader}>
          <Text style={styles.eyebrow}>DISCOVER</Text>
          <Text style={styles.bigTitle}>Browse</Text>
          <Text style={styles.headerMeta}>Paste a playlist link and make it yours offline.</Text>
        </View>

        <View style={styles.urlRow}>
          <View style={styles.urlInputWrap}>
            <Ionicons name="link-outline" size={18} color={COLORS.muted} />
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="Paste a Spotify, YouTube, or Apple Music link"
              placeholderTextColor="#667575"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.urlInput}
            />
            <TouchableOpacity onPress={handlePaste} style={styles.pasteButton} hitSlop={6}>
              <Text style={styles.pasteButtonText}>Paste Link</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={handleBrowse}
            activeOpacity={0.88}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.bg} size="small" />
            ) : (
              <Ionicons name="search-outline" size={18} color={COLORS.bg} />
            )}
            <Text style={styles.browseButtonText}>Browse</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.green} size="large" />
            <Text style={styles.loadingText}>Reading playlist link…</Text>
          </View>
        ) : null}

        {!loading && browsed ? (
          <View style={styles.resultBlock}>
            <View style={styles.resultHeader}>
              <Artwork uri={browsed.cover} size={104} radius={18} />
              <View style={styles.resultHeaderInfo}>
                <View style={styles.sourceBadge}>
                  <Ionicons name="sparkles" size={11} color={COLORS.cyan} />
                  <Text style={styles.sourceBadgeText}>PLAYLIST FOUND</Text>
                </View>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {browsed.name}
                </Text>
                <Text style={styles.resultDescription} numberOfLines={2}>
                  {browsed.description}
                </Text>
                <Text style={styles.resultMeta}>
                  {browsed.tracks.length} tracks · {totalDurationLabel(browsed.tracks)}
                </Text>
              </View>
            </View>

            <SectionHeader title="Tracks" subtitle="Everything included in this playlist" />
            <View style={styles.trackList}>
              {browsed.tracks.map((track, index) => (
                <TrackRow key={track.id} track={track} index={index} onPress={() => {}} />
              ))}
            </View>
          </View>
        ) : null}

        {!loading && !browsed ? (
          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.cyan} />
            <Text style={styles.tipText}>
              No link handy? Tap Browse to load a realistic demo playlist instantly.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {browsed && !loading ? (
        <View
          style={[
            styles.stickyBar,
            {
              bottom: insets.bottom + TAB_BAR_HEIGHT + (currentTrack ? 78 : 6),
            },
          ]}>
          <LinearGradient
            colors={['rgba(8,11,12,0)', 'rgba(8,11,12,0.96)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={openSheet}
            activeOpacity={0.88}>
            <Ionicons name="arrow-down-circle" size={20} color={COLORS.bg} />
            <Text style={styles.downloadButtonText}>Download & Move to My Playlist</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <BottomSheet visible={sheetVisible} onClose={closeSheet}>
        {sheetStep === 'choose' ? (
          <View style={styles.sheetBody}>
            <Text style={styles.sheetTitle}>Save this playlist</Text>
            <Text style={styles.sheetSubtitle}>Choose where your offline tracks should land.</Text>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => setSheetStep('new')}
              activeOpacity={0.85}>
              <View style={styles.sheetOptionIcon}>
                <Ionicons name="add" size={22} color={COLORS.green} />
              </View>
              <View style={styles.sheetOptionCopy}>
                <Text style={styles.sheetOptionTitle}>Save as a new playlist</Text>
                <Text style={styles.sheetOptionSub}>Create a fresh offline collection</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={COLORS.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setSelectedExisting(playlists[0]?.id ?? null);
                setSheetStep('existing');
              }}
              activeOpacity={0.85}>
              <View style={styles.sheetOptionIconCyan}>
                <Ionicons name="folder-open" size={21} color={COLORS.cyan} />
              </View>
              <View style={styles.sheetOptionCopy}>
                <Text style={styles.sheetOptionTitle}>Add to an existing playlist</Text>
                <Text style={styles.sheetOptionSub}>Merge tracks with a saved collection</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {sheetStep === 'new' ? (
          <View style={styles.sheetBody}>
            <TouchableOpacity style={styles.sheetBack} onPress={() => setSheetStep('choose')}>
              <Ionicons name="chevron-back" size={17} color={COLORS.muted} />
              <Text style={styles.sheetBackText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>New playlist name</Text>
            <Text style={styles.sheetSubtitle}>You can change this before downloading.</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              style={styles.sheetInput}
              placeholder="Playlist name"
              placeholderTextColor="#667575"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.sheetPrimaryButton, !newName.trim() && styles.buttonDisabled]}
              onPress={confirmChoice}
              disabled={!newName.trim()}>
              <Text style={styles.sheetPrimaryButtonText}>Start download</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {sheetStep === 'existing' ? (
          <View style={styles.sheetBody}>
            <TouchableOpacity style={styles.sheetBack} onPress={() => setSheetStep('choose')}>
              <Ionicons name="chevron-back" size={17} color={COLORS.muted} />
              <Text style={styles.sheetBackText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Add to existing</Text>
            <Text style={styles.sheetSubtitle}>Tracks you already have will be skipped.</Text>
            <ScrollView style={styles.existingList} showsVerticalScrollIndicator={false}>
              {playlists.map((playlist) => {
                const selected = selectedExisting === playlist.id;
                return (
                  <TouchableOpacity
                    key={playlist.id}
                    style={[
                      styles.existingItem,
                      selected && styles.existingItemSelected,
                    ]}
                    onPress={() => setSelectedExisting(playlist.id)}>
                    <Artwork uri={playlist.cover} size={42} radius={9} />
                    <View style={styles.existingItemCopy}>
                      <Text style={styles.existingItemName} numberOfLines={1}>
                        {playlist.name}
                      </Text>
                      <Text style={styles.existingItemMeta}>{playlist.tracks.length} tracks</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? COLORS.green : COLORS.muted}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.sheetPrimaryButton,
                !selectedExisting && styles.buttonDisabled,
              ]}
              onPress={confirmChoice}
              disabled={!selectedExisting}>
              <Text style={styles.sheetPrimaryButtonText}>Start download</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {sheetStep === 'progress' && browsed ? (
          <View style={styles.sheetBody}>
            <View style={styles.progressIcon}>
              <Ionicons name="cloud-download-outline" size={28} color={COLORS.green} />
            </View>
            <Text style={styles.sheetTitle}>Downloading tracks</Text>
            <Text style={styles.sheetSubtitle}>Saving “{selectedName}” to My Playlist…</Text>

            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{Math.round(progress)}%</Text>
              <Text style={styles.progressCount}>
                {downloadedCount} / {browsed.tracks.length} tracks
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={GRADIENT_BUTTON}
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
            <View style={styles.nowDownloading}>
              <Ionicons name="musical-notes" size={15} color={COLORS.muted} />
              <Text style={styles.nowDownloadingText} numberOfLines={1}>
                {currentDownloadTrack?.title ?? browsed.tracks[0]?.title}
              </Text>
            </View>
            <Text style={styles.progressNote}>Keep the app open — this usually takes a moment.</Text>
          </View>
        ) : null}

        {sheetStep === 'done' ? (
          <View style={styles.sheetBody}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={32} color={COLORS.bg} />
            </View>
            <Text style={styles.sheetTitle}>You&apos;re all set</Text>
            <Text style={styles.sheetSubtitle}>
              “{selectedName}” is saved and marked Offline Ready in My Playlist.
            </Text>
            <TouchableOpacity
              style={styles.sheetPrimaryButton}
              onPress={() => {
                closeSheet();
                navigation.navigate('My Playlist', {
                  screen: 'PlaylistDetail',
                  params: { playlistId: savedId ?? '' },
                });
              }}>
              <Text style={styles.sheetPrimaryButtonText}>Open in My Playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetSecondaryButton} onPress={closeSheet}>
              <Text style={styles.sheetSecondaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

function MiniPlayer() {
  const { currentTrack, activePlaylist, isPlaying, isBuffering, progress, toggle, next, setExpanded } =
    usePlayer();
  const insets = useSafeAreaInsets();
  const routeName = useNavigationState((state) => state.routes[state.index]?.name);

  if (!currentTrack || routeName === 'Browse') return null;

  return (
    <View
      style={[
        styles.miniPlayer,
        { bottom: insets.bottom + TAB_BAR_HEIGHT + 6 },
      ]}>
      <TouchableOpacity
        style={styles.miniInfo}
        onPress={() => setExpanded(true)}
        activeOpacity={0.9}>
        <Artwork uri={currentTrack.thumbnail} size={44} radius={10} />
        <View style={styles.miniText}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.miniArtist} numberOfLines={1}>
            {activePlaylist?.name ?? currentTrack.artist}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.miniControl} onPress={toggle} hitSlop={8}>
        {isBuffering && !isPlaying ? (
          <ActivityIndicator color={COLORS.green} size="small" />
        ) : (
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={21} color={COLORS.bg} />
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.miniNext} onPress={next} hitSlop={8}>
        <Ionicons name="play-skip-forward" size={19} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.miniProgressTrack}>
        <View style={[styles.miniProgressFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

function NowPlayingModal() {
  const {
    currentTrack,
    activePlaylist,
    isPlaying,
    isBuffering,
    position,
    duration,
    progress,
    expanded,
    setExpanded,
    toggle,
    next,
    previous,
    seek,
  } = usePlayer();
  const { width } = useWindowDimensions();

  return (
    <Modal
      visible={expanded}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setExpanded(false)}>
      <SafeAreaView style={styles.nowPlayingSafe}>
        <LinearGradient
          colors={['#10463C', '#0B1A1B', COLORS.bg]}
          style={styles.nowPlayingGradient}>
          <View style={styles.nowPlayingTop}>
            <TouchableOpacity onPress={() => setExpanded(false)} hitSlop={8}>
              <Ionicons name="chevron-down" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.nowPlayingEyebrow}>NOW PLAYING</Text>
            <TouchableOpacity hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {currentTrack ? (
            <View style={styles.nowPlayingBody}>
              <Artwork uri={currentTrack.thumbnail} size={Math.min(width - 72, 340)} radius={24} />
              <View style={styles.nowPlayingTrackInfo}>
                <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                  {currentTrack.title}
                </Text>
                <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                  {currentTrack.artist} · {activePlaylist?.name ?? 'Spotroll'}
                </Text>
              </View>

              <View style={styles.seekWrap}>
                <TouchableOpacity
                  style={styles.seekHit}
                  onPress={(event) => {
                    if (duration <= 0) return;
                    seek((event.nativeEvent.locationX / (width - 72)) * duration);
                  }}>
                  <View style={styles.seekTrack}>
                    <View style={[styles.seekFill, { width: `${progress}%` }]} />
                    <View style={[styles.seekThumb, { left: `${progress}%` }]} />
                  </View>
                </TouchableOpacity>
                <View style={styles.seekTimes}>
                  <Text style={styles.seekTime}>{formatTime(position)}</Text>
                  <Text style={styles.seekTime}>-{formatTime(Math.max(0, duration - position))}</Text>
                </View>
              </View>

              <View style={styles.nowControls}>
                <TouchableOpacity onPress={previous} hitSlop={10}>
                  <Ionicons name="play-skip-back" size={30} color={COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.bigPlayButton} onPress={toggle}>
                  {isBuffering && !isPlaying ? (
                    <ActivityIndicator color={COLORS.bg} size="small" />
                  ) : (
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color={COLORS.bg} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={next} hitSlop={10}>
                  <Ionicons name="play-skip-forward" size={30} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.offlineNow}>
                <Ionicons name="checkmark-circle" size={15} color={COLORS.green} />
                <Text style={styles.offlineNowText}>Offline Ready · streaming demo audio</Text>
              </View>
            </View>
          ) : null}
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
}

const PlaylistStackNavigator = createNativeStackNavigator<PlaylistStackParamList>();
const RootTabNavigator = createBottomTabNavigator<RootTabParamList>();

function PlaylistStack() {
  return (
    <PlaylistStackNavigator.Navigator screenOptions={{ headerShown: false }}>
      <PlaylistStackNavigator.Screen name="Playlists" component={PlaylistsScreen} />
      <PlaylistStackNavigator.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
    </PlaylistStackNavigator.Navigator>
  );
}

function RootNavigator() {
  return (
    <RootTabNavigator.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: '#697878',
        tabBarStyle: {
          backgroundColor: '#0C1011',
          borderTopColor: '#1D2627',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: TAB_BAR_HEIGHT + 20,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
      }}>
      <RootTabNavigator.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <RootTabNavigator.Screen
        name="My Playlist"
        component={PlaylistStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
      <RootTabNavigator.Screen
        name="Browse"
        component={BrowseScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
    </RootTabNavigator.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LibraryProvider>
        <PlayerProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
            <MiniPlayer />
            <NowPlayingModal />
          </NavigationContainer>
        </PlayerProvider>
      </LibraryProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerFill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  eyebrow: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  bigTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerMeta: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarText: {
    color: COLORS.green,
    fontSize: 13,
    fontWeight: '800',
  },
  homeScrollContent: {
    paddingBottom: TAB_BAR_HEIGHT + 90,
  },
  heroCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(57,240,160,0.22)',
  },
  heroGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(56,217,245,0.12)',
    top: -90,
    right: -50,
  },
  heroTag: {
    color: COLORS.cyan,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: '800',
    marginTop: 12,
    maxWidth: 250,
    lineHeight: 31,
  },
  heroCopy: {
    color: '#A9B9B7',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 9,
    maxWidth: 260,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.green,
    marginTop: 20,
  },
  heroButtonText: {
    color: COLORS.bg,
    fontWeight: '800',
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 30,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionAction: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '700',
  },
  horizontalList: {
    paddingHorizontal: 20,
    gap: 14,
  },
  artwork: {
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceRaised,
  },
  artworkFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(7,12,12,0.82)',
  },
  offlineBadgeText: {
    color: '#CDEBDD',
    fontSize: 9,
    fontWeight: '700',
  },
  playlistCard: {
    gap: 8,
  },
  playlistCardName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  playlistCardMeta: {
    color: COLORS.muted,
    fontSize: 11,
  },
  resumeList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resumeInfo: {
    flex: 1,
    gap: 4,
  },
  resumeTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  resumeSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
  },
  resumePlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green,
  },
  emptyInline: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyInlineText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 26,
    borderRadius: 18,
    padding: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shortcutIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(57,240,160,0.1)',
  },
  shortcutCopy: {
    flex: 1,
  },
  shortcutTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  shortcutSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
  },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    rowGap: 22,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCopy: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  detailContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  detailHero: {
    alignItems: 'center',
  },
  detailName: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 18,
  },
  detailDescription: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  detailMeta: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  playAllButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.green,
  },
  playAllText: {
    color: COLORS.bg,
    fontWeight: '800',
    fontSize: 14,
  },
  shuffleButton: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trackList: {
    gap: 2,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  trackIndex: {
    width: 20,
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  trackIndexActive: {
    color: COLORS.green,
  },
  trackInfo: {
    flex: 1,
    gap: 4,
  },
  trackTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  trackTitleActive: {
    color: COLORS.green,
  },
  trackArtist: {
    color: COLORS.muted,
    fontSize: 11,
  },
  trackDuration: {
    color: COLORS.muted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  browseHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  browseScrollContent: {},
  urlRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingHorizontal: 20,
  },
  urlInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 52,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  urlInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    paddingVertical: 12,
  },
  pasteButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(56,217,245,0.1)',
  },
  pasteButtonText: {
    color: COLORS.cyan,
    fontSize: 10,
    fontWeight: '800',
  },
  browseButton: {
    minWidth: 98,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.green,
  },
  browseButtonText: {
    color: COLORS.bg,
    fontWeight: '800',
    fontSize: 12,
  },
  loadingCard: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 18,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 13,
  },
  resultBlock: {
    marginTop: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    gap: 16,
    marginHorizontal: 20,
    marginTop: 24,
    padding: 14,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(56,217,245,0.1)',
  },
  sourceBadgeText: {
    color: COLORS.cyan,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  resultTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  resultDescription: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  resultMeta: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '700',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 22,
    borderRadius: 16,
    padding: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tipText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 15,
    paddingVertical: 15,
    backgroundColor: COLORS.green,
    shadowColor: COLORS.green,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  downloadButtonText: {
    color: COLORS.bg,
    fontSize: 13,
    fontWeight: '800',
  },
  sheetRoot: {
    flex: 1,
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  sheetKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A4647',
    marginTop: 10,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 8,
  },
  sheetSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 18,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 16,
    padding: 13,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  sheetOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(57,240,160,0.1)',
  },
  sheetOptionIconCyan: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,217,245,0.1)',
  },
  sheetOptionCopy: {
    flex: 1,
  },
  sheetOptionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetOptionSub: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  sheetBack: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 4,
  },
  sheetBackText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  sheetInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceRaised,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    marginBottom: 18,
  },
  sheetPrimaryButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green,
  },
  sheetPrimaryButtonText: {
    color: COLORS.bg,
    fontSize: 13,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  existingList: {
    maxHeight: 260,
    marginBottom: 18,
  },
  existingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  existingItemSelected: {
    borderColor: COLORS.green,
  },
  existingItemCopy: {
    flex: 1,
  },
  existingItemName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  existingItemMeta: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },
  progressIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(57,240,160,0.1)',
    marginBottom: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 9,
  },
  progressLabel: {
    color: COLORS.green,
    fontSize: 24,
    fontWeight: '800',
  },
  progressCount: {
    color: COLORS.muted,
    fontSize: 12,
  },
  progressTrack: {
    height: 9,
    borderRadius: 5,
    backgroundColor: '#233031',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  nowDownloading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
  },
  nowDownloadingText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
  },
  progressNote: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 12,
  },
  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green,
    marginBottom: 4,
  },
  sheetSecondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetSecondaryButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  miniPlayer: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: 64,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#151D1E',
    borderWidth: 1,
    borderColor: '#2A3637',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
  },
  miniInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniText: {
    flex: 1,
    gap: 3,
  },
  miniTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  miniArtist: {
    color: COLORS.muted,
    fontSize: 10,
  },
  miniControl: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green,
  },
  miniNext: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniProgressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: '#263031',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: COLORS.green,
  },
  nowPlayingSafe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  nowPlayingGradient: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  nowPlayingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nowPlayingEyebrow: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  nowPlayingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  nowPlayingTrackInfo: {
    alignItems: 'center',
    gap: 6,
  },
  nowPlayingTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
  },
  nowPlayingArtist: {
    color: COLORS.muted,
    fontSize: 13,
  },
  seekWrap: {
    width: '100%',
  },
  seekHit: {
    paddingVertical: 10,
  },
  seekTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  seekFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.green,
  },
  seekThumb: {
    position: 'absolute',
    top: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.text,
    marginLeft: -5,
  },
  seekTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  seekTime: {
    color: COLORS.muted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  nowControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 38,
  },
  bigPlayButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green,
  },
  offlineNow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  offlineNowText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: COLORS.green,
  },
  secondaryButtonText: {
    color: COLORS.bg,
    fontWeight: '800',
  },
});
