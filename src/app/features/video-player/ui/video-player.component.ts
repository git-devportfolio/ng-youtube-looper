import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { VideoPlayerFacade } from '../data-access/video-player.facade';
import { PlayerControlsComponent } from './player-controls.component';
import { SpeedControlComponent } from './speed-control.component';

@Component({
  selector: 'app-video-player',
  imports: [CommonModule, ReactiveFormsModule, PlayerControlsComponent, SpeedControlComponent],
  templateUrl: './video-player.component.html',
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