export interface RedditPost {
  id: string;
  name: string;
  title: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  over_18: boolean;
  is_video: boolean;
  is_gallery: boolean;
  media_metadata?: Record<string, MediaMetadata>;
  secure_media?: {
    reddit_video?: {
      fallback_url: string;
      width: number;
      height: number;
    };
  };
  preview?: {
    images?: PreviewImage[];
  };
  created_utc: number;
  score: number;
  num_comments: number;
}

export interface MediaMetadata {
  id: string;
  e: string;
  m: string;
  o: {
    u: string;
    x: number;
    y: number;
  };
  s?: {
    u: string;
    x: number;
    y: number;
  };
}

export interface PreviewImage {
  source: {
    url: string;
    width: number;
    height: number;
  };
  resolutions: Array<{
    url: string;
    width: number;
    height: number;
  }>;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'gif' | 'video' | 'gallery';
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  title: string;
  author: string;
  subreddit: string;
  permalink: string;
  nsfw: boolean;
  galleryItems?: GalleryItem[];
}

export interface GalleryItem {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface RedditSource {
  kind: 'sub' | 'user' | 'multi';
  path: string;
  label: string;
}

export interface UserPreferences {
  filter: 'all' | 'image' | 'video';
  sort: 'hot' | 'new' | 'top' | 'rising';
  time: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  cols: number;
  turbo: boolean;
  nsfw: boolean;
}

export interface UserProfile {
  age: number;
  sex: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  location: string;
  showSameAnatomy: boolean;
  savedAt: number;
}
