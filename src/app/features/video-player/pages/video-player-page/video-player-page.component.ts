import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '@shared/components/header/header.component';
import { VideoPlayerComponent } from '../../ui/video-player/video-player.component';
import { PlayerControlsComponent } from '../../ui/player-controls/player-controls.component';
import { TimelineComponent } from '../../ui/timeline/timeline.component';

@Component({
  selector: 'app-video-player-page',
  imports: [
    CommonModule,
    HeaderComponent,
    VideoPlayerComponent,
    PlayerControlsComponent,
    TimelineComponent
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
          
          <!-- Timeline -->
          <div class="timeline-section">
            <app-timeline></app-timeline>
          </div>
          
          <!-- Controls -->
          <div class="controls-section">
            <app-player-controls></app-player-controls>
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