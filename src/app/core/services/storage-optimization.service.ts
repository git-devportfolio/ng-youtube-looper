import { Injectable } from '@angular/core';
import { 
  LooperSession, 
  CompressedSessionData, 
  SessionMetadata
} from './looper-storage.types';

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  timeMs: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface SearchIndex {
  [key: string]: {
    sessionIds: string[];
    metadata: SessionMetadata[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class StorageOptimizationService {
  private searchIndex: SearchIndex = {};
  private cache = new Map<string, any>();
  private cacheTimestamps = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // === COMPRESSION SYSTEM ===

  /**
   * Compresse les données de session en utilisant une approche de minification JSON
   */
  compressSessionData(sessions: LooperSession[]): CompressedSessionData {
    // const _startTime = performance.now();
    const originalJson = JSON.stringify(sessions);
    const originalSize = originalJson.length;

    // Minification avancée
    const minifiedSessions = this.minifySessionsData(sessions);
    const compressedJson = JSON.stringify(minifiedSessions);
    const compressedSize = compressedJson.length;

    // const __endTime = performance.now();
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    return {
      version: '1.0',
      compressed: true,
      data: compressedJson,
      checksum: this.generateChecksum(compressedJson),
      metadata: {
        originalSize,
        compressedSize,
        compressionRatio,
        timestamp: new Date()
      }
    };
  }

  /**
   * Décompresse les données de session
   */
  decompressSessionData(compressed: CompressedSessionData): LooperSession[] {
    try {
      if (!compressed.compressed) {
        return JSON.parse(compressed.data);
      }

      // Vérifier le checksum
      if (compressed.checksum && this.generateChecksum(compressed.data) !== compressed.checksum) {
        throw new Error('Checksum validation failed - data may be corrupted');
      }

      const minifiedData = JSON.parse(compressed.data);
      return this.expandMinifiedSessions(minifiedData);
    } catch (error) {
      throw new Error(`Decompression failed: ${(error as Error).message}`);
    }
  }

  /**
   * Minifie les données de session pour réduire la taille
   */
  private minifySessionsData(sessions: LooperSession[]): any[] {
    return sessions.map(session => {
      // Utiliser des clés courtes pour les propriétés communes
      const minified: any = {
        i: session.id,                    // id
        n: session.name,                  // name  
        v: session.videoId,               // videoId
        t: session.videoTitle,            // title
        u: session.videoUrl,              // url
        d: session.videoDuration,         // duration
        l: this.minifyLoops(session.loops), // loops
        s: session.globalPlaybackSpeed,   // speed
        c: session.currentTime,           // currentTime
        a: session.isActive,              // active
        cr: this.dateToTimestamp(session.createdAt), // created
        up: this.dateToTimestamp(session.updatedAt), // updated
        pt: session.totalPlayTime,        // playTime
        pc: session.playCount             // playCount
      };

      // Propriétés optionnelles
      if (session.lastPlayed) {
        minified.lp = this.dateToTimestamp(session.lastPlayed);
      }
      if (session.tags && session.tags.length > 0) {
        minified.tg = session.tags;
      }
      if (session.description) {
        minified.de = session.description;
      }

      return minified;
    });
  }

  /**
   * Minifie les boucles pour économiser l'espace
   */
  private minifyLoops(loops: any[]): any[] {
    return loops.map(loop => ({
      i: loop.id,           // id
      n: loop.name,         // name
      s: loop.startTime,    // start
      e: loop.endTime,      // end
      sp: loop.playbackSpeed || 1.0, // speed
      pc: loop.playCount || 0, // playCount
      a: loop.isActive || false, // active
      c: loop.color,        // color (optional)
      r: loop.repetitions   // repetitions (optional)
    }));
  }

  /**
   * Reconstruit les sessions complètes depuis les données minifiées
   */
  private expandMinifiedSessions(minifiedData: any[]): LooperSession[] {
    return minifiedData.map(min => {
      const session: LooperSession = {
        id: min.i,
        name: min.n,
        videoId: min.v,
        videoTitle: min.t,
        videoUrl: min.u,
        videoDuration: min.d,
        loops: this.expandMinifiedLoops(min.l || []),
        globalPlaybackSpeed: min.s || 1.0,
        currentTime: min.c || 0,
        isActive: min.a || false,
        createdAt: this.timestampToDate(min.cr),
        updatedAt: this.timestampToDate(min.up),
        totalPlayTime: min.pt || 0,
        playCount: min.pc || 0
      };

      // Propriétés optionnelles
      if (min.lp) {
        session.lastPlayed = this.timestampToDate(min.lp);
      }
      if (min.tg) {
        session.tags = min.tg;
      }
      if (min.de) {
        session.description = min.de;
      }

      return session;
    });
  }

  /**
   * Reconstruit les boucles depuis les données minifiées
   */
  private expandMinifiedLoops(minifiedLoops: any[]): any[] {
    return minifiedLoops.map(min => ({
      id: min.i,
      name: min.n,
      startTime: min.s,
      endTime: min.e,
      playbackSpeed: min.sp || 1.0,
      playCount: min.pc || 0,
      isActive: min.a || false,
      color: min.c,
      repetitions: min.r,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  // === CACHING SYSTEM ===

  /**
   * Cache intelligent avec TTL
   */
  setCache(key: string, data: any, ttl?: number): void {
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now() + (ttl || this.CACHE_TTL));
  }

  /**
   * Récupère depuis le cache
   */
  getCache<T>(key: string): T | null {
    if (!this.cache.has(key)) {
      return null;
    }

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp || Date.now() > timestamp) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key) as T;
  }

  /**
   * Invalide le cache pour une clé ou pattern
   */
  invalidateCache(keyOrPattern: string): void {
    if (keyOrPattern.includes('*')) {
      const pattern = keyOrPattern.replace('*', '');
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(pattern));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      });
    } else {
      this.cache.delete(keyOrPattern);
      this.cacheTimestamps.delete(keyOrPattern);
    }
  }

  /**
   * Nettoie le cache expiré
   */
  cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cacheTimestamps.forEach((timestamp, key) => {
      if (now > timestamp) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });
  }

  // === PAGINATION SYSTEM ===

  /**
   * Pagine les résultats
   */
  paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    const paginatedItems = items.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      totalCount,
      pageSize,
      currentPage: page,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  }

  /**
   * Lazy loading avec cache
   */
  async lazyLoadSessions(
    loadFunction: () => Promise<LooperSession[]>,
    page: number,
    pageSize: number
  ): Promise<PaginatedResult<LooperSession>> {
    const cacheKey = `sessions_page_${page}_size_${pageSize}`;
    
    // Vérifier le cache d'abord
    const cached = this.getCache<PaginatedResult<LooperSession>>(cacheKey);
    if (cached) {
      return cached;
    }

    // Charger toutes les sessions si pas en cache
    const allSessionsKey = 'all_sessions';
    let allSessions = this.getCache<LooperSession[]>(allSessionsKey);
    
    if (!allSessions) {
      allSessions = await loadFunction();
      this.setCache(allSessionsKey, allSessions, 2 * 60 * 1000); // Cache 2 minutes
    }

    const result = this.paginate(allSessions, page, pageSize);
    this.setCache(cacheKey, result, 60 * 1000); // Cache 1 minute pour les pages

    return result;
  }

  // === SEARCH OPTIMIZATION ===

  /**
   * Construit un index de recherche pour les sessions
   */
  buildSearchIndex(sessions: LooperSession[]): void {
    this.searchIndex = {};

    sessions.forEach(session => {
      const metadata: SessionMetadata = {
        id: session.id,
        name: session.name,
        videoId: session.videoId,
        videoTitle: session.videoTitle,
        loopCount: session.loops.length,
        totalDuration: session.loops.reduce((sum, loop) => sum + (loop.endTime - loop.startTime), 0),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastAccessed: session.lastPlayed || session.updatedAt,
        tags: session.tags || []
      };

      // Index par nom de session
      this.addToIndex('name', session.name.toLowerCase(), session.id, metadata);

      // Index par titre de vidéo
      this.addToIndex('video', session.videoTitle.toLowerCase(), session.id, metadata);

      // Index par tags
      session.tags?.forEach(tag => {
        this.addToIndex('tag', tag.toLowerCase(), session.id, metadata);
      });

      // Index par videoId
      this.addToIndex('videoId', session.videoId, session.id, metadata);
    });
  }

  /**
   * Ajoute une entrée à l'index
   */
  private addToIndex(category: string, key: string, sessionId: string, metadata: SessionMetadata): void {
    const indexKey = `${category}:${key}`;
    
    if (!this.searchIndex[indexKey]) {
      this.searchIndex[indexKey] = {
        sessionIds: [],
        metadata: []
      };
    }

    if (!this.searchIndex[indexKey].sessionIds.includes(sessionId)) {
      this.searchIndex[indexKey].sessionIds.push(sessionId);
      this.searchIndex[indexKey].metadata.push(metadata);
    }
  }

  /**
   * Recherche rapide dans l'index
   */
  searchSessions(query: string, category?: string): SessionMetadata[] {
    const lowerQuery = query.toLowerCase();
    const results: SessionMetadata[] = [];
    const seenIds = new Set<string>();

    Object.keys(this.searchIndex).forEach(indexKey => {
      const [keyCategory, keyValue] = indexKey.split(':', 2);
      
      // Filtrer par catégorie si spécifiée
      if (category && keyCategory !== category) {
        return;
      }

      // Recherche par correspondance partielle
      if (keyValue.includes(lowerQuery)) {
        this.searchIndex[indexKey].metadata.forEach(metadata => {
          if (!seenIds.has(metadata.id)) {
            seenIds.add(metadata.id);
            results.push(metadata);
          }
        });
      }
    });

    return results.sort((a, b) => {
      // Prioriser les correspondances exactes
      const aExact = a.name.toLowerCase() === lowerQuery || a.videoTitle.toLowerCase() === lowerQuery;
      const bExact = b.name.toLowerCase() === lowerQuery || b.videoTitle.toLowerCase() === lowerQuery;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Ensuite par date de dernière utilisation
      const aTime = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
      const bTime = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
      
      return bTime - aTime;
    });
  }

  /**
   * Filtre optimisé avec cache
   */
  filterSessions(
    sessions: LooperSession[], 
    filters: {
      query?: string;
      videoId?: string;
      tags?: string[];
      dateRange?: { from: Date; to: Date };
    }
  ): LooperSession[] {
    const cacheKey = `filter_${JSON.stringify(filters)}`;
    const cached = this.getCache<LooperSession[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    let filtered = sessions;

    // Filtre par requête de recherche
    if (filters.query) {
      const searchResults = this.searchSessions(filters.query);
      const resultIds = new Set(searchResults.map(r => r.id));
      filtered = filtered.filter(s => resultIds.has(s.id));
    }

    // Filtre par videoId
    if (filters.videoId) {
      filtered = filtered.filter(s => s.videoId === filters.videoId);
    }

    // Filtre par tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(s => 
        s.tags?.some(tag => filters.tags!.includes(tag))
      );
    }

    // Filtre par date
    if (filters.dateRange) {
      filtered = filtered.filter(s => {
        const sessionDate = new Date(s.updatedAt);
        return sessionDate >= filters.dateRange!.from && 
               sessionDate <= filters.dateRange!.to;
      });
    }

    this.setCache(cacheKey, filtered, 30 * 1000); // Cache 30 secondes
    return filtered;
  }

  // === UTILITY METHODS ===

  /**
   * Génère un checksum simple pour vérifier l'intégrité
   */
  private generateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Convertit une date en timestamp pour économiser l'espace
   */
  private dateToTimestamp(date: Date): number {
    return Math.floor(date.getTime() / 1000); // Timestamp en secondes
  }

  /**
   * Convertit un timestamp en date
   */
  private timestampToDate(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  /**
   * Analyse les performances de stockage
   */
  analyzeStoragePerformance(sessions: LooperSession[]): {
    sessionCount: number;
    avgSessionSize: number;
    totalSize: number;
    compressionStats: CompressionStats;
    recommendations: string[];
  } {
    const originalJson = JSON.stringify(sessions);
    const totalSize = originalJson.length;
    const avgSessionSize = sessions.length > 0 ? Math.floor(totalSize / sessions.length) : 0;

    // Test de compression
    // const _startTime = performance.now();
    const compressed = this.compressSessionData(sessions);
    // const endTime = performance.now();

    const compressionStats: CompressionStats = {
      originalSize: compressed.metadata.originalSize,
      compressedSize: compressed.metadata.compressedSize,
      compressionRatio: compressed.metadata.compressionRatio,
      timeMs: 0 // Performance timing removed
    };

    const recommendations: string[] = [];

    if (sessions.length > 50) {
      recommendations.push('Considérer la pagination pour améliorer les performances');
    }
    if (avgSessionSize > 5000) {
      recommendations.push('Sessions volumineuses détectées - optimiser les données de boucles');
    }
    if (compressionStats.compressionRatio > 30) {
      recommendations.push('Compression efficace - activer la compression automatique');
    }
    if (totalSize > 1024 * 1024) { // 1MB
      recommendations.push('Stockage volumineux - implémenter le nettoyage automatique');
    }

    return {
      sessionCount: sessions.length,
      avgSessionSize,
      totalSize,
      compressionStats,
      recommendations
    };
  }

  /**
   * Nettoie les ressources et le cache
   */
  cleanup(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.searchIndex = {};
  }
}