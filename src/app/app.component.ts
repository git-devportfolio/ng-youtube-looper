import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeService } from '@core/services/theme.service';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { FooterComponent } from '@shared/components/footer/footer.component';
import { SkipLinksComponent, AccessibilityHelpComponent } from '@shared/components';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ThemeToggleComponent, FooterComponent, SkipLinksComponent, AccessibilityHelpComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  title = 'ng-youtube-looper';
  
  // State for skip links visibility
  private currentRoute = '';

  ngOnInit(): void {
    // Initialiser l'écoute des changements système
    this.themeService.watchSystemTheme();
    
    // Listen to route changes to update skip links visibility
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.url;
    });
  }
  
  // Determine if player-related skip links should be shown
  showPlayerSkipLinks(): boolean {
    return this.currentRoute.includes('/video-player') || this.currentRoute === '/' || this.currentRoute === '';
  }
  
  // Determine if loop-related skip links should be shown
  showLoopSkipLinks(): boolean {
    return this.currentRoute.includes('/video-player') || this.currentRoute === '/' || this.currentRoute === '';
  }
}
