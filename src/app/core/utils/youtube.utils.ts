/**
 * Utilitaires pour la validation et gestion des vidéos YouTube
 */

/**
 * Types d'erreurs YouTube et leurs codes
 */
export enum YouTubeErrorCode {
  PRIVATE_VIDEO = 100,
  GEO_BLOCKED = 101,
  CONTENT_WARNING = 150,
  NOT_FOUND = 404,
  NETWORK_ERROR = 500,
  INVALID_VIDEO_ID = 1000,
  INVALID_URL = 1001,
  UNKNOWN_ERROR = 9999
}

/**
 * Interface pour les erreurs YouTube avec messages localisés
 */
export interface YouTubeError {
  code: YouTubeErrorCode;
  message: string;
  suggestion: string;
  recoverable: boolean;
}

/**
 * Statut d'une vidéo YouTube
 */
export interface VideoStatus {
  isValid: boolean;
  isAccessible: boolean;
  error?: YouTubeError;
  videoId?: string;
}

/**
 * Expressions régulières pour extraire l'ID vidéo de différents formats d'URL YouTube
 */
const YOUTUBE_URL_PATTERNS = [
  // Standard YouTube URLs
  /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  // YouTube embed URLs
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  // YouTube shorts
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  // YouTube music
  /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  // Mobile YouTube URLs
  /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/
];

/**
 * Valide si une chaîne est un ID vidéo YouTube valide
 * @param videoId - ID vidéo à valider
 * @returns True si l'ID est valide
 */
export function validateVideoId(videoId: string): boolean {
  if (!videoId || typeof videoId !== 'string') {
    return false;
  }

  // Un ID vidéo YouTube fait exactement 11 caractères
  // et contient seulement des lettres, chiffres, tirets et underscores
  const videoIdPattern = /^[a-zA-Z0-9_-]{11}$/;
  return videoIdPattern.test(videoId);
}

/**
 * Extrait l'ID vidéo d'une URL YouTube (version améliorée)
 * @param url - URL YouTube à analyser
 * @returns ID vidéo ou null si extraction impossible
 */
export function extractVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const cleanUrl = url.trim();

  // Si c'est déjà un ID vidéo valide
  if (validateVideoId(cleanUrl)) {
    return cleanUrl;
  }

  // Essayer tous les patterns d'URL YouTube
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) {
      const videoId = match[1];
      // Nettoyer les paramètres supplémentaires qui pourraient être collés
      const cleanVideoId = videoId.split('&')[0].split('?')[0];
      
      if (validateVideoId(cleanVideoId)) {
        return cleanVideoId;
      }
    }
  }

  return null;
}

/**
 * Détermine le statut d'une vidéo YouTube basé sur le code d'erreur
 * @param errorCode - Code d'erreur YouTube
 * @returns Statut de la vidéo avec informations d'erreur
 */
export function getVideoStatus(errorCode?: number, videoId?: string): VideoStatus {
  if (!errorCode && videoId && validateVideoId(videoId)) {
    return {
      isValid: true,
      isAccessible: true,
      videoId
    };
  }

  const errorMap: Record<number, YouTubeError> = {
    [YouTubeErrorCode.PRIVATE_VIDEO]: {
      code: YouTubeErrorCode.PRIVATE_VIDEO,
      message: 'Cette vidéo est privée',
      suggestion: 'Vérifiez que la vidéo est publique ou que vous avez les permissions nécessaires pour y accéder.',
      recoverable: false
    },
    [YouTubeErrorCode.GEO_BLOCKED]: {
      code: YouTubeErrorCode.GEO_BLOCKED,
      message: 'Cette vidéo n\'est pas disponible dans votre région',
      suggestion: 'Cette vidéo est bloquée géographiquement. Essayez avec une autre vidéo.',
      recoverable: false
    },
    [YouTubeErrorCode.CONTENT_WARNING]: {
      code: YouTubeErrorCode.CONTENT_WARNING,
      message: 'Cette vidéo nécessite une confirmation d\'âge',
      suggestion: 'Connectez-vous à YouTube et confirmez votre âge pour accéder à cette vidéo.',
      recoverable: true
    },
    [YouTubeErrorCode.NOT_FOUND]: {
      code: YouTubeErrorCode.NOT_FOUND,
      message: 'Vidéo introuvable',
      suggestion: 'Vérifiez que l\'URL de la vidéo est correcte ou que la vidéo n\'a pas été supprimée.',
      recoverable: false
    },
    [YouTubeErrorCode.NETWORK_ERROR]: {
      code: YouTubeErrorCode.NETWORK_ERROR,
      message: 'Erreur de connexion réseau',
      suggestion: 'Vérifiez votre connexion internet et réessayez.',
      recoverable: true
    },
    [YouTubeErrorCode.INVALID_VIDEO_ID]: {
      code: YouTubeErrorCode.INVALID_VIDEO_ID,
      message: 'ID de vidéo invalide',
      suggestion: 'L\'ID de vidéo fourni n\'est pas au format correct. Utilisez une URL YouTube valide.',
      recoverable: false
    },
    [YouTubeErrorCode.INVALID_URL]: {
      code: YouTubeErrorCode.INVALID_URL,
      message: 'URL YouTube invalide',
      suggestion: 'Collez une URL YouTube valide (ex: https://www.youtube.com/watch?v=...) ou https://youtu.be/...',
      recoverable: false
    }
  };

  const error = errorCode ? errorMap[errorCode] : errorMap[YouTubeErrorCode.UNKNOWN_ERROR];
  
  return {
    isValid: false,
    isAccessible: false,
    error: error || {
      code: YouTubeErrorCode.UNKNOWN_ERROR,
      message: 'Erreur inconnue',
      suggestion: 'Une erreur inattendue s\'est produite. Veuillez réessayer.',
      recoverable: true
    },
    videoId
  };
}

