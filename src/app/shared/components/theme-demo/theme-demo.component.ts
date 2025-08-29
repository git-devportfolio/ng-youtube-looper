import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-theme-demo',
  imports: [CommonModule],
  templateUrl: './theme-demo.component.html',
  styleUrls: ['./theme-demo.component.scss']
})
export class ThemeDemoComponent {
  readonly themeService = inject(ThemeService);

  readonly demoItems = [
    { label: 'Primary Text', class: 'primary-text' },
    { label: 'Secondary Text', class: 'secondary-text' },
    { label: 'Tertiary Text', class: 'tertiary-text' },
    { label: 'Primary Background', class: 'bg-primary' },
    { label: 'Secondary Background', class: 'bg-secondary' },
    { label: 'Tertiary Background', class: 'bg-tertiary' },
    { label: 'Accent Color', class: 'accent-color' },
    { label: 'Border Color', class: 'border-demo' }
  ];

  onSetLightTheme(): void {
    this.themeService.setTheme('light');
  }

  onSetDarkTheme(): void {
    this.themeService.setTheme('dark');
  }

  onToggleTheme(): void {
    this.themeService.toggleTheme();
  }

  onResetToSystem(): void {
    this.themeService.resetToSystem();
  }
}