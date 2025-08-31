import { Injectable, signal, computed, inject } from '@angular/core';
import { SecureStorageService } from './storage.service';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageService = inject(SecureStorageService);
  private readonly THEME_STORAGE_KEY = 'yl_theme_preference';

  // Signal privé pour le thème courant
  private readonly _currentTheme = signal<Theme>(this.getInitialTheme());

  // Signals publics en lecture seule
  readonly currentTheme = this._currentTheme.asReadonly();
  readonly isDarkMode = computed(() => this._currentTheme() === 'dark');
  readonly isLightMode = computed(() => this._currentTheme() === 'light');

  constructor() {
    // Appliquer le thème initial au DOM
    this.applyThemeToDOM(this._currentTheme());
  }

  // ViewModel computed pour les composants
  readonly vm = computed(() => ({
    currentTheme: this._currentTheme(),
    isDarkMode: this.isDarkMode(),
    isLightMode: this.isLightMode(),
    themeIcon: this.isDarkMode() ? '☀️' : '🌙',
    themeLabel: this.isDarkMode() ? 'Mode clair' : 'Mode sombre'
  }));

  // Commandes publiques
  setTheme(theme: Theme): void {
    this._currentTheme.set(theme);
    this.applyThemeToDOM(theme);
    this.saveThemePreference(theme);
  }

  toggleTheme(): void {
    const newTheme = this._currentTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  resetToSystem(): void {
    const systemTheme = this.getSystemTheme();
    this.setTheme(systemTheme);
  }

  // Méthodes privées
  private getInitialTheme(): Theme {
    // 1. Vérifier la préférence sauvegardée
    const savedTheme = this.storageService.loadData<Theme | null>(this.THEME_STORAGE_KEY, null);
    if (savedTheme && this.isValidTheme(savedTheme)) {
      return savedTheme;
    }

    // 2. Utiliser la préférence système
    return this.getSystemTheme();
  }

  private getSystemTheme(): Theme {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light'; // Fallback
  }

  private isValidTheme(value: any): value is Theme {
    return value === 'light' || value === 'dark';
  }

  private applyThemeToDOM(theme: Theme): void {
    if (typeof document !== 'undefined') {
      // Supprimer les anciens attributs de thème
      document.documentElement.removeAttribute('data-theme');
      
      // Ajouter le nouveau thème
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      
      // Ajouter classe pour les transitions fluides
      document.documentElement.classList.add('theme-transition');
      
      // Retirer la classe après la transition
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, 300);
    }
  }

  private saveThemePreference(theme: Theme): void {
    this.storageService.saveData(this.THEME_STORAGE_KEY, theme);
  }

  // Méthode utilitaire pour écouter les changements système
  watchSystemTheme(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        // Seulement changer si aucune préférence utilisateur n'est sauvée
        const savedTheme = this.storageService.loadData<Theme | null>(this.THEME_STORAGE_KEY, null);
        if (!savedTheme) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      };

      // Écouter les changements
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else {
        // Fallback pour les anciens navigateurs
        mediaQuery.addListener(handleChange);
      }
    }
  }
}