/**
 * Normalise une URL YouTube en format standard
 * @param url - URL à normaliser
 * @returns URL YouTube normalisée ou null si invalide
 */
export function normalizeYouTubeUrl(url: string): string | null {
  const videoId = extractVideoId(url);
  if (!videoId) {
    return null;
  }
  
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Crée une URL d'embed YouTube avec paramètres personnalisés
 * @param videoId - ID de la vidéo
 * @param options - Options d'embed
 * @returns URL d'embed configurée
 */
export function createEmbedUrl(
  videoId: string,
  options: {
    autoplay?: boolean;
    controls?: boolean;
    start?: number;
    end?: number;
    loop?: boolean;
    mute?: boolean;
    modestbranding?: boolean;
  } = {}
): string | null {
  if (!validateVideoId(videoId)) {
    return null;
  }

  const params = new URLSearchParams();
  
  // Paramètres par défaut pour une meilleure intégration
  params.set('enablejsapi', '1');
  params.set('origin', window.location.origin);
  
  // Paramètres personnalisés
  if (options.autoplay) params.set('autoplay', '1');
  if (options.controls === false) params.set('controls', '0');
  if (options.start) params.set('start', options.start.toString());
  if (options.end) params.set('end', options.end.toString());
  if (options.loop) params.set('loop', '1');
  if (options.mute) params.set('mute', '1');
  if (options.modestbranding) params.set('modestbranding', '1');

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Extrait les paramètres de temps d'une URL YouTube
 * @param url - URL YouTube avec timestamp possible
 * @returns Temps de début en secondes ou null
 */
export function extractTimestamp(url: string): number | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Chercher le paramètre 't' ou 'start'
  const tMatch = url.match(/[?&]t=(\d+)/);
  const startMatch = url.match(/[?&]start=(\d+)/);
  
  if (tMatch && tMatch[1]) {
    return parseInt(tMatch[1], 10);
  }
  
  if (startMatch && startMatch[1]) {
    return parseInt(startMatch[1], 10);
  }

  return null;
}

/**
 * Vérifie si une URL est une URL YouTube valide
 * @param url - URL à vérifier
 * @returns True si l'URL est une URL YouTube valide
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return YOUTUBE_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Génère une URL de thumbnail YouTube
 * @param videoId - ID de la vidéo
 * @param quality - Qualité de l'image ('default', 'hqdefault', 'mqdefault', 'sddefault', 'maxresdefault')
 * @returns URL de la miniature ou null si ID invalide
 */
export function getThumbnailUrl(videoId: string, quality: 'default' | 'hqdefault' | 'mqdefault' | 'sddefault' | 'maxresdefault' = 'hqdefault'): string | null {
  if (!validateVideoId(videoId)) {
    return null;
  }

  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Parse les codes d'erreur de l'API YouTube Player et retourne une erreur structurée
 * @param apiErrorCode - Code d'erreur de l'API YouTube
 * @returns Erreur YouTube structurée
 */
export function parsePlayerError(apiErrorCode: number): YouTubeError {
  const errorMapping: Record<number, YouTubeErrorCode> = {
    2: YouTubeErrorCode.INVALID_VIDEO_ID,
    5: YouTubeErrorCode.NETWORK_ERROR,
    100: YouTubeErrorCode.PRIVATE_VIDEO,
    101: YouTubeErrorCode.GEO_BLOCKED,
    150: YouTubeErrorCode.CONTENT_WARNING
  };

  const code = errorMapping[apiErrorCode] || YouTubeErrorCode.UNKNOWN_ERROR;
  const status = getVideoStatus(code);
  
  return status.error!;
}

/**
 * Constantes pour les validations
 */
export const YOUTUBE_CONSTANTS = {
  VIDEO_ID_LENGTH: 11,
  MAX_VIDEO_DURATION: 43200, // 12 heures en secondes
  MIN_VIDEO_DURATION: 1,     // 1 seconde minimum
  THUMBNAIL_QUALITIES: ['default', 'hqdefault', 'mqdefault', 'sddefault', 'maxresdefault'] as const
} as const;