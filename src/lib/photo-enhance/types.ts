export interface PhotoEnhanceInput {
  /** Base64 data URL of the reference photo (e.g. "data:image/jpeg;base64,...") */
  referenceDataUrl: string;
  /** Scene description for the generated photo */
  scenePrompt: string;
  /** Optional negative prompt */
  negativePrompt?: string;
  /** How strongly to preserve face features (0–2, default 1.0) */
  idWeight?: number;
}

export interface PhotoEnhanceResult {
  /** CDN URL of the generated image */
  url: string;
  /** The scene label that was used */
  scene: string;
  /** Intended photo story role */
  role: PhotoRole;
}

export type PhotoRole = 'lead' | 'warmth' | 'lifestyle' | 'conversation' | 'social';

export interface GenerateProfilePhotosInput {
  /** Base64 data URL of the best reference photo */
  referenceDataUrl: string;
  /** User's archetype — drives scene selection */
  archetype: string;
  /** How many photos to generate (1–5) */
  count?: number;
}

export interface GenerateProfilePhotosResult {
  photos: PhotoEnhanceResult[];
  /** Any slots that failed — caller can retry */
  errors: { role: PhotoRole; error: string }[];
}
