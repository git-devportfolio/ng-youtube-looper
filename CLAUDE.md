# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ng-youtube-looper** est un side project visant à créer une application web responsive en Angular permettant de boucler des segments spécifiques de vidéos YouTube pour travailler des parties guitare complexes. L'application doit également permettre de ralentir la vidéo.

- **Technologie**: Angular 19.2 avec architecture standalone components
- **Styling**: SCSS obligatoire
- **Backend**: Aucun - application cliente uniquement
- **Persistance**: localStorage
- **Architecture**: Moderne Angular CLI avec application builder

## Fonctionnalités Principales

- Lecture de vidéos YouTube intégrées
- Création et gestion de boucles sur segments vidéo
- Contrôle de la vitesse de lecture
- Interface responsive
- Sauvegarde des sessions dans localStorage

## Development Commands

### Core Development
- `npm start` or `ng serve` - Start development server on http://localhost:4200
- `ng build` - Build the project (production optimized by default)
- `ng build --watch --configuration development` - Build in watch mode for development

### Testing
- `npm test` or `ng test` - Run unit tests with Karma and Jasmine
- Tests are configured to run with Chrome launcher and coverage reporting

### Code Generation
- `ng generate component <name>` - Generate new component with SCSS styling
- `ng generate --help` - View all available schematics

## Project Architecture

### Structure
- **Standalone Components**: Uses Angular's standalone component architecture (no NgModules)
- **Routing**: Configured with `provideRouter` in `app.config.ts`
- **Styling**: SCSS is the default styling language
- **TypeScript**: Strict mode enabled with comprehensive compiler options

### Key Configuration
- **Component Prefix**: `app-` (defined in `angular.json`)
- **Source Root**: `src/`
- **Output Path**: `dist/ng-youtube-looper/`
- **Assets**: Static assets served from `public/` directory
- **Global Styles**: `src/styles.scss`

### Build Configuration
- **Production**: Optimized builds with output hashing and budgets (500kB warning, 1MB error for initial bundle)
- **Development**: Source maps enabled, optimization disabled for faster builds
- **Component Style Budget**: 4kB warning, 8kB error per component

### TypeScript Configuration
- Strict mode enabled with additional strict options
- ES2022 target and module system
- Bundler module resolution
- Angular-specific strict options enabled (injection parameters, templates, input access modifiers)

## Conventions de Code et Architecture

### Références Angular
Les conventions de développement Angular sont définies dans :
- `C:/local.dev/labs/angular_lab/ng-youtube-looper/.ai/ng-with-ai/best-practices.md` - Bonnes pratiques Angular
- `C:/local.dev/labs/angular_lab/ng-youtube-looper/.ai/ng-with-ai/instructions.md` - Instructions de développement
- `C:/local.dev/labs/angular_lab/ng-youtube-looper/.ai/ng-with-ai/convention-facade-signals.md` - Conventions facade et signals
- `C:/local.dev/labs/angular_lab/ng-youtube-looper/.ai/ng-with-ai/llms-full.txt` - Guide complet LLMs

### Principes Clés
- **Standalone Components**: Obligatoire, pas de NgModules
- **Templates HTML**: Toujours utiliser des fichiers HTML séparés, jamais de templates inline
- **Signals**: Utiliser pour la gestion d'état locale
- **Control Flow**: Utiliser `@if`, `@for`, `@switch` au lieu des directives structurelles
- **Fonction inject()**: Préférer à l'injection par constructeur
- **Reactive Forms**: Préférer aux Template-driven forms

## Task Master AI Instructions
**Utiliser Task Master AI pour découper le projet en tâches. Toutes les spécifications seront dans `.taskmaster/docs/`**
@./.taskmaster/CLAUDE.md
