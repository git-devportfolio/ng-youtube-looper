/**
 * Utilitaires pour le formatage et la manipulation du temps
 */

/**
 * Formate un nombre de secondes au format MM:SS ou HH:MM:SS
 * @param seconds - Nombre de secondes à formater
 * @param forceHours - Forcer l'affichage des heures même si < 1h
 * @returns Temps formaté (ex: "3:45" ou "1:23:45")
 */
export function formatSecondsToMMSS(seconds: number, forceHours = false): string {
  if (!isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0 || forceHours) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Parse une chaîne de temps au format MM:SS ou HH:MM:SS en secondes
 * @param timeString - Chaîne de temps à parser (ex: "3:45", "1:23:45")
 * @returns Nombre de secondes ou null si format invalide
 */
export function parseTimeString(timeString: string): number | null {
  if (!timeString || typeof timeString !== 'string') {
    return null;
  }

  const trimmed = timeString.trim();
  const timeParts = trimmed.split(':');

  if (timeParts.length < 2 || timeParts.length > 3) {
    return null;
  }

  const numbers = timeParts.map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) || num < 0 ? null : num;
  });

  if (numbers.some(num => num === null)) {
    return null;
  }

  let totalSeconds = 0;

  if (numbers.length === 3) {
    // Format HH:MM:SS
    const [hours, minutes, seconds] = numbers as number[];
    if (minutes >= 60 || seconds >= 60) {
      return null;
    }
    totalSeconds = hours * 3600 + minutes * 60 + seconds;
  } else {
    // Format MM:SS
    const [minutes, seconds] = numbers as number[];
    if (seconds >= 60) {
      return null;
    }
    totalSeconds = minutes * 60 + seconds;
  }

  return totalSeconds;
}

/**
 * Valide si une plage de temps est correcte
 * @param startTime - Temps de début en secondes
 * @param endTime - Temps de fin en secondes
 * @param maxDuration - Durée maximale autorisée (optionnel)
 * @returns Objet avec la validité et les erreurs éventuelles
 */
export function isValidTimeRange(
  startTime: number,
  endTime: number,
  maxDuration?: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Vérification des valeurs basiques
  if (!isFinite(startTime) || startTime < 0) {
    errors.push('Le temps de début doit être un nombre positif');
  }

  if (!isFinite(endTime) || endTime < 0) {
    errors.push('Le temps de fin doit être un nombre positif');
  }

  // Vérification que le temps de fin est après le temps de début
  if (startTime >= endTime) {
    errors.push('Le temps de fin doit être supérieur au temps de début');
  }

  // Vérification de la durée minimale (au moins 1 seconde)
  if (endTime - startTime < 1) {
    errors.push('La boucle doit durer au moins 1 seconde');
  }

  // Vérification de la durée maximale si spécifiée
  if (maxDuration && endTime > maxDuration) {
    errors.push(`Le temps de fin ne peut pas dépasser la durée de la vidéo (${formatSecondsToMMSS(maxDuration)})`);
  }

  if (maxDuration && startTime > maxDuration) {
    errors.push(`Le temps de début ne peut pas dépasser la durée de la vidéo (${formatSecondsToMMSS(maxDuration)})`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calcule le pourcentage de progression dans une vidéo
 * @param currentTime - Temps actuel en secondes
 * @param duration - Durée totale en secondes
 * @returns Pourcentage (0-100)
 */
export function calculateProgress(currentTime: number, duration: number): number {
  if (!isFinite(currentTime) || !isFinite(duration) || duration <= 0) {
    return 0;
  }

  const progress = (currentTime / duration) * 100;
  return Math.max(0, Math.min(100, progress));
}

/**
 * Arrondit un temps à la seconde la plus proche
 * @param time - Temps en secondes (peut avoir des décimales)
 * @returns Temps arrondi à la seconde
 */
export function roundToSecond(time: number): number {
  return Math.round(time);
}

/**
 * Vérifie si un timestamp est valide pour une vidéo YouTube
 * @param timestamp - Timestamp à vérifier
 * @param videoDuration - Durée de la vidéo (optionnel pour validation complète)
 * @returns True si le timestamp est valide
 */
export function isValidTimestamp(timestamp: number, videoDuration?: number): boolean {
  if (!isFinite(timestamp) || timestamp < 0) {
    return false;
  }

  if (videoDuration !== undefined) {
    return timestamp <= videoDuration;
  }

  return true;
}

/**
 * Convertit un pourcentage en temps absolu
 * @param percentage - Pourcentage (0-100)
 * @param duration - Durée totale en secondes
 * @returns Temps en secondes correspondant au pourcentage
 */
export function percentageToTime(percentage: number, duration: number): number {
  if (!isFinite(percentage) || !isFinite(duration) || duration <= 0) {
    return 0;
  }

  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  return (clampedPercentage / 100) * duration;
}

/**
 * Formate une durée en français lisible par l'homme
 * @param seconds - Durée en secondes
 * @returns Durée formatée en français (ex: "3 minutes 45 secondes")
 */
export function formatDurationToFrench(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return '0 seconde';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} heure${hours > 1 ? 's' : ''}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  }

  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds} seconde${remainingSeconds > 1 ? 's' : ''}`);
  }

  if (parts.length === 1) {
    return parts[0];
  } else if (parts.length === 2) {
    return `${parts[0]} et ${parts[1]}`;
  } else {
    return `${parts[0]}, ${parts[1]} et ${parts[2]}`;
  }
}