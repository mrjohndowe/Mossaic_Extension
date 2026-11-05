import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useCallback } from 'react';
import { Image } from 'expo-image';
import { MediaItem } from '../types';
import { PreferencesStore } from '../store/preferences';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ViewerScreen() {
  const { item: itemParam, allItems: allItemsParam, currentIndex: currentIndexParam } = useLocalSearchParams<{
    item: string;
    allItems: string;
    currentIndex: string;
  }>();

  const [currentItem, setCurrentItem] = useState<MediaItem>(JSON.parse(itemParam));
  const [allItems, setAllItems] = useState<MediaItem[]>(JSON.parse(allItemsParam));
  const [currentIndex, setCurrentIndex] = useState(parseInt(currentIndexParam, 10));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const prefStore = PreferencesStore.getInstance();
  const isFavorite = prefStore.isFavorite(currentItem.id);

  const navigateToNext = useCallback(() => {
    if (currentIndex < allItems.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextItem = allItems[nextIndex];
      setCurrentItem(nextItem);
      setCurrentIndex(nextIndex);
      setGalleryIndex(0);
    }
  }, [currentIndex, allItems]);

  const navigateToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevItem = allItems[prevIndex];
      setCurrentItem(prevItem);
      setCurrentIndex(prevIndex);
      setGalleryIndex(0);
    }
  }, [currentIndex, allItems]);

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleToggleFavorite = () => {
    prefStore.toggleFavorite(currentItem.id);
  };

  const handleNextGallery = () => {
    if (currentItem.galleryItems && galleryIndex < currentItem.galleryItems.length - 1) {
      setGalleryIndex(galleryIndex + 1);
    }
  };

  const handlePrevGallery = () => {
    if (galleryIndex > 0) {
      setGalleryIndex(galleryIndex - 1);
    }
  };

  const getCurrentUrl = () => {
    if (currentItem.type === 'gallery' && currentItem.galleryItems) {
      return currentItem.galleryItems[galleryIndex].url;
    }
    return currentItem.url;
  };

  const renderContent = () => {
    const url = getCurrentUrl();

    if (currentItem.type === 'video') {
      return (
        <View style={styles.videoPlaceholder}>
          <Text style={styles.videoPlaceholderText}>Video playback not yet implemented</Text>
          <Text style={styles.videoUrl}>{url}</Text>
        </View>
      );
    }

    return (
      <View style={styles.mediaContainer}>
        <Image
          source={{ uri: url }}
          style={styles.fullMedia}
          contentFit="contain"
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen} />

      {renderContent()}

      {showControls && (
        <>
          <View style={styles.topControls}>
            <TouchableOpacity onPress={() => router.back()} style={styles.controlButton}>
              <Text style={styles.controlText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowInfo(!showInfo)} style={styles.controlButton}>
              <Text style={styles.controlText}>ℹ</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomControls}>
            <TouchableOpacity onPress={navigateToPrevious} disabled={currentIndex === 0} style={styles.navButton}>
              <Text style={styles.navText}>←</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleToggleFavorite} style={styles.controlButton}>
              <Text style={styles.controlText}>{isFavorite ? '★' : '☆'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToggleFullscreen} style={styles.controlButton}>
              <Text style={styles.controlText}>{isFullscreen ? '⤢' : '⤡'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={navigateToNext} disabled={currentIndex === allItems.length - 1} style={styles.navButton}>
              <Text style={styles.navText}>→</Text>
            </TouchableOpacity>
          </View>

          {currentItem.type === 'gallery' && currentItem.galleryItems && (
            <View style={styles.galleryControls}>
              <TouchableOpacity onPress={handlePrevGallery} disabled={galleryIndex === 0} style={styles.galleryButton}>
                <Text style={styles.galleryText}>← Prev</Text>
              </TouchableOpacity>
              <Text style={styles.galleryInfo}>
                {galleryIndex + 1} / {currentItem.galleryItems.length}
              </Text>
              <TouchableOpacity
                onPress={handleNextGallery}
                disabled={galleryIndex === currentItem.galleryItems.length - 1}
                style={styles.galleryButton}
              >
                <Text style={styles.galleryText}>Next →</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {showInfo && (
        <View style={styles.infoPanel}>
          <Text style={styles.infoTitle}>{currentItem.title}</Text>
          <Text style={styles.infoMeta}>Posted by u/{currentItem.author}</Text>
          <Text style={styles.infoMeta}>r/{currentItem.subreddit}</Text>
          <Text style={styles.infoMeta}>{currentIndex + 1} of {allItems.length}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.hideButton}
        onPress={() => setShowControls(!showControls)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlText: {
    fontSize: 24,
    color: '#fff',
  },
  navButton: {
    width: 60,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  galleryControls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  galleryButton: {
    padding: 10,
  },
  galleryText: {
    fontSize: 16,
    color: '#fff',
  },
  galleryInfo: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  infoPanel: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoMeta: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4,
  },
  hideButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  videoPlaceholderText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
  },
  videoUrl: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
