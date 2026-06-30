export interface PhotoEnhanceInput {
  /** Base64 data URL of the reference photo (e.g. "data:image/jpeg;base64,...") */
  referenceDataUrl: string;
  /** Scene description for the generated photo */
  scenePrompt: string;
  /** Optional negative prompt */
  negativePrompt?: string;
  /** Extra negative terms appended (e.g. scenes user rejected) */
  negativePromptExtra?: string;
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

export interface RejectedPhoto {
  /** Role/slot that was rejected */
  role: string;
  /** The scene label (e.g. "Professional headshot") */
  scene: string;
  /** Optional note from the user */
  reason?: string;
}

export interface GenerateProfilePhotosInput {
  /** Base64 data URL of the best reference photo (fal fallback uses this single ref) */
  referenceDataUrl: string;
  /** All available reference photos of the SAME man — multi-reference improves Gemini's
   *  identity lock. Falls back to [referenceDataUrl] when omitted. */
  referenceDataUrls?: string[];
  /** User's archetype — drives scene selection */
  archetype: string;
  /** How many photos to generate (1–3) */
  count?: number;
  /** Photos the user rejected — their scenes are added to the negative prompt */
  rejectedPhotos?: RejectedPhoto[];
  /** How many candidates to generate per scene before picking the best (1–4, default 2). */
  candidatesPerScene?: number;
}

export interface GenerateProfilePhotosResult {
  photos: PhotoEnhanceResult[];
  /** Any slots that failed — caller can retry */
  errors: { role: PhotoRole; error: string }[];
}
