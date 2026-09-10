export const BRAND_KEYS = ['SpotifyCares', 'AppleSupport', 'AmazonHelp'] as const;

export type BrandKey = (typeof BRAND_KEYS)[number];

export interface BrandConfig {
  key: BrandKey;
  name: string;
  handle: `@${string}`;
  domain: string;
  icon: string;
  accent: string;
}

export const BRAND_CONFIGS: Record<BrandKey, BrandConfig> = {
  SpotifyCares: {
    key: 'SpotifyCares',
    name: 'Spotify',
    handle: '@SpotifyCares',
    domain: 'Music Streaming',
    icon: '🟢',
    accent: '#1DB954',
  },
  AppleSupport: {
    key: 'AppleSupport',
    name: 'Apple Support',
    handle: '@AppleSupport',
    domain: 'Consumer Hardware & iOS',
    icon: '🍎',
    accent: '#A5B4FC',
  },
  AmazonHelp: {
    key: 'AmazonHelp',
    name: 'Amazon Help',
    handle: '@AmazonHelp',
    domain: 'E-Commerce & Delivery',
    icon: '📦',
    accent: '#FF9900',
  },
};

export const DEFAULT_BRAND: BrandKey = 'SpotifyCares';

export function getBrandConfig(brand?: string): BrandConfig {
  if (brand && brand in BRAND_CONFIGS) {
    return BRAND_CONFIGS[brand as BrandKey];
  }

  const matchingBrand = BRAND_KEYS.find(key => BRAND_CONFIGS[key].handle === brand);
  return BRAND_CONFIGS[matchingBrand ?? DEFAULT_BRAND];
}

export function isBrandKey(brand: string): brand is BrandKey {
  return BRAND_KEYS.includes(brand as BrandKey);
}
