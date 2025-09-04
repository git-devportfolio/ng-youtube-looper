import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { ThemeDemoComponent } from '@shared/components/theme-demo/theme-demo.component';
import { FooterComponent } from '@shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ThemeToggleComponent, ThemeDemoComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly themeService = inject(ThemeService);
  title = 'ng-youtube-looper';

  ngOnInit(): void {
    // Initialiser l'écoute des changements système
    this.themeService.watchSystemTheme();
  }
}
