import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '@shared/components/header/header.component';
import { VideoPlayerComponent } from '../../ui/video-player/video-player.component';
import { PlayerControlsComponent } from '../../ui/player-controls/player-controls.component';
// Temporarily disabled due to TypeScript errors
// import { TimelineComponent } from '../../ui/timeline/timeline.component';

@Component({
  selector: 'app-video-player-page',
  imports: [
    CommonModule,
    HeaderComponent,
    VideoPlayerComponent,
    PlayerControlsComponent,
    // TimelineComponent
  ],
  template: `
    <div class="video-player-page">
      <!-- Header with URL input -->
      <app-header 
        (urlSubmit)="onUrlSubmit($event)"
        (urlChange)="onUrlChange($event)">
      </app-header>
      
      <!-- Main video player area -->
      <main class="player-main">
        <div class="player-container">
          <!-- Video player -->
          <div class="video-section">
            <app-video-player></app-video-player>
          </div>
          
          <!-- Timeline - temporarily disabled -->
          <div class="timeline-section">
            <div class="timeline-placeholder">Timeline component temporairement désactivé</div>
          </div>
          
          <!-- Controls -->
          <div class="controls-section">
            <app-player-controls [viewModel]="mockViewModel"></app-player-controls>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .video-player-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .player-main {
      flex: 1;
      padding: var(--spacing-lg);
      background: var(--bg-primary);
    }
    
    .player-container {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr;
      grid-template-areas: 
        "video"
        "timeline" 
        "controls";
      gap: var(--spacing-lg);
    }
    
    .video-section {
      grid-area: video;
    }
    
    .timeline-section {
      grid-area: timeline;
    }
    
    .controls-section {
      grid-area: controls;
    }
    
    @media (min-width: 768px) {
      .player-container {
        grid-template-columns: 2fr 1fr;
        grid-template-areas: 
          "video controls"
          "timeline timeline";
      }
    }
    
    @media (min-width: 1024px) {
      .player-main {
        padding: var(--spacing-xl);
      }
      
      .player-container {
        gap: var(--spacing-xl);
      }
    }
  `]
})
export class VideoPlayerPageComponent implements OnInit {
  
  // Mock viewModel for controls
  readonly mockViewModel = {
    // Core video information
    currentVideo: null,
    isVideoLoaded: false,
    
    // Player state
    isPlayerReady: false,
    isPlaying: false,
    loading: false,
    error: null,
    
    // Time information
    currentTime: 0,
    duration: 0,
    currentTimeFormatted: '0:00',
    durationFormatted: '0:00',
    progress: 0,
    
    // Playback controls
    playbackRate: 1.0,
    volume: 100,
    canPlay: false,
    canPause: false,
    canSeek: false,
    
    // Loop information
    loops: [],
    currentLoop: null,
    isLooping: false,
    
    // UI state
    urlInput: '',
    isValidUrl: false,
    hasError: false
  };

  ngOnInit(): void {
    // Initialize video player page
  }
  
  onUrlSubmit(url: string): void {
    console.log('URL submitted:', url);
    // Handle video URL submission
  }
  
  onUrlChange(event: {url: string, isValid: boolean, videoId: string | null}): void {
    console.log('URL changed:', event);
    // Handle URL validation changes
  }
}