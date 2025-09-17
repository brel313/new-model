import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Platform,
  PermissionsAndroid,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from 'react-native-slider';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import FolderBrowser from '../components/FolderBrowser';
import PlaylistManager from '../components/PlaylistManager';

// Colores del tema naranja oscuro
const COLORS = {
  primary: '#CC4F00',     // Naranja oscuro principal
  secondary: '#FF6B1A',   // Naranja más claro
  accent: '#FFB366',      // Naranja claro para acentos
  background: '#1A1A1A',  // Fondo oscuro
  surface: '#2D2D2D',     // Superficies
  text: '#FFFFFF',        // Texto principal
  textSecondary: '#CCCCCC', // Texto secundario
  border: '#444444',      // Bordes
};

interface AudioFile {
  id: string;
  filename: string;
  uri: string;
  duration: number;
  modificationTime: number;
}

interface PlaylistData {
  name: string;
  songs: AudioFile[];
  createdAt: string;
}

const { width, height } = Dimensions.get('window');

export default function MusicPlayer() {
  // Estados principales
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<AudioFile[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistData[]>([]);
  const [currentSong, setCurrentSong] = useState<AudioFile | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isShuffleOn, setIsShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<'library' | 'playlist' | 'folders'>('library');
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);

  // Solicitar permisos al iniciar
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);
        
        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );
        
        if (allGranted) {
          setHasPermission(true);
          await loadInitialDataUpdated();
        } else {
          Alert.alert('Permisos requeridos', 'Necesitamos acceso al almacenamiento para funcionar');
        }
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          setHasPermission(true);
          await loadInitialDataUpdated();
        }
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        scanMusicFiles(),
        loadPlaylists(),
        loadSettings()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Escanear archivos de música
  const scanMusicFiles = async () => {
    try {
      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: 'audio',
        first: 1000,
      });

      const audioFiles: AudioFile[] = assets.assets.map(asset => ({
        id: asset.id,
        filename: asset.filename,
        uri: asset.uri,
        duration: asset.duration,
        modificationTime: asset.modificationTime,
      }));

      setAudioFiles(audioFiles);
      if (currentPlaylist.length === 0) {
        setCurrentPlaylist(audioFiles);
      }
    } catch (error) {
      console.error('Error scanning music files:', error);
      Alert.alert('Error', 'No se pudieron cargar los archivos de música');
    }
  };

  // Cargar playlists guardadas
  const loadPlaylists = async () => {
    try {
      const savedPlaylists = await AsyncStorage.getItem('playlists');
      if (savedPlaylists) {
        setPlaylists(JSON.parse(savedPlaylists));
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
    }
  };

  // Cargar configuraciones
  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('playerSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setIsShuffleOn(parsed.shuffle || false);
        setRepeatMode(parsed.repeatMode || 'off');
        setVolume(parsed.volume || 1.0);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Guardar configuraciones
  const saveSettings = async () => {
    try {
      const settings = {
        shuffle: isShuffleOn,
        repeatMode,
        volume,
      };
      await AsyncStorage.setItem('playerSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Configurar audio
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // Reproducir canción
  const playSong = async (song: AudioFile) => {
    try {
      setIsLoading(true);
      
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.uri },
        { shouldPlay: true, volume: volume }
      );

      setSound(newSound);
      setCurrentSong(song);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    } catch (error) {
      console.error('Error playing song:', error);
      Alert.alert('Error', 'No se pudo reproducir la canción');
    } finally {
      setIsLoading(false);
    }
  };

  // Actualizar estado de reproducción
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        playNextSong();
      }
    }
  };

  // Reproducir siguiente canción
  const playNextSong = () => {
    if (!currentSong || currentPlaylist.length === 0) return;

    const currentIndex = currentPlaylist.findIndex(song => song.id === currentSong.id);
    let nextIndex = currentIndex + 1;

    if (repeatMode === 'one') {
      playSong(currentSong);
      return;
    }

    if (isShuffleOn) {
      nextIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else if (nextIndex >= currentPlaylist.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    playSong(currentPlaylist[nextIndex]);
  };

  // Reproducir canción anterior
  const playPreviousSong = () => {
    if (!currentSong || currentPlaylist.length === 0) return;

    const currentIndex = currentPlaylist.findIndex(song => song.id === currentSong.id);
    let prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
      prevIndex = currentPlaylist.length - 1;
    }

    playSong(currentPlaylist[prevIndex]);
  };

  // Pausar/reanudar
  const togglePlayPause = async () => {
    if (!sound) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  // Cambiar posición
  const seekTo = async (value: number) => {
    if (!sound) return;

    try {
      await sound.setPositionAsync(value);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  // Cambiar volumen
  const changeVolume = async (value: number) => {
    setVolume(value);
    if (sound) {
      try {
        await sound.setVolumeAsync(value);
      } catch (error) {
        console.error('Error changing volume:', error);
      }
    }
  };

  // Alternar shuffle
  const toggleShuffle = () => {
    setIsShuffleOn(!isShuffleOn);
    saveSettings();
  };

  // Cambiar modo de repetición
  const toggleRepeat = () => {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
    saveSettings();
  };

  // Funciones para gestión de playlists
  const handleCreatePlaylist = async (name: string, songs: AudioFile[]) => {
    try {
      const newPlaylist: PlaylistData = {
        name,
        songs,
        createdAt: new Date().toISOString(),
      };

      const updatedPlaylists = [...playlists, newPlaylist];
      setPlaylists(updatedPlaylists);
      await AsyncStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
      
      Alert.alert('Éxito', `Playlist "${name}" creada con ${songs.length} canciones`);
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'No se pudo crear la playlist');
    }
  };

  const handleLoadPlaylist = (playlist: PlaylistData) => {
    setCurrentPlaylist(playlist.songs);
    Alert.alert('Playlist Cargada', `Se cargaron ${playlist.songs.length} canciones de "${playlist.name}"`);
  };

  const handleDeletePlaylist = async (playlist: PlaylistData) => {
    try {
      const updatedPlaylists = playlists.filter(p => p.name !== playlist.name || p.createdAt !== playlist.createdAt);
      setPlaylists(updatedPlaylists);
      await AsyncStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
      
      Alert.alert('Eliminada', `La playlist "${playlist.name}" ha sido eliminada`);
    } catch (error) {
      console.error('Error deleting playlist:', error);
      Alert.alert('Error', 'No se pudo eliminar la playlist');
    }
  };

  // Función para seleccionar carpetas
  const handleFolderSelect = async (folderPath: string) => {
    try {
      const isAlreadySelected = selectedFolders.includes(folderPath);
      let updatedFolders;
      
      if (isAlreadySelected) {
        updatedFolders = selectedFolders.filter(path => path !== folderPath);
        Alert.alert('Carpeta removida', `Se removió la carpeta del escaneo`);
      } else {
        updatedFolders = [...selectedFolders, folderPath];
        Alert.alert('Carpeta agregada', `Se agregó la carpeta al escaneo`);
      }
      
      setSelectedFolders(updatedFolders);
      await AsyncStorage.setItem('selectedFolders', JSON.stringify(updatedFolders));
      
      // Reescanear música con las nuevas carpetas
      await scanMusicFromFolders(updatedFolders);
    } catch (error) {
      console.error('Error selecting folder:', error);
      Alert.alert('Error', 'No se pudo procesar la carpeta');
    }
  };

  // Escanear música desde carpetas específicas
  const scanMusicFromFolders = async (folders: string[]) => {
    if (folders.length === 0) return;

    try {
      setIsLoading(true);
      const audioFormats = ['.mp3', '.m4a', '.flac', '.wav', '.aac', '.ogg'];
      const foundFiles: AudioFile[] = [];

      for (const folderPath of folders) {
        try {
          const items = await FileSystem.readDirectoryAsync(folderPath);
          
          for (const item of items) {
            const itemPath = `${folderPath}/${item}`;
            const itemInfo = await FileSystem.getInfoAsync(itemPath);
            
            if (!itemInfo.isDirectory && audioFormats.some(format => 
              item.toLowerCase().endsWith(format)
            )) {
              foundFiles.push({
                id: `folder-${Date.now()}-${Math.random()}`,
                filename: item,
                uri: itemPath,
                duration: 0, // Se podría obtener metadatos aquí
                modificationTime: itemInfo.modificationTime || Date.now(),
              });
            }
          }
        } catch (folderError) {
          console.error(`Error scanning folder ${folderPath}:`, folderError);
        }
      }

      // Combinar con archivos existentes de MediaLibrary y remover duplicados
      const combinedFiles = [...audioFiles];
      foundFiles.forEach(newFile => {
        const exists = combinedFiles.some(existing => 
          existing.filename === newFile.filename || existing.uri === newFile.uri
        );
        if (!exists) {
          combinedFiles.push(newFile);
        }
      });

      setAudioFiles(combinedFiles);
      if (currentPlaylist.length === 0) {
        setCurrentPlaylist(combinedFiles);
      }

      Alert.alert('Escaneo completo', `Se encontraron ${foundFiles.length} archivos nuevos en las carpetas seleccionadas`);
    } catch (error) {
      console.error('Error scanning folders:', error);
      Alert.alert('Error', 'No se pudieron escanear las carpetas');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar carpetas seleccionadas guardadas
  const loadSelectedFolders = async () => {
    try {
      const savedFolders = await AsyncStorage.getItem('selectedFolders');
      if (savedFolders) {
        const folders = JSON.parse(savedFolders);
        setSelectedFolders(folders);
        // Escanear música de las carpetas guardadas
        await scanMusicFromFolders(folders);
      }
    } catch (error) {
      console.error('Error loading selected folders:', error);
    }
  };

  // Actualizar loadInitialData para incluir carpetas
  const loadInitialDataUpdated = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        scanMusicFiles(),
        loadPlaylists(),
        loadSettings(),
        loadSelectedFolders()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar canciones por búsqueda
  const filteredSongs = audioFiles.filter(song =>
    song.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Formatear tiempo
  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Obtener icono de repetición
  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'all': return 'repeat';
      case 'one': return 'repeat-one';
      default: return 'repeat-off';
    }
  };

  // Renderizar elemento de la lista
  const renderSongItem = ({ item }: { item: AudioFile }) => (
    <TouchableOpacity
      style={[
        styles.songItem,
        currentSong?.id === item.id && styles.currentSongItem
      ]}
      onPress={() => playSong(item)}
    >
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {item.filename.replace(/\.[^/.]+$/, "")}
        </Text>
        <Text style={styles.songDuration}>
          {formatTime(item.duration * 1000)}
        </Text>
      </View>
      {currentSong?.id === item.id && isPlaying && (
        <MaterialIcons name="volume-up" size={20} color={COLORS.primary} />
      )}
    </TouchableOpacity>
  );

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.permissionContainer}>
          <MaterialIcons name="music-note" size={80} color={COLORS.primary} />
          <Text style={styles.permissionTitle}>Permisos Requeridos</Text>
          <Text style={styles.permissionText}>
            Necesitamos acceso al almacenamiento para reproducir tu música
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
            <Text style={styles.permissionButtonText}>Conceder Permisos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header con controles principales */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reproductor de Música</Text>
        <View style={styles.headerControls}>
          <TouchableOpacity onPress={() => setShowFolderBrowser(true)}>
            <MaterialIcons name="folder" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPlaylistManager(true)}>
            <MaterialIcons name="playlist-play" size={28} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar música..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Lista de canciones */}
      <View style={styles.songListContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Cargando música...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredSongs}
            renderItem={renderSongItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.songList}
          />
        )}
      </View>

      {/* Reproductor en la parte inferior */}
      {currentSong && (
        <View style={styles.playerContainer}>
          {/* Información de la canción actual */}
          <View style={styles.nowPlayingContainer}>
            <Text style={styles.nowPlayingTitle} numberOfLines={1}>
              {currentSong.filename.replace(/\.[^/.]+$/, "")}
            </Text>
            <Text style={styles.nowPlayingTime}>
              {formatTime(position)} / {formatTime(duration)}
            </Text>
          </View>

          {/* Barra de progreso */}
          <View style={styles.progressContainer}>
            <Slider
              style={styles.progressSlider}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              onSlidingComplete={seekTo}
              minimumTrackTintColor={COLORS.primary}
              maximumTrackTintColor={COLORS.border}
              thumbStyle={styles.sliderThumb}
            />
          </View>

          {/* Controles de reproducción */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity onPress={toggleShuffle}>
              <MaterialIcons 
                name="shuffle" 
                size={24} 
                color={isShuffleOn ? COLORS.primary : COLORS.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={playPreviousSong}>
              <MaterialIcons name="skip-previous" size={32} color={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.playButton} 
              onPress={togglePlayPause}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <MaterialIcons 
                  name={isPlaying ? "pause" : "play-arrow"} 
                  size={36} 
                  color={COLORS.text} 
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={playNextSong}>
              <MaterialIcons name="skip-next" size={32} color={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleRepeat}>
              <MaterialIcons 
                name={getRepeatIcon()} 
                size={24} 
                color={repeatMode !== 'off' ? COLORS.primary : COLORS.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          {/* Control de volumen */}
          <View style={styles.volumeContainer}>
            <MaterialIcons name="volume-down" size={20} color={COLORS.textSecondary} />
            <Slider
              style={styles.volumeSlider}
              minimumValue={0}
              maximumValue={1}
              value={volume}
              onValueChange={changeVolume}
              minimumTrackTintColor={COLORS.primary}
              maximumTrackTintColor={COLORS.border}
              thumbStyle={styles.sliderThumb}
            />
            <MaterialIcons name="volume-up" size={20} color={COLORS.textSecondary} />
          </View>
        </View>
      )}

      {/* Modales */}
      <Modal
        visible={showFolderBrowser}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowFolderBrowser(false)}
      >
        <FolderBrowser
          onFolderSelect={handleFolderSelect}
          onClose={() => setShowFolderBrowser(false)}
          selectedFolders={selectedFolders}
        />
      </Modal>

      <Modal
        visible={showPlaylistManager}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPlaylistManager(false)}
      >
        <PlaylistManager
          playlists={playlists}
          currentPlaylist={currentPlaylist}
          onCreatePlaylist={handleCreatePlaylist}
          onLoadPlaylist={handleLoadPlaylist}
          onDeletePlaylist={handleDeletePlaylist}
          onClose={() => setShowPlaylistManager(false)}
          audioFiles={audioFiles}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 16,
  },
  permissionText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerControls: {
    flexDirection: 'row',
    gap: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
  },
  songListContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  songList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  currentSongItem: {
    backgroundColor: COLORS.primary + '20',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  songDuration: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  playerContainer: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  nowPlayingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nowPlayingTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 16,
  },
  nowPlayingTime: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressSlider: {
    height: 40,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  playButton: {
    backgroundColor: COLORS.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  volumeSlider: {
    flex: 1,
    height: 30,
  },
  sliderThumb: {
    backgroundColor: COLORS.primary,
    width: 16,
    height: 16,
  },
});