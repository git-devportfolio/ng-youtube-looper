import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  private readonly YOUTUBE_URL_REGEX = 
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

  validateYouTubeUrl(url: string): string | null {
    const match = url.match(this.YOUTUBE_URL_REGEX);
    return match ? match[1] : null;
  }

  sanitizeVideoId(videoId: string): string {
    return videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  isValidTimeRange(start: number, end: number, duration: number): boolean {
    return start >= 0 && end > start && end <= duration;
  }

  isValidLoopName(name: string): boolean {
    return name.trim().length > 0 && name.trim().length <= 50;
  }

  isValidPlaybackSpeed(speed: number): boolean {
    return speed >= 0.25 && speed <= 2.0;
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  parseTime(timeString: string): number {
    const parts = timeString.split(':');
    if (parts.length !== 2) return 0;
    
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    
    if (isNaN(minutes) || isNaN(seconds)) return 0;
    
    return minutes * 60 + seconds;
  }
}