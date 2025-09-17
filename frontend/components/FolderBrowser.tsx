import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
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

interface FolderItem {
  name: string;
  uri: string;
  isDirectory: boolean;
  size?: number;
}

interface FolderBrowserProps {
  onFolderSelect: (folderPath: string) => void;
  onClose: () => void;
  selectedFolders: string[];
}

export default function FolderBrowser({ onFolderSelect, onClose, selectedFolders }: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState(FileSystem.documentDirectory || '');
  const [items, setItems] = useState<FolderItem[]>([]);
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
      const folderItems: FolderItem[] = [];

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

      // Ordenar: carpetas primero, luego archivos
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

  const handleItemPress = (item: FolderItem) => {
    if (item.isDirectory) {
      setCurrentPath(item.uri);
    }
  };

  const handleSelectFolder = (folderPath: string) => {
    onFolderSelect(folderPath);
  };

  const renderItem = ({ item }: { item: FolderItem }) => {
    const isSelected = selectedFolders.includes(item.uri);
    
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.selectedItem]}
        onPress={() => handleItemPress(item)}
        onLongPress={() => item.isDirectory && handleSelectFolder(item.uri)}
      >
        <MaterialIcons
          name={item.isDirectory ? 'folder' : 'audio-file'}
          size={24}
          color={item.isDirectory ? COLORS.primary : COLORS.textSecondary}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {!item.isDirectory && item.size && (
            <Text style={styles.itemSize}>
              {formatFileSize(item.size)}
            </Text>
          )}
        </View>
        {item.isDirectory && (
          <TouchableOpacity
            style={styles.selectButton}
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <MaterialIcons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Explorador de Carpetas</Text>
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
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 2,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    gap: 12,
  },
  selectedItem: {
    backgroundColor: COLORS.primary + '20',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  itemSize: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  selectButton: {
    padding: 8,
  },
});