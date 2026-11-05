import { View, Text, FlatList, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Image } from 'expo-image';
import { RedditApiService } from '../services/redditApi';
import { PreferencesStore } from '../store/preferences';
import { MediaItem, RedditSource, UserPreferences } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_SPACING = 8;

export default function WallScreen() {
  const { source: sourceParam } = useLocalSearchParams<{ source: string }>();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter] = useState<string | null>(null);
  const [source, setSource] = useState<RedditSource | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>({
    filter: 'all',
    sort: 'hot',
    time: 'day',
    cols: 2,
    turbo: false,
    nsfw: true,
  });

  const redditApi = RedditApiService.getInstance();
  const prefStore = PreferencesStore.getInstance();

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    if (sourceParam) {
      const parsed = redditApi.parseSource(sourceParam, true);
      if (parsed) {
        setSource(parsed);
        loadItems(parsed);
      }
    }
  }, [sourceParam]);

  const loadPreferences = async () => {
    const loaded = await prefStore.loadPreferences();
    setPrefs(loaded);
  };

  const loadItems = async (src: RedditSource, afterToken?: string) => {
    try {
      if (!afterToken) setLoading(true);
      else setLoadingMore(true);

      const { items: newItems, after: newAfter } = await redditApi.fetchMediaItems(src, prefs, afterToken);

      if (afterToken) {
        setItems(prev => [...prev, ...newItems]);
      } else {
        setItems(newItems);
      }

      setAfter(newAfter);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = useCallback(() => {
    if (source) {
      setAfter(null);
      loadItems(source);
    }
  }, [source, prefs]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && after && source) {
      loadItems(source, after);
    }
  }, [loadingMore, after, source, prefs]);

  const handlePress = (item: MediaItem) => {
    router.push({
      pathname: '/viewer',
      params: {
        item: JSON.stringify(item),
        allItems: JSON.stringify(items),
        currentIndex: items.findIndex(i => i.id === item.id).toString(),
      },
    });
  };

  const renderMasonryColumn = (columnItems: MediaItem[], columnWidth: number) => {
    return (
      <View style={{ width: columnWidth, gap: COLUMN_SPACING }}>
        {columnItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.item}
            onPress={() => handlePress(item)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: item.thumbnail || item.url }}
              style={[styles.image, { aspectRatio: item.width && item.height ? item.width / item.height : 1 }]}
              contentFit="cover"
              transition={200}
            />
            {item.nsfw && (
              <View style={styles.nsfwBadge}>
                <Text style={styles.nsfwText}>NSFW</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderMasonry = () => {
    const numColumns = prefs.cols;
    const columnWidth = (SCREEN_WIDTH - (numColumns + 1) * COLUMN_SPACING) / numColumns;

    const columns: MediaItem[][] = Array.from({ length: numColumns }, () => []);

    items.forEach((item, index) => {
      columns[index % numColumns].push(item);
    });

    return (
      <View style={styles.masonryContainer}>
        {columns.map((columnItems, index) => (
          <View key={index} style={{ marginRight: index < numColumns - 1 ? COLUMN_SPACING : 0 }}>
            {renderMasonryColumn(columnItems, columnWidth)}
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ff1f5a" />
        <Text style={styles.loadingText}>Loading media wall...</Text>
      </View>
    );
  }

  if (!source) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Invalid source</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{source.label}</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Text style={styles.settingsButton}>⚙</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No media found</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={() => null}
          ListHeaderComponent={renderMasonry}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={handleRefresh}
              tintColor="#ff1f5a"
              colors={['#ff1f5a']}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#ff1f5a" />
              </View>
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0c',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#0a0a0c',
  },
  backButton: {
    fontSize: 16,
    color: '#ff1f5a',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  settingsButton: {
    fontSize: 24,
    color: '#ffffff',
  },
  masonryContainer: {
    flexDirection: 'row',
    paddingHorizontal: COLUMN_SPACING,
    paddingBottom: 20,
  },
  item: {
    backgroundColor: '#1a1a1f',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
  },
  nsfwBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 31, 90, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  nsfwText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#ff1f5a',
    fontSize: 18,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
});
