/* The phase-one worlds (28: Streetwear joined Clothing and Jewelry joined Watches, 21 Nov, so no two cards open the same page) shown in the homepage portal (owner's list, 20 Nov 2026).
   w: the existing world id it opens today (worlds/w/?w=N), 'ai' for the Abidora AI page, or 0 while it is being built.
   batch: the upgrade batch (docs/30_WORLDS_ROADMAP_2026-11-21.md). img: assets/p30/<img>.webp (+ -s.webp).
   When a world thread ships a new id or page, change only its `w` here. */
export type P30Cat = 'fashion' | 'tech' | 'games' | 'nature' | 'space' | 'arch' | 'art';
export interface P30W { k: string; cat: P30Cat; w: number | 'ai'; batch: number; tint: string; tab?: string }
export const P30_CATS: P30Cat[] = ['fashion', 'tech', 'games', 'nature', 'space', 'arch', 'art'];
export const P30_TINT: Record<P30Cat, string> = { fashion: '#e9a6b8', tech: '#9b8cff', games: '#ff7a45', nature: '#7cc49a', space: '#8ab8ff', arch: '#d9c7a7', art: '#f2c14e' };
export const P30: P30W[] = [
  { k: 'clothing', cat: 'fashion', w: 1, tab: 'clothes', batch: 1 },
  { k: 'sneaker', cat: 'fashion', w: 1, tab: 'shoes', batch: 1 },
  { k: 'bags', cat: 'fashion', w: 1, tab: 'bags', batch: 1 },
  { k: 'watches', cat: 'fashion', w: 1, tab: 'watches', batch: 2 },
  { k: 'ai-studio', cat: 'tech', w: 92, batch: 3 },
  { k: 'ai-image', cat: 'tech', w: 89, batch: 3 },
  { k: 'future-tech', cat: 'tech', w: 57, batch: 3 },
  { k: 'robotics', cat: 'tech', w: 56, batch: 4 },
  { k: 'digital', cat: 'tech', w: 63, batch: 4 },
  { k: 'racing', cat: 'games', w: 11, batch: 4 },
  { k: 'exploration', cat: 'games', w: 82, batch: 5 },
  { k: 'puzzle', cat: 'games', w: 99, batch: 5 },
  { k: 'space-adv', cat: 'games', w: 36, batch: 5 },
  { k: 'simulation', cat: 'games', w: 41, batch: 6 },
  { k: 'ocean', cat: 'nature', w: 28, batch: 6 },
  { k: 'wildlife', cat: 'nature', w: 30, batch: 6 },
  { k: 'forest', cat: 'nature', w: 29, batch: 7 },
  { k: 'mountain', cat: 'nature', w: 32, batch: 7 },
  { k: 'galaxy', cat: 'space', w: 37, batch: 7 },
  { k: 'solar', cat: 'space', w: 38, batch: 8 },
  { k: 'astronomy', cat: 'space', w: 39, batch: 8 },
  { k: 'science', cat: 'space', w: 40, batch: 8 },
  { k: 'architecture', cat: 'arch', w: 19, batch: 9 },
  { k: 'interior', cat: 'arch', w: 20, batch: 9 },
  { k: 'future-city', cat: 'arch', w: 21, batch: 9 },
  { k: 'digital-art', cat: 'art', w: 45, batch: 10 },
  { k: 'photography', cat: 'art', w: 46, batch: 10 },
  { k: 'creative', cat: 'art', w: 51, batch: 10 },
].map((x) => ({ ...x, tint: P30_TINT[x.cat as P30Cat] })) as P30W[];
/* honest status for the worlds page (21 Nov): these work today but still wait for real 3D models or their 3D upgrade */
export const P30_UPGRADING = new Set(['bags', 'creative']);
