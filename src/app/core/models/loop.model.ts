/**
 * Interface définissant un segment de boucle pour une vidéo YouTube
 */
export interface LoopSegment {
  id: string;
  name: string;
  startTime: number; // en secondes
  endTime: number;   // en secondes
  color?: string;    // couleur hexadecimale pour l'affichage
  isActive?: boolean;
  repetitions?: number; // nombre de répétitions
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface pour la création d'une nouvelle boucle
 */
export type CreateLoopSegment = Omit<LoopSegment, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Interface pour la mise à jour d'une boucle existante
 */
export type UpdateLoopSegment = Partial<Omit<LoopSegment, 'id' | 'createdAt'>> & { updatedAt: Date };

/**
 * Interface pour les données du formulaire de boucle
 */
export interface LoopFormData {
  name: string;
  startTime: number;
  endTime: number;
  color?: string;
  repetitions?: number;
}

/**
 * État d'une boucle dans le lecteur
 */
export enum LoopState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  COMPLETED = 'completed'
}

/**
 * Configuration de lecture pour une boucle
 */
export interface LoopPlaybackConfig {
  loopId: string;
  autoRepeat: boolean;
  maxRepetitions?: number;
  fadeInOut?: boolean;
  playbackSpeed?: number;
}

/**
 * Statistiques d'une boucle
 */
export interface LoopStats {
  loopId: string;
  timesPlayed: number;
  totalPlayTime: number; // en secondes
  lastPlayedAt: Date;
  averageSessionDuration: number;
}

/**
 * Groupe de boucles pour l'organisation
 */
export interface LoopGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  loops: string[]; // IDs des boucles
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuration d'export/import des boucles
 */
export interface LoopExportData {
  version: string;
  exportedAt: Date;
  videoId?: string;
  videoTitle?: string;
  loops: LoopSegment[];
  groups?: LoopGroup[];
}

/**
 * Utilitaires pour les boucles
 */
export class LoopUtils {
  /**
   * Calcule la durée d'une boucle en secondes
   */
  static getDuration(loop: LoopSegment): number {
    return loop.endTime - loop.startTime;
  }

  /**
   * Formate la durée d'une boucle au format MM:SS
   */
  static formatDuration(loop: LoopSegment): string {
    const duration = this.getDuration(loop);
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Vérifie si deux boucles se chevauchent
   */
  static doLoopsOverlap(loop1: LoopSegment, loop2: LoopSegment): boolean {
    return !(loop1.endTime <= loop2.startTime || loop2.endTime <= loop1.startTime);
  }

  /**
   * Génère une couleur aléatoire pour une boucle
   */
  static generateRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Valide les données d'une boucle
   */
  static validateLoop(loop: Partial<LoopSegment>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!loop.name || loop.name.trim().length === 0) {
      errors.push('Le nom de la boucle est requis');
    }

    if (loop.name && loop.name.trim().length > 50) {
      errors.push('Le nom ne peut pas dépasser 50 caractères');
    }

    if (loop.startTime === undefined || loop.startTime < 0) {
      errors.push('Le temps de début doit être positif');
    }

    if (loop.endTime === undefined || loop.endTime < 0) {
      errors.push('Le temps de fin doit être positif');
    }

    if (loop.startTime !== undefined && loop.endTime !== undefined) {
      if (loop.startTime >= loop.endTime) {
        errors.push('Le temps de fin doit être supérieur au temps de début');
      }

      if (loop.endTime - loop.startTime < 1) {
        errors.push('La boucle doit durer au moins 1 seconde');
      }
    }

    if (loop.repetitions !== undefined && loop.repetitions < 0) {
      errors.push('Le nombre de répétitions doit être positif');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Crée une boucle avec des valeurs par défaut
   */
  static createDefaultLoop(overrides: Partial<CreateLoopSegment> = {}): CreateLoopSegment {
    return {
      name: 'Nouvelle boucle',
      startTime: 0,
      endTime: 30,
      color: this.generateRandomColor(),
      isActive: false,
      repetitions: 1,
      ...overrides
    };
  }
}