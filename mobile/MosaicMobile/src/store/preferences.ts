import * as SecureStore from 'expo-secure-store';
import { UserPreferences, UserProfile } from '../types';

const DEFAULT_PREFS: UserPreferences = {
  filter: 'all',
  sort: 'hot',
  time: 'day',
  cols: 4,
  turbo: false,
  nsfw: true,
};

export class PreferencesStore {
  private static instance: PreferencesStore;
  private cache: UserPreferences = { ...DEFAULT_PREFS };
  private profile: UserProfile | null = null;
  private favorites: Set<string> = new Set();
  private hidden: Set<string> = new Set();

  private constructor() {}

  static getInstance(): PreferencesStore {
    if (!PreferencesStore.instance) {
      PreferencesStore.instance = new PreferencesStore();
    }
    return PreferencesStore.instance;
  }

  async loadPreferences(): Promise<UserPreferences> {
    try {
      const saved = await SecureStore.getItemAsync('mz_prefs');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.cache = { ...DEFAULT_PREFS, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
    return this.cache;
  }

  async savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    this.cache = { ...this.cache, ...prefs };
    try {
      await SecureStore.setItemAsync('mz_prefs', JSON.stringify(this.cache));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }

  getPreferences(): UserPreferences {
    return { ...this.cache };
  }

  async loadProfile(): Promise<UserProfile | null> {
    try {
      const saved = await SecureStore.getItemAsync('mz_profile');
      if (saved) {
        this.profile = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
    return this.profile;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    this.profile = profile;
    try {
      await SecureStore.setItemAsync('mz_profile', JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile:', e);
    }
  }

  getProfile(): UserProfile | null {
    return this.profile;
  }

  async loadFavorites(): Promise<Set<string>> {
    try {
      const saved = await SecureStore.getItemAsync('mz_favs');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.favorites = new Set(parsed);
      }
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
    return this.favorites;
  }

  async saveFavorites(): Promise<void> {
    try {
      await SecureStore.setItemAsync('mz_favs', JSON.stringify(Array.from(this.favorites)));
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  }

  toggleFavorite(id: string): boolean {
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
      this.saveFavorites();
      return false;
    } else {
      this.favorites.add(id);
      this.saveFavorites();
      return true;
    }
  }

  isFavorite(id: string): boolean {
    return this.favorites.has(id);
  }

  getFavorites(): string[] {
    return Array.from(this.favorites);
  }

  async loadHidden(): Promise<Set<string>> {
    try {
      const saved = await SecureStore.getItemAsync('mz_hidden');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.hidden = new Set(parsed);
      }
    } catch (e) {
      console.error('Failed to load hidden:', e);
    }
    return this.hidden;
  }

  async saveHidden(): Promise<void> {
    try {
      await SecureStore.setItemAsync('mz_hidden', JSON.stringify(Array.from(this.hidden)));
    } catch (e) {
      console.error('Failed to save hidden:', e);
    }
  }

  hideItem(id: string): void {
    this.hidden.add(id);
    this.saveHidden();
  }

  isHidden(id: string): boolean {
    return this.hidden.has(id);
  }

  getHidden(): string[] {
    return Array.from(this.hidden);
  }
}
