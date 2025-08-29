import { Component, inject } from '@angular/core';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrls: ['./theme-toggle.component.scss']
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);

  onToggleTheme(): void {
    this.themeService.toggleTheme();
  }
}