import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { PreferencesStore } from '../store/preferences';
import { UserPreferences } from '../types';

export default function SettingsScreen() {
  const [prefs, setPrefs] = useState<UserPreferences>({
    filter: 'all',
    sort: 'hot',
    time: 'day',
    cols: 2,
    turbo: false,
    nsfw: true,
  });

  const prefStore = PreferencesStore.getInstance();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    const loaded = await prefStore.loadPreferences();
    setPrefs(loaded);
  };

  const handleSave = async () => {
    await prefStore.savePreferences(prefs);
    router.back();
  };

  const updatePref = (key: keyof UserPreferences, value: any) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Layout</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Columns</Text>
            <View style={styles.pickerContainer}>
              {[1, 2, 3, 4].map(num => (
                <TouchableOpacity
                  key={num}
                  style={[styles.pickerOption, prefs.cols === num && styles.pickerOptionActive]}
                  onPress={() => updatePref('cols', num)}
                >
                  <Text style={[styles.pickerText, prefs.cols === num && styles.pickerTextActive]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Turbo Mode</Text>
            <Switch
              value={prefs.turbo}
              onValueChange={(value) => updatePref('turbo', value)}
              trackColor={{ false: '#333', true: '#ff1f5a' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content Filter</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Filter Type</Text>
            <View style={styles.pickerContainer}>
              {(['all', 'image', 'video'] as const).map(filter => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.pickerOption, prefs.filter === filter && styles.pickerOptionActive]}
                  onPress={() => updatePref('filter', filter)}
                >
                  <Text style={[styles.pickerText, prefs.filter === filter && styles.pickerTextActive]}>
                    {filter === 'all' ? 'All' : filter === 'image' ? 'Images' : 'Videos'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Show NSFW</Text>
            <Switch
              value={prefs.nsfw}
              onValueChange={(value) => updatePref('nsfw', value)}
              trackColor={{ false: '#333', true: '#ff1f5a' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sorting</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Sort By</Text>
            <View style={styles.pickerContainer}>
              {(['hot', 'new', 'top', 'rising'] as const).map(sort => (
                <TouchableOpacity
                  key={sort}
                  style={[styles.pickerOption, prefs.sort === sort && styles.pickerOptionActive]}
                  onPress={() => updatePref('sort', sort)}
                >
                  <Text style={[styles.pickerText, prefs.sort === sort && styles.pickerTextActive]}>
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {prefs.sort === 'top' && (
            <View style={styles.row}>
              <Text style={styles.label}>Time Range</Text>
              <View style={styles.pickerContainer}>
                {(['hour', 'day', 'week', 'month', 'year', 'all'] as const).map(time => (
                  <TouchableOpacity
                    key={time}
                    style={[styles.pickerOption, prefs.time === time && styles.pickerOptionActive]}
                    onPress={() => updatePref('time', time)}
                  >
                    <Text style={[styles.pickerText, prefs.time === time && styles.pickerTextActive]}>
                      {time.charAt(0).toUpperCase() + time.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <Text style={styles.statText}>
            Favorites: {prefStore.getFavorites().length}
          </Text>
          <Text style={styles.statText}>
            Hidden: {prefStore.getHidden().length}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#0a0a0c',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1f',
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
  saveButton: {
    fontSize: 16,
    color: '#ff1f5a',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#ffffff',
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1f',
  },
  pickerOptionActive: {
    backgroundColor: '#ff1f5a',
  },
  pickerText: {
    fontSize: 14,
    color: '#888',
  },
  pickerTextActive: {
    color: '#ffffff',
  },
  statText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
  },
});
