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
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

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

// Componente FolderBrowser integrado
function FolderBrowser({ onFolderSelect, onClose, selectedFolders }: {
  onFolderSelect: (folderPath: string) => void;
  onClose: () => void;
  selectedFolders: string[];
}) {
  const [currentPath, setCurrentPath] = useState(FileSystem.documentDirectory || '');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        Alert.alert('Error', 'La carpeta no existe');
        return;
      }

      const items = await FileSystem.readDirectoryAsync(path);
      const folderItems: any[] = [];

      for (const item of items) {
        const itemPath = `${path}/${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);
        
        folderItems.push({
          name: item,
          uri: itemPath,
          isDirectory: itemInfo.isDirectory,
          size: itemInfo.size,
        });
      }

      folderItems.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      setItems(folderItems);
    } catch (error) {
      console.error('Error loading directory:', error);
      Alert.alert('Error', 'No se pudo cargar la carpeta');
    } finally {
      setLoading(false);
    }
  };

  const navigateToParent = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    if (parentPath) {
      setCurrentPath(parentPath);
    }
  };

  const handleItemPress = (item: any) => {
    if (item.isDirectory) {
      setCurrentPath(item.uri);
    }
  };

  const handleSelectFolder = (folderPath: string) => {
    onFolderSelect(folderPath);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSelected = selectedFolders.includes(item.uri);
    
    return (
      <TouchableOpacity
        style={[styles.folderItem, isSelected && styles.selectedFolderItem]}
        onPress={() => handleItemPress(item)}
        onLongPress={() => item.isDirectory && handleSelectFolder(item.uri)}
      >
        <MaterialIcons
          name={item.isDirectory ? 'folder' : 'audio-file'}
          size={24}
          color={item.isDirectory ? COLORS.primary : COLORS.textSecondary}
        />
        <View style={styles.folderItemInfo}>
          <Text style={styles.folderItemName} numberOfLines={1}>
            {item.name}
          </Text>
          {!item.isDirectory && item.size && (
            <Text style={styles.folderItemSize}>
              {formatFileSize(item.size)}
            </Text>
          )}
        </View>
        {item.isDirectory && (
          <TouchableOpacity
            style={styles.folderSelectButton}
            onPress={() => handleSelectFolder(item.uri)}
          >
            <MaterialIcons
              name={isSelected ? 'check-circle' : 'add-circle-outline'}
              size={20}
              color={isSelected ? COLORS.primary : COLORS.textSecondary}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.folderBrowserContainer}>
      <View style={styles.folderHeader}>
        <TouchableOpacity onPress={onClose}>
          <MaterialIcons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.folderTitle}>Explorador de Carpetas</Text>
        <TouchableOpacity onPress={navigateToParent}>
          <MaterialIcons name="arrow-upward" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.pathContainer}>
        <Text style={styles.currentPath} numberOfLines={1}>
          {currentPath}
        </Text>
      </View>

      <View style={styles.selectedInfo}>
        <Text style={styles.selectedText}>
          Carpetas seleccionadas: {selectedFolders.length}
        </Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.uri}
        style={styles.folderList}
        contentContainerStyle={styles.folderListContent}
      />
    </SafeAreaView>
  );
}

// Componente PlaylistManager integrado
function PlaylistManager({
  playlists,
  currentPlaylist,
  onCreatePlaylist,
  onLoadPlaylist,
  onDeletePlaylist,
  onClose,
  audioFiles
}: {
  playlists: PlaylistData[];
  currentPlaylist: AudioFile[];
  onCreatePlaylist: (name: string, songs: AudioFile[]) => void;
  onLoadPlaylist: (playlist: PlaylistData) => void;
  onDeletePlaylist: (playlist: PlaylistData) => void;
  onClose: () => void;
  audioFiles: AudioFile[];
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedSongs, setSelectedSongs] = useState<AudioFile[]>([]);

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para la playlist');
      return;
    }

    if (selectedSongs.length === 0) {
      Alert.alert('Error', 'Selecciona al menos una canción');
      return;
    }

    onCreatePlaylist(newPlaylistName.trim(), selectedSongs);
    setNewPlaylistName('');
    setSelectedSongs([]);
    setShowCreateModal(false);
  };

  const handleDeletePlaylist = (playlist: PlaylistData) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que quieres eliminar la playlist "${playlist.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: () => onDeletePlaylist(playlist)
        },
      ]
    );
  };

  const toggleSongSelection = (song: AudioFile) => {
    const isSelected = selectedSongs.some(s => s.id === song.id);
    if (isSelected) {
      setSelectedSongs(selectedSongs.filter(s => s.id !== song.id));
    } else {
      setSelectedSongs([...selectedSongs, song]);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderPlaylistItem = ({ item }: { item: PlaylistData }) => (
    <View style={styles.playlistItem}>
      <TouchableOpacity 
        style={styles.playlistInfo}
        onPress={() => onLoadPlaylist(item)}
      >
        <MaterialIcons name="playlist-play" size={24} color={COLORS.primary} />
        <View style={styles.playlistDetails}>
          <Text style={styles.playlistName}>{item.name}</Text>
          <Text style={styles.playlistSongCount}>
            {item.songs.length} canciones
          </Text>
          <Text style={styles.playlistDate}>
            Creada: {new Date(item.createdAt).toLocaleDateString('es-ES')}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeletePlaylist(item)}
      >
        <MaterialIcons name="delete" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  const renderSongItem = ({ item }: { item: AudioFile }) => {
    const isSelected = selectedSongs.some(s => s.id === item.id);
    
    return (
      <TouchableOpacity
        style={[styles.playlistSongItem, isSelected && styles.selectedPlaylistSongItem]}
        onPress={() => toggleSongSelection(item)}
      >
        <MaterialIcons
          name={isSelected ? 'check-circle' : 'music-note'}
          size={24}
          color={isSelected ? COLORS.primary : COLORS.textSecondary}
        />
        <View style={styles.playlistSongInfo}>
          <Text style={styles.playlistSongTitle} numberOfLines={1}>
            {item.filename.replace(/\.[^/.]+$/, "")}
          </Text>
          <Text style={styles.playlistSongDuration}>
            {formatTime(item.duration * 1000)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.playlistManagerContainer}>
      <View style={styles.playlistHeader}>
        <TouchableOpacity onPress={onClose}>
          <MaterialIcons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.playlistTitle}>Gestión de Playlists</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
          <MaterialIcons name="add" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.currentPlaylistInfo}>
        <Text style={styles.currentPlaylistTitle}>Playlist Actual</Text>
        <Text style={styles.currentPlaylistCount}>
          {currentPlaylist.length} canciones en reproducción
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Playlists Guardadas</Text>
      
      {playlists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="playlist-add" size={60} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>No hay playlists guardadas</Text>
          <Text style={styles.emptySubtext}>
            Crea tu primera playlist tocando el botón +
          </Text>
        </View>
      ) : (
        <FlatList
          data={playlists}
          renderItem={renderPlaylistItem}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          style={styles.playlistList}
          contentContainerStyle={styles.playlistListContent}
        />
      )}

      {/* Modal para crear playlist */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <SafeAreaView style={styles.playlistModalContainer}>
          <View style={styles.playlistModalHeader}>
            <TouchableOpacity onPress={() => {
              setShowCreateModal(false);
              setSelectedSongs([]);
              setNewPlaylistName('');
            }}>
              <MaterialIcons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.playlistModalTitle}>Nueva Playlist</Text>
            <TouchableOpacity 
              onPress={handleCreatePlaylist}
              disabled={!newPlaylistName.trim() || selectedSongs.length === 0}
            >
              <MaterialIcons 
                name="check" 
                size={24} 
                color={(!newPlaylistName.trim() || selectedSongs.length === 0) 
                  ? COLORS.textSecondary 
                  : COLORS.primary
                } 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.nameInputContainer}>
            <TextInput
              style={styles.nameInput}
              placeholder="Nombre de la playlist"
              placeholderTextColor={COLORS.textSecondary}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              maxLength={50}
            />
          </View>

          <View style={styles.selectionInfo}>
            <Text style={styles.selectionText}>
              Seleccionadas: {selectedSongs.length} de {audioFiles.length}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (selectedSongs.length === audioFiles.length) {
                  setSelectedSongs([]);
                } else {
                  setSelectedSongs([...audioFiles]);
                }
              }}
            >
              <Text style={styles.selectAllText}>
                {selectedSongs.length === audioFiles.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={audioFiles}
            renderItem={renderSongItem}
            keyExtractor={item => item.id}
            style={styles.playlistSongList}
            contentContainerStyle={styles.playlistSongListContent}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

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
          await loadInitialData();
        } else {
          Alert.alert('Permisos requeridos', 'Necesitamos acceso al almacenamiento para funcionar');
        }
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          setHasPermission(true);
          await loadInitialData();
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
        loadSettings(),
        loadSelectedFolders()
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

  // Cargar carpetas seleccionadas guardadas
  const loadSelectedFolders = async () => {
    try {
      const savedFolders = await AsyncStorage.getItem('selectedFolders');
      if (savedFolders) {
        const folders = JSON.parse(savedFolders);
        setSelectedFolders(folders);
      }
    } catch (error) {
      console.error('Error loading selected folders:', error);
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
      do {
        nextIndex = Math.floor(Math.random() * currentPlaylist.length);
      } while (nextIndex === currentIndex && currentPlaylist.length > 1);
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

  // Función para iniciar reproducción random automática
  const startRandomPlayback = () => {
    if (currentPlaylist.length > 0 && !currentSong) {
      const randomIndex = Math.floor(Math.random() * currentPlaylist.length);
      playSong(currentPlaylist[randomIndex]);
    }
  };

  // Iniciar reproducción automática cuando se cargan las canciones
  useEffect(() => {
    if (!isLoading && currentPlaylist.length > 0 && !currentSong && hasPermission) {
      const timer = setTimeout(() => {
        startRandomPlayback();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [currentPlaylist, isLoading, hasPermission]);

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
    } catch (error) {
      console.error('Error selecting folder:', error);
      Alert.alert('Error', 'No se pudo procesar la carpeta');
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
  // Estilos para FolderBrowser
  folderBrowserContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  folderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  pathContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  currentPath: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  selectedInfo: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  selectedText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  folderList: {
    flex: 1,
  },
  folderListContent: {
    paddingHorizontal: 20,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 2,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    gap: 12,
  },
  selectedFolderItem: {
    backgroundColor: COLORS.primary + '20',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  folderItemInfo: {
    flex: 1,
  },
  folderItemName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  folderItemSize: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  folderSelectButton: {
    padding: 8,
  },
  // Estilos para PlaylistManager
  playlistManagerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  playlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  playlistTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  currentPlaylistInfo: {
    padding: 20,
    backgroundColor: COLORS.surface,
    marginBottom: 16,
  },
  currentPlaylistTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  currentPlaylistCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  playlistList: {
    flex: 1,
  },
  playlistListContent: {
    paddingHorizontal: 20,
  },
  playlistItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginVertical: 4,
  },
  playlistInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  playlistDetails: {
    flex: 1,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  playlistSongCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  playlistDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  deleteButton: {
    padding: 16,
    justifyContent: 'center',
  },
  playlistModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  playlistModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  playlistModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  nameInputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  nameInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  selectionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  selectAllText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  playlistSongList: {
    flex: 1,
  },
  playlistSongListContent: {
    paddingHorizontal: 20,
  },
  playlistSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    marginVertical: 2,
    borderRadius: 8,
    gap: 12,
  },
  selectedPlaylistSongItem: {
    backgroundColor: COLORS.primary + '20',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  playlistSongInfo: {
    flex: 1,
  },
  playlistSongTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  playlistSongDuration: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
});