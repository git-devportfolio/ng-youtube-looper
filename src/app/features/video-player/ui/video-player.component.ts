import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { VideoPlayerFacade } from '../data-access/video-player.facade';
import { PlayerControlsComponent } from './player-controls.component';
import { SpeedControlComponent } from './speed-control.component';

@Component({
  selector: 'app-video-player',
  imports: [CommonModule, ReactiveFormsModule, PlayerControlsComponent, SpeedControlComponent],
  template: `
    <div class="video-player-container">
      
      <!-- URL Input Section -->
      <div class="url-input-section">
        <h2>Charger une vidéo YouTube</h2>
        <div class="input-group">
          <input 
            type="url"
            [formControl]="urlControl"
            placeholder="Collez l'URL de la vidéo YouTube ici..."
            class="url-input"
            [class.valid]="facade.isValidUrl()"
            [class.invalid]="urlControl.value && !facade.isValidUrl()"
          >
          <button 
            type="button"
            (click)="loadVideo()"
            [disabled]="!facade.isValidUrl() || loading()"
            class="load-button"
          >
            @if (loading()) {
              <span class="loading-spinner"></span>
              Chargement...
            } @else {
              Charger
            }
          </button>
        </div>
        
        @if (urlControl.value && !facade.isValidUrl()) {
          <div class="error-message">
            URL YouTube invalide. Formats supportés : youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...
          </div>
        }
      </div>

      <!-- Video Player Section -->
      <div class="player-section">
        @if (facade.vm().currentVideo) {
          <div class="video-container">
            <!-- YouTube Player Container -->
            <div #youtubePlayer id="youtube-player" class="youtube-player"></div>
            
            <!-- Video Info -->
            <div class="video-info">
              <h3>{{ facade.vm().currentVideo.title }}</h3>
              <p class="video-meta">
                Durée: {{ facade.formatTime(facade.vm().currentVideo.duration) }} | 
                Auteur: {{ facade.vm().currentVideo.author }}
              </p>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="progress-container">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                [style.width.%]="facade.getProgressPercentage()"
              ></div>
              <div 
                class="progress-handle"
                [style.left.%]="facade.getProgressPercentage()"
              ></div>
            </div>
            <div class="time-display">
              {{ facade.formatTime(facade.vm().playerState.currentTime) }} / 
              {{ facade.formatTime(facade.vm().playerState.duration) }}
            </div>
          </div>

          <!-- Controls Section -->
          <div class="controls-section">
            <app-player-controls 
              [canPlay]="facade.vm().canPlay"
              [canPause]="facade.vm().canPause"
              [isPlaying]="facade.vm().playerState.isPlaying"
              (play)="facade.play()"
              (pause)="facade.pause()"
              (stop)="facade.stop()"
              (seekBack)="facade.seekBy(-10)"
              (seekForward)="facade.seekBy(10)"
            ></app-player-controls>

            <app-speed-control
              [currentRate]="facade.vm().playerState.playbackRate"
              [disabled]="!facade.vm().playerState.isReady"
              (rateChange)="facade.setPlaybackRate($event)"
              (increaseSpeed)="facade.increaseSpeed()"
              (decreaseSpeed)="facade.decreaseSpeed()"
            ></app-speed-control>
          </div>

        } @else {
          <div class="empty-player">
            <div class="empty-state">
              <div class="empty-icon">📺</div>
              <h3>Aucune vidéo chargée</h3>
              <p>Collez l'URL d'une vidéo YouTube ci-dessus pour commencer</p>
            </div>
          </div>
        }
      </div>

      <!-- Error Display -->
      @if (facade.vm().hasError) {
        <div class="error-banner">
          <span class="error-icon">⚠️</span>
          {{ facade.vm().playerState.error }}
        </div>
      }
    </div>
  `,
  styleUrls: ['./video-player.component.scss']
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  readonly facade = inject(VideoPlayerFacade);
  
  @ViewChild('youtubePlayer', { static: false }) 
  youtubePlayerRef?: ElementRef<HTMLDivElement>;

  // Form control for URL input
  readonly urlControl = new FormControl('', [Validators.required]);
  
  // Loading state
  readonly loading = signal(false);

  // Subscription cleanup
  private playerInitialized = false;

  ngOnInit() {
    // Sync URL input with facade
    this.urlControl.valueChanges.subscribe(value => {
      this.facade.setUrlInput(value || '');
    });

    // Auto-initialize player when video changes
    // Note: For signals, we would use effect() instead of subscribe()
    // For now, we'll initialize the player manually in loadVideo()
  }

  ngOnDestroy() {
    this.facade.reset();
  }

  async loadVideo() {
    if (!this.facade.isValidUrl() || this.loading()) {
      return;
    }

    this.loading.set(true);
    
    try {
      const url = this.urlControl.value || '';
      
      if (!this.playerInitialized && this.youtubePlayerRef) {
        // Initialize player with first video
        await this.facade.initializePlayer('youtube-player', url);
        this.playerInitialized = true;
      } else {
        // Load new video in existing player
        await this.facade.loadVideo(url);
      }
      
      // Clear input on successful load
      this.urlControl.setValue('');
    } catch (error) {
      console.error('Erreur lors du chargement de la vidéo:', error);
    } finally {
      this.loading.set(false);
    }
  }

}