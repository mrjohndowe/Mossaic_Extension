import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { PreferencesStore } from '../store/preferences';
import { RedditApiService } from '../services/redditApi';
import { UserPreferences, UserProfile } from '../types';

const ACCENT = '#ff1f5a';
const ACCENT_B = '#9b1dff';
const DEFAULT_WATCH = ['u/former-wolverine84/m/nothing_but_goths'];
const DEFAULT_PREFS: UserPreferences = {
  filter: 'all', sort: 'hot', time: 'day', cols: 4, turbo: false, nsfw: true,
};
const SORTS = ['hot', 'new', 'top', 'rising'] as const;
const TIMES = ['hour', 'day', 'week', 'month', 'year', 'all'] as const;

function Choice<T extends string | number>({
  value, selected, label, onPress,
}: { value: T; selected: boolean; label: string; onPress: (value: T) => void }) {
  return (
    <Pressable onPress={() => onPress(value)} style={[styles.choice, selected && styles.choiceOn]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [watch, setWatch] = useState(DEFAULT_WATCH);
  const [sourceText, setSourceText] = useState('');
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<UserProfile['sex'] | ''>('');
  const [location, setLocation] = useState('');
  const [showSameAnatomy, setShowSameAnatomy] = useState(true);
  const [profileError, setProfileError] = useState('');
  const api = useMemo(() => RedditApiService.getInstance(), []);
  const store = useMemo(() => PreferencesStore.getInstance(), []);

  useEffect(() => {
    let active = true;
    Promise.all([
      SecureStore.getItemAsync('mz_watchlist'),
      store.loadPreferences(),
      store.loadProfile(),
    ]).then(([savedWatch, savedPrefs, savedProfile]) => {
      if (!active) return;
      if (savedWatch) {
        try {
          const parsed: unknown = JSON.parse(savedWatch);
          if (Array.isArray(parsed)) setWatch(parsed.filter((item): item is string => typeof item === 'string'));
        } catch { /* Keep the default watchlist when stored data is invalid. */ }
      }
      setPrefs({ ...DEFAULT_PREFS, ...savedPrefs });
      setProfile(savedProfile);
      if (savedProfile) {
        setAge(String(savedProfile.age));
        setSex(savedProfile.sex);
        setLocation(savedProfile.location || '');
        setShowSameAnatomy(savedProfile.showSameAnatomy !== false);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [store]);

  const savePrefs = (next: UserPreferences) => {
    setPrefs(next);
    void store.savePreferences(next);
  };

  const openWall = (rawSource?: string) => {
    const input = rawSource ?? watch[0] ?? DEFAULT_WATCH[0];
    const parsed = api.parseSource(input, true);
    if (!parsed) {
      Alert.alert('Source not recognized', 'Enter a Reddit URL, r/name, u/name, or u/name/m/feed.');
      return;
    }
    Keyboard.dismiss();
    router.push({ pathname: '/wall', params: { source: parsed.label } });
  };

  const addSource = async () => {
    const parsed = api.parseSource(sourceText, true);
    if (!parsed) {
      Alert.alert('Source not recognized', 'Enter a Reddit URL, r/name, u/name, or u/name/m/feed.');
      return;
    }
    const next = [parsed.label, ...watch.filter((item) => item !== parsed.label)].slice(0, 8);
    setWatch(next);
    setSourceText('');
    await SecureStore.setItemAsync('mz_watchlist', JSON.stringify(next));
    openWall(parsed.label);
  };

  const saveProfile = async () => {
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setProfileError('Enter a valid age.');
      return;
    }
    if (parsedAge < 18) {
      setProfileError('Mosaic media browsing is available only to adults 18 and older.');
      return;
    }
    if (!sex) {
      setProfileError('Choose an option to continue.');
      return;
    }
    const next: UserProfile = {
      age: parsedAge,
      sex,
      location: location.trim(),
      showSameAnatomy,
      savedAt: Date.now(),
    };
    await store.saveProfile(next);
    setProfile(next);
    setProfileError('');
  };

  const needsProfile = !profile || profile.age < 18;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}><View style={styles.logoMark} /></View>
          <View style={styles.brand}>
            <Text style={styles.brandName}>MOSAIC</Text>
            <Text style={styles.brandVersion}>MEDIA WALL · MOBILE</Text>
          </View>
          <View style={styles.unlimited}><Text style={styles.unlimitedText}>∞  UNLIMITED</Text></View>
        </View>

        {needsProfile ? (
          <View style={[styles.card, styles.onboardingCard]}>
            <Text style={styles.cardTitle}>PERSONALIZE MOSAIC</Text>
            <Text style={styles.mutedParagraph}>Your profile stays on this device. Confirm your age to continue.</Text>
            <Text style={styles.label}>Age</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="18 or older" placeholderTextColor="#777382" maxLength={3} />
            <Text style={styles.label}>Sex</Text>
            <View style={styles.wrapChoices}>
              {(['male', 'female', 'other'] as const).map((item) => (
                <Choice key={item} value={item} selected={sex === item} label={item === 'other' ? 'Other / prefer not to say' : item[0].toUpperCase() + item.slice(1)} onPress={setSex} />
              ))}
            </View>
            <Text style={[styles.label, styles.labelSpaced]}>Location <Text style={styles.small}>(optional, country or region)</Text></Text>
            <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Country or region" placeholderTextColor="#777382" maxLength={80} />
            {(sex === 'male' || sex === 'female') && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{`Show media with visible ${sex} anatomy`}</Text>
                <Switch value={showSameAnatomy} onValueChange={setShowSameAnatomy} trackColor={{ false: '#34313f', true: ACCENT }} thumbColor="#fff" />
              </View>
            )}
            <Text style={styles.privacy}>Profile details stay local and aren’t sent to Mosaic. Anatomy filtering needs a local detector and is not available yet.</Text>
            {!!profileError && <Text style={styles.error}>{profileError}</Text>}
            <Pressable style={styles.primaryButton} onPress={saveProfile}><Text style={styles.primaryText}>Save and continue</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.card, styles.hero]}>
              <View style={styles.whereRow}>
                <View style={styles.statusDot} />
                <View style={styles.whereCopy}>
                  <Text style={styles.eyebrow}>READY TO BROWSE</Text>
                  <Text style={styles.sourceTitle} numberOfLines={1}>{watch[0] || DEFAULT_WATCH[0]}</Text>
                </View>
              </View>
              <Pressable style={styles.primaryButton} onPress={() => openWall()}><Text style={styles.primaryText}>Open media wall</Text></Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>OPEN A DIFFERENT SOURCE</Text>
              <View style={styles.sourceForm}>
                <TextInput style={[styles.input, styles.sourceInput]} value={sourceText} onChangeText={setSourceText} onSubmitEditing={addSource} returnKeyType="go" autoCapitalize="none" autoCorrect={false} placeholder="r/name, feed or Reddit URL" placeholderTextColor="#777382" />
                <Pressable style={styles.goButton} onPress={addSource}><Text style={styles.goText}>Go</Text></Pressable>
              </View>
              <View style={styles.chips}>
                {watch.slice(0, 8).map((item) => <Pressable key={item} style={styles.chip} onPress={() => openWall(item)} onLongPress={() => Alert.alert('Remove source?', item, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { const next = watch.filter((saved) => saved !== item); setWatch(next); void SecureStore.setItemAsync('mz_watchlist', JSON.stringify(next)); } }])}><Text style={styles.chipText} numberOfLines={1}>{item}</Text></Pressable>)}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>QUICK SETTINGS</Text>
              <View style={styles.settingRow}>
                <Text style={styles.rowLabel}>Show</Text>
                <View style={styles.segment}>
                  {(['all', 'image', 'video'] as const).map((item) => <Choice key={item} value={item} selected={prefs.filter === item} label={item === 'image' ? 'Images' : item === 'video' ? 'Videos' : 'All'} onPress={(filter) => savePrefs({ ...prefs, filter })} />)}
                </View>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.rowLabel}>Sort</Text>
                <View style={styles.wrapChoices}>
                  {SORTS.map((item) => <Choice key={item} value={item} selected={prefs.sort === item} label={item[0].toUpperCase() + item.slice(1)} onPress={(sort) => savePrefs({ ...prefs, sort })} />)}
                </View>
              </View>
              {prefs.sort === 'top' && <View style={styles.settingRow}><Text style={styles.rowLabel}>Time</Text><View style={styles.wrapChoices}>{TIMES.map((item) => <Choice key={item} value={item} selected={prefs.time === item} label={item === 'hour' ? 'Hour' : item === 'day' ? 'Today' : item[0].toUpperCase() + item.slice(1)} onPress={(time) => savePrefs({ ...prefs, time })} />)}</View></View>}
              <View style={styles.settingRow}>
                <Text style={styles.rowLabel}>Columns</Text>
                <View style={styles.wrapChoices}>{[1, 2, 3, 4, 5, 6].map((cols) => <Choice key={cols} value={cols} selected={prefs.cols === cols} label={String(cols)} onPress={(value) => savePrefs({ ...prefs, cols: value })} />)}</View>
              </View>
              <View style={[styles.settingRow, styles.lastRow]}>
                <View style={styles.turboCopy}><Text style={styles.rowLabel}>Turbo mode</Text><Text style={styles.small}>Open automatically on supported Reddit pages</Text></View>
                <Switch value={prefs.turbo} onValueChange={(turbo) => savePrefs({ ...prefs, turbo })} trackColor={{ false: '#34313f', true: ACCENT }} thumbColor="#fff" />
              </View>
            </View>

            <View style={styles.footer}>
              <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}><Text style={styles.settingsButtonText}>⚙  All settings</Text></Pressable>
              <Text style={styles.footerText}>Private by design · Stored on this device</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0a10' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 12 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  logo: { width: 36, height: 36, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  logoMark: { width: 12, height: 12, borderRadius: 2, backgroundColor: '#fff', transform: [{ rotate: '45deg' }] },
  brand: { gap: 2 },
  brandName: { color: '#f4f2f8', fontSize: 15, fontWeight: '900', letterSpacing: 3 },
  brandVersion: { color: '#8b8899', fontSize: 9, letterSpacing: 1.4 },
  unlimited: { marginLeft: 'auto', backgroundColor: '#251222', borderColor: '#632243', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  unlimitedText: { color: '#ff82a4', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  card: { backgroundColor: '#121019', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  onboardingCard: { borderColor: '#76304c' },
  hero: { backgroundColor: '#17101c', borderColor: '#50233d' },
  cardTitle: { color: '#ff82a4', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  mutedParagraph: { color: '#aaa6b6', fontSize: 13, lineHeight: 19 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#34d399' },
  whereCopy: { flex: 1, gap: 2 },
  eyebrow: { color: '#9994a5', fontSize: 10, letterSpacing: 1 },
  sourceTitle: { color: '#f1eef5', fontSize: 15, fontWeight: '700' },
  primaryButton: { height: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  label: { color: '#a5a1b0', fontSize: 11, fontWeight: '700' },
  labelSpaced: { marginTop: 4 },
  small: { color: '#858191', fontSize: 10, fontWeight: '400' },
  input: { minHeight: 42, paddingHorizontal: 11, borderRadius: 9, backgroundColor: '#1c1926', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, color: '#f1eef5', fontSize: 14 },
  sourceForm: { flexDirection: 'row', gap: 8 },
  sourceInput: { flex: 1 },
  goButton: { minWidth: 54, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT },
  goText: { color: '#fff', fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 18, backgroundColor: '#1c1926', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1 },
  chipText: { color: '#d5d2dc', fontSize: 11, fontWeight: '600' },
  settingRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 7, borderBottomColor: 'rgba(255,255,255,0.07)', borderBottomWidth: 1 },
  lastRow: { borderBottomWidth: 0, paddingBottom: 0 },
  rowLabel: { color: '#e2dfe9', fontSize: 13, fontWeight: '600' },
  segment: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 9, backgroundColor: '#1c1926' },
  wrapChoices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 5, maxWidth: '78%' },
  choice: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 7, backgroundColor: '#1c1926' },
  choiceOn: { backgroundColor: ACCENT },
  choiceText: { color: '#aaa6b6', fontSize: 11, fontWeight: '600' },
  choiceTextOn: { color: '#fff' },
  turboCopy: { flex: 1, gap: 3 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 4 },
  switchLabel: { color: '#e2dfe9', flex: 1, fontSize: 12 },
  privacy: { color: '#858191', fontSize: 10, lineHeight: 15 },
  error: { color: '#ff8a8a', fontSize: 12 },
  footer: { alignItems: 'center', gap: 8, paddingTop: 2 },
  settingsButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#1c1926', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  settingsButtonText: { color: '#e2dfe9', fontSize: 12, fontWeight: '700' },
  footerText: { color: '#777382', fontSize: 10 },
});
