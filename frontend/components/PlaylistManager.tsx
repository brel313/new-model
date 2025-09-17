import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  SafeAreaView,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const COLORS = {
  primary: '#CC4F00',
  secondary: '#FF6B1A',
  accent: '#FFB366',
  background: '#1A1A1A',
  surface: '#2D2D2D',
  text: '#FFFFFF',
  textSecondary: '#CCCCCC',
  border: '#444444',
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

interface PlaylistManagerProps {
  playlists: PlaylistData[];
  currentPlaylist: AudioFile[];
  onCreatePlaylist: (name: string, songs: AudioFile[]) => void;
  onLoadPlaylist: (playlist: PlaylistData) => void;
  onDeletePlaylist: (playlist: PlaylistData) => void;
  onClose: () => void;
  audioFiles: AudioFile[];
}

export default function PlaylistManager({
  playlists,
  currentPlaylist,
  onCreatePlaylist,
  onLoadPlaylist,
  onDeletePlaylist,
  onClose,
  audioFiles
}: PlaylistManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedSongs, setSelectedSongs] = useState<AudioFile[]>([]);
  const [isSelectingMode, setIsSelectingMode] = useState(false);

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
    setIsSelectingMode(false);
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
        style={[styles.songItem, isSelected && styles.selectedSongItem]}
        onPress={() => toggleSongSelection(item)}
      >
        <MaterialIcons
          name={isSelected ? 'check-circle' : 'music-note'}
          size={24}
          color={isSelected ? COLORS.primary : COLORS.textSecondary}
        />
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {item.filename.replace(/\.[^/.]+$/, "")}
          </Text>
          <Text style={styles.songDuration}>
            {formatTime(item.duration * 1000)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <MaterialIcons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Gestión de Playlists</Text>
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
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal para crear playlist */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowCreateModal(false);
              setIsSelectingMode(false);
              setSelectedSongs([]);
              setNewPlaylistName('');
            }}>
              <MaterialIcons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nueva Playlist</Text>
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
            style={styles.songList}
            contentContainerStyle={styles.songListContent}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  title: {
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
  list: {
    flex: 1,
  },
  listContent: {
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
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
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
  songList: {
    flex: 1,
  },
  songListContent: {
    paddingHorizontal: 20,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    marginVertical: 2,
    borderRadius: 8,
    gap: 12,
  },
  selectedSongItem: {
    backgroundColor: COLORS.primary + '20',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  songDuration: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
});