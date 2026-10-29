import { RedditPost, MediaItem, RedditSource, UserPreferences } from '../types';

const REDDIT_BASE = 'https://www.reddit.com';

export class RedditApiService {
  private static instance: RedditApiService;

  private constructor() {}

  static getInstance(): RedditApiService {
    if (!RedditApiService.instance) {
      RedditApiService.instance = new RedditApiService();
    }
    return RedditApiService.instance;
  }

  private getBaseUrl(): string {
    return REDDIT_BASE;
  }

  private async getHeaders(): Promise<HeadersInit> {
    return { Accept: 'application/json' };
  }

  parseSource(input: string, allowBare = false): RedditSource | null {
    let path = String(input || '').trim().replace(/^https?:\/\/(?:www\.|old\.|new\.)?reddit\.com/i, '');
    if (!path) return null;
    if (path[0] !== '/') path = '/' + path;

    const multiRe = /^\/(?:user|u)\/([A-Za-z0-9_-]{3,20})\/m\/([A-Za-z0-9_]{1,50})/i;
    const subRe = /^\/r\/([A-Za-z0-9_+]{2,100})/i;
    const userRe = /^\/(?:user|u)\/([A-Za-z0-9_-]{3,20})(?:[/?#]|$)/i;

    let match = path.match(multiRe);
    if (match) {
      return { kind: 'multi', path: `/user/${match[1]}/m/${match[2]}`, label: `u/${match[1]}/m/${match[2]}` };
    }

    match = path.match(subRe);
    if (match) {
      return { kind: 'sub', path: `/r/${match[1]}`, label: `r/${match[1]}` };
    }

    match = path.match(userRe);
    if (match) {
      return { kind: 'user', path: `/user/${match[1]}`, label: `u/${match[1]}` };
    }

    if (allowBare) {
      match = path.match(/^\/([A-Za-z0-9_]{2,21})\/?$/);
      if (match) {
        return { kind: 'sub', path: `/r/${match[1]}`, label: `r/${match[1]}` };
      }
    }

    return null;
  }

  getUrlFor(source: RedditSource): string {
    return `${REDDIT_BASE}${source.path}/`;
  }

  async fetchPosts(source: RedditSource, prefs: UserPreferences, after?: string): Promise<RedditPost[]> {
    const baseUrl = this.getBaseUrl();
    const sortParam = prefs.sort === 'top' ? `top?t=${prefs.time}` : prefs.sort;
    const afterParam = after ? `&after=${after}` : '';
    const url = `${baseUrl}${source.path}/${sortParam}.json?limit=50${afterParam}`;

    try {
      const headers = await this.getHeaders();
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !data.data.children) {
        return [];
      }

      return data.data.children.map((child: any) => child.data);
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  }

  convertToMediaItem(post: RedditPost): MediaItem | null {
    const thumbnail = post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&');

    // Video
    if (post.is_video && post.secure_media?.reddit_video) {
      return {
        id: post.id,
        type: 'video',
        url: post.secure_media.reddit_video.fallback_url,
        thumbnail,
        width: post.secure_media.reddit_video.width,
        height: post.secure_media.reddit_video.height,
        title: post.title,
        author: post.author,
        subreddit: post.subreddit,
        permalink: post.permalink,
        nsfw: post.over_18,
      };
    }

    // Gallery
    if (post.is_gallery && post.media_metadata) {
      const galleryItems = Object.values(post.media_metadata)
        .filter((meta: any) => meta.e === 'Image' && meta.s)
        .map((meta: any) => ({
          id: meta.id,
          url: meta.s.u.replace(/&amp;/g, '&'),
          width: meta.s.x,
          height: meta.s.y,
        }));

      if (galleryItems.length > 0) {
        return {
          id: post.id,
          type: 'gallery',
          url: galleryItems[0].url,
          thumbnail,
          width: galleryItems[0].width,
          height: galleryItems[0].height,
          title: post.title,
          author: post.author,
          subreddit: post.subreddit,
          permalink: post.permalink,
          nsfw: post.over_18,
          galleryItems,
        };
      }
    }

    // Image or GIF
    if (post.url && (post.url.match(/\.(jpg|jpeg|png|webp)$/i) || post.url.includes('i.redd.it'))) {
      const isGif = post.url.match(/\.gif$/i);
      return {
        id: post.id,
        type: isGif ? 'gif' : 'image',
        url: post.url,
        thumbnail,
        width: post.preview?.images?.[0]?.source?.width,
        height: post.preview?.images?.[0]?.source?.height,
        title: post.title,
        author: post.author,
        subreddit: post.subreddit,
        permalink: post.permalink,
        nsfw: post.over_18,
      };
    }

    // External image hosts (imgur, etc.)
    if (post.url && (post.url.includes('imgur.com') || post.url.includes('i.imgur.com'))) {
      const imgUrl = post.url.replace(/imgur\.com\/([a-zA-Z0-9]+).*/, 'i.imgur.com/$1.jpg');
      return {
        id: post.id,
        type: 'image',
        url: imgUrl,
        thumbnail,
        title: post.title,
        author: post.author,
        subreddit: post.subreddit,
        permalink: post.permalink,
        nsfw: post.over_18,
      };
    }

    return null;
  }

  async fetchMediaItems(source: RedditSource, prefs: UserPreferences, after?: string): Promise<{
    items: MediaItem[];
    after: string | null;
  }> {
    const posts = await this.fetchPosts(source, prefs, after);

    const items = posts
      .map(post => this.convertToMediaItem(post))
      .filter((item): item is MediaItem => item !== null)
      .filter(item => {
        if (prefs.nsfw === false && item.nsfw) return false;

        if (prefs.filter === 'image') return item.type !== 'video';
        if (prefs.filter === 'video') return item.type === 'video';

        return true;
      });

    const lastPost = posts[posts.length - 1];
    const afterToken = lastPost?.name || null;

    return { items, after: afterToken };
  }
}
