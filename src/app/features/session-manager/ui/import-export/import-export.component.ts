import { 
  Component, 
  Input, 
  Output, 
  EventEmitter,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionFacade } from '../../data-access';
import { LooperSession } from '@core/services/looper-storage.types';

export interface ImportExportEvents {
  exportComplete: { success: boolean; message?: string };
  importComplete: { success: boolean; message?: string; sessionsCount?: number };
  operationError: string;
}

export interface ImportPreviewData {
  valid: boolean;
  sessionCount: number;
  sessions: LooperSession[];
  conflicts: { sessionId: string; sessionName: string; existingName: string }[];
  errors: string[];
  fileSize: number;
  fileName: string;
}

export type ImportMode = 'replace' | 'merge' | 'skip-conflicts';

@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import-export.component.html',
  styleUrls: ['./import-export.component.scss']
})
export class ImportExportComponent {
  readonly sessionFacade = inject(SessionFacade);

  @Input() selectedSessions: string[] = [];
  @Input() showBulkExport: boolean = true;
  @Input() showImport: boolean = true;

  @Output() exportComplete = new EventEmitter<{ success: boolean; message?: string }>();
  @Output() importComplete = new EventEmitter<{ success: boolean; message?: string; sessionsCount?: number }>();
  @Output() operationError = new EventEmitter<string>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Component state signals
  private readonly _isExporting = signal<boolean>(false);
  private readonly _isImporting = signal<boolean>(false);
  private readonly _lastOperation = signal<string | null>(null);
  private readonly _operationResult = signal<{ success: boolean; message: string } | null>(null);
  private readonly _importPreview = signal<ImportPreviewData | null>(null);
  private readonly _showPreview = signal<boolean>(false);
  private readonly _importMode = signal<ImportMode>('merge');
  private readonly _selectedFile = signal<File | null>(null);

  // Public readonly signals
  readonly isExporting = this._isExporting.asReadonly();
  readonly isImporting = this._isImporting.asReadonly();
  readonly lastOperation = this._lastOperation.asReadonly();
  readonly operationResult = this._operationResult.asReadonly();
  readonly importPreview = this._importPreview.asReadonly();
  readonly showPreview = this._showPreview.asReadonly();
  readonly importMode = this._importMode.asReadonly();
  readonly selectedFile = this._selectedFile.asReadonly();

  // Computed signals for UI state
  readonly hasSelectedSessions = computed(() => this.selectedSessions.length > 0);
  readonly canExportSelected = computed(() => this.hasSelectedSessions() && !this._isExporting());
  readonly canExportAll = computed(() => this.sessionFacade.sessionCount() > 0 && !this._isExporting());
  readonly canImport = computed(() => !this._isImporting() && !this._isExporting() && !this._showPreview());
  readonly canConfirmImport = computed(() => {
    const preview = this._importPreview();
    return preview?.valid && this._showPreview() && !this._isImporting();
  });
  readonly isProcessing = computed(() => this._isExporting() || this._isImporting());
  readonly hasConflicts = computed(() => {
    const preview = this._importPreview();
    return preview?.conflicts && preview.conflicts.length > 0;
  });

  // Expose facade signals
  readonly sessionCount = this.sessionFacade.sessionCount;
  readonly sessionList = this.sessionFacade.sessionList;
  readonly isLoading = this.sessionFacade.isLoading;

  // === EXPORT FUNCTIONALITY ===

  /**
   * Export all sessions
   */
  async exportAllSessions(): Promise<void> {
    if (!this.canExportAll()) return;

    this._isExporting.set(true);
    this._lastOperation.set('export-all');
    this._operationResult.set(null);

    try {
      const result = await this.sessionFacade.exportAllSessions();
      
      if (result.success) {
        const successMessage = `${this.sessionCount()} sessions exportées avec succès`;
        this._operationResult.set({ success: true, message: successMessage });
        this.exportComplete.emit({ success: true, message: successMessage });
      } else {
        const errorMessage = result.error || 'Erreur d\'export';
        this._operationResult.set({ success: false, message: errorMessage });
        this.operationError.emit(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Erreur d'export: ${(error as Error).message}`;
      this._operationResult.set({ success: false, message: errorMessage });
      this.operationError.emit(errorMessage);
    } finally {
      this._isExporting.set(false);
    }
  }

  /**
   * Export selected sessions
   */
  async exportSelectedSessions(): Promise<void> {
    if (!this.canExportSelected()) return;

    this._isExporting.set(true);
    this._lastOperation.set('export-selected');
    this._operationResult.set(null);

    try {
      const result = await this.sessionFacade.exportSelectedSessions(this.selectedSessions);
      
      if (result.success) {
        const successMessage = `${this.selectedSessions.length} sessions exportées avec succès`;
        this._operationResult.set({ success: true, message: successMessage });
        this.exportComplete.emit({ success: true, message: successMessage });
      } else {
        const errorMessage = result.error || 'Erreur d\'export';
        this._operationResult.set({ success: false, message: errorMessage });
        this.operationError.emit(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Erreur d'export: ${(error as Error).message}`;
      this._operationResult.set({ success: false, message: errorMessage });
      this.operationError.emit(errorMessage);
    } finally {
      this._isExporting.set(false);
    }
  }

  /**
   * Export single session
   */
  async exportSession(sessionId: string): Promise<void> {
    this._isExporting.set(true);
    this._lastOperation.set('export-single');
    this._operationResult.set(null);

    try {
      const result = await this.sessionFacade.exportSession(sessionId);
      
      if (result.success) {
        const successMessage = 'Session exportée avec succès';
        this._operationResult.set({ success: true, message: successMessage });
        this.exportComplete.emit({ success: true, message: successMessage });
      } else {
        const errorMessage = result.error || 'Erreur d\'export';
        this._operationResult.set({ success: false, message: errorMessage });
        this.operationError.emit(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Erreur d'export: ${(error as Error).message}`;
      this._operationResult.set({ success: false, message: errorMessage });
      this.operationError.emit(errorMessage);
    } finally {
      this._isExporting.set(false);
    }
  }

  // === IMPORT FUNCTIONALITY ===

  /**
   * Trigger file selection for import
   */
  triggerImport(): void {
    if (!this.canImport()) return;
    this.fileInput.nativeElement.click();
  }

  /**
   * Handle file selection for import
   */
  async onFileSelected(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      const errorMessage = 'Seuls les fichiers JSON sont supportés';
      this._operationResult.set({ success: false, message: errorMessage });
      this.operationError.emit(errorMessage);
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const errorMessage = 'Le fichier est trop volumineux (maximum 10MB)';
      this._operationResult.set({ success: false, message: errorMessage });
      this.operationError.emit(errorMessage);
      return;
    }

    this._isImporting.set(true);
    this._lastOperation.set('import');
    this._operationResult.set(null);

    try {
      const result = await this.sessionFacade.importSessionsFromFile(file);
      
      if (result.success) {
        const message = result.data || 'Import réussi';
        this._operationResult.set({ success: true, message });
        this.importComplete.emit({ success: true, message });
      } else {
        const errorMessage = result.error || 'Erreur d\'import';
        this._operationResult.set({ success: false, message: errorMessage });
        this.operationError.emit(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Erreur d'import: ${(error as Error).message}`;
      this._operationResult.set({ success: false, message: errorMessage });
      this.operationError.emit(errorMessage);
    } finally {
      this._isImporting.set(false);
      // Reset file input
      target.value = '';
    }
  }

  // === DRAG & DROP IMPORT ===

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (!this.canImport()) return;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Create a fake event for consistency with file input handler
    const fakeEvent = {
      target: { files: [file] }
    } as any;
    
    await this.onFileSelected(fakeEvent);
  }

  // === IMPORT PREVIEW & VALIDATION ===

  /**
   * Generate preview of import data
   */
  private async generateImportPreview(file: File): Promise<void> {
    this._operationResult.set(null);
    
    try {
      const fileContent = await this.readFileAsText(file);
      let importData: any;
      
      try {
        importData = JSON.parse(fileContent);
      } catch {
        this._operationResult.set({ 
          success: false, 
          message: 'Le fichier JSON n\'est pas valide' 
        });
        return;
      }

      const preview = await this.validateImportData(importData, file);
      this._importPreview.set(preview);
      
      if (preview.valid) {
        this._showPreview.set(true);
      } else {
        this._operationResult.set({ 
          success: false, 
          message: preview.errors.join(', ') 
        });
      }
    } catch (error) {
      this._operationResult.set({ 
        success: false, 
        message: `Erreur lors de la lecture du fichier: ${(error as Error).message}` 
      });
    }
  }

  /**
   * Validate import data structure and detect conflicts
   */
  private async validateImportData(data: any, file: File): Promise<ImportPreviewData> {
    const preview: ImportPreviewData = {
      valid: false,
      sessionCount: 0,
      sessions: [],
      conflicts: [],
      errors: [],
      fileSize: file.size,
      fileName: file.name
    };

    try {
      // Validate basic structure
      if (!data || typeof data !== 'object') {
        preview.errors.push('Format de données invalide');
        return preview;
      }

      let sessionsToImport: LooperSession[] = [];

      // Handle different import formats
      if (data.type === 'single-session' && data.session) {
        sessionsToImport = [data.session];
      } else if (data.type === 'multiple-sessions' && Array.isArray(data.sessions)) {
        sessionsToImport = data.sessions;
      } else if (Array.isArray(data.sessions)) {
        // Legacy format
        sessionsToImport = data.sessions;
      } else if (Array.isArray(data)) {
        // Direct array of sessions
        sessionsToImport = data;
      } else {
        preview.errors.push('Format non reconnu');
        return preview;
      }

      // Validate each session
      const currentSessions = this.sessionFacade.sessionList();
      const validSessions: LooperSession[] = [];

      for (const session of sessionsToImport) {
        const sessionErrors = this.validateSession(session);
        if (sessionErrors.length > 0) {
          preview.errors.push(`Session "${session.name || 'Sans nom'}": ${sessionErrors.join(', ')}`);
        } else {
          validSessions.push(session);
          
          // Check for naming conflicts
          const existingSession = currentSessions.find(s => 
            s.name.toLowerCase() === session.name.toLowerCase() ||
            s.videoId === session.videoId
          );
          
          if (existingSession) {
            preview.conflicts.push({
              sessionId: session.id,
              sessionName: session.name,
              existingName: existingSession.name
            });
          }
        }
      }

      preview.sessions = validSessions;
      preview.sessionCount = validSessions.length;
      preview.valid = validSessions.length > 0 && preview.errors.length === 0;

      return preview;
    } catch (error) {
      preview.errors.push(`Erreur de validation: ${(error as Error).message}`);
      return preview;
    }
  }

  /**
   * Validate individual session structure
   */
  private validateSession(session: any): string[] {
    const errors: string[] = [];

    if (!session.id || typeof session.id !== 'string') {
      errors.push('ID manquant ou invalide');
    }
    if (!session.name || typeof session.name !== 'string') {
      errors.push('Nom manquant ou invalide');
    }
    if (!session.videoId || typeof session.videoId !== 'string') {
      errors.push('ID vidéo manquant ou invalide');
    }
    if (!session.videoTitle || typeof session.videoTitle !== 'string') {
      errors.push('Titre vidéo manquant ou invalide');
    }
    if (!Array.isArray(session.loops)) {
      errors.push('Liste des boucles invalide');
    }

    return errors;
  }

  /**
   * Read file content as text
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
      reader.readAsText(file);
    });
  }

  /**
   * Confirm import with current mode
   */
  async confirmImport(): Promise<void> {
    const file = this._selectedFile();
    const preview = this._importPreview();
    
    if (!file || !preview?.valid) return;

    this._isImporting.set(true);
    this._lastOperation.set('import');
    this._operationResult.set(null);

    try {
      // Import with conflict resolution
      const result = await this.sessionFacade.importSessionsFromFile(file);
      
      if (result.success) {
        const message = `${preview.sessionCount} session${preview.sessionCount !== 1 ? 's' : ''} importée${preview.sessionCount !== 1 ? 's' : ''} avec succès`;
        this._operationResult.set({ success: true, message });
        this.importComplete.emit({ 
          success: true, 
          message, 
          sessionsCount: preview.sessionCount 
        });
        this.cancelImport(); // Clear preview
      } else {
        const errorMessage = result.error || 'Erreur d\'import';
        this._operationResult.set({ success: false, message: errorMessage });
        this.operationError.emit(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Erreur d'import: ${(error as Error).message}`;
      this._operationResult.set({ success: false, message: errorMessage });
      this.operationError.emit(errorMessage);
    } finally {
      this._isImporting.set(false);
    }
  }

  /**
   * Cancel import and clear preview
   */
  cancelImport(): void {
    this._showPreview.set(false);
    this._importPreview.set(null);
    this._selectedFile.set(null);
    
    // Reset file input
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  /**
   * Set import mode
   */
  setImportMode(mode: ImportMode): void {
    this._importMode.set(mode);
  }

  // === UTILITY METHODS ===

  clearResult(): void {
    this._operationResult.set(null);
    this._lastOperation.set(null);
  }

  getSelectedSessionsText(): string {
    const count = this.selectedSessions.length;
    return `${count} session${count !== 1 ? 's' : ''} sélectionnée${count !== 1 ? 's' : ''}`;
  }

  getFormattedFileSize(bytes: number): string {
    if (bytes === 0) return '0 octets';
    
    const k = 1024;
    const sizes = ['octets', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Get conflict resolution text
   */
  getConflictText(): string {
    const preview = this._importPreview();
    if (!preview) return '';
    
    const count = preview.conflicts.length;
    return `${count} conflit${count !== 1 ? 's' : ''} détecté${count !== 1 ? 's' : ''}`;
  }

  /**
   * Check if a session has a conflict
   */
  hasSessionConflict(sessionId: string, conflicts: { sessionId: string; sessionName: string; existingName: string }[]): boolean {
    return conflicts.some(c => c.sessionId === sessionId);
  }

  // === INDIVIDUAL SESSION EXPORT ===

  /**
   * Get sessions for individual export
   */
  getAvailableSessionsForExport(): LooperSession[] {
    return this.sessionFacade.sessionList().slice(0, 20); // Limit to 20 for UI performance
  }

  /**
   * Export individual session
   */
  async exportIndividualSession(session: LooperSession): Promise<void> {
    this._isExporting.set(true);
    this._lastOperation.set('export-individual');
    this._operationResult.set(null);

    try {
      const result = await this.sessionFacade.exportSession(session.id);
      
      if (result.success) {
        const successMessage = `Session "${session.name}" exportée avec succès`;
        this._operationResult.set({ success: true, message: successMessage });
        this.exportComplete.emit({ success: true, message: successMessage });
      } else {
        const errorMessage = result.error || 'Erreur d\'export';
        this._operationResult.set({ success: false, message: errorMessage });
        this.operationError.emit(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Erreur d'export: ${(error as Error).message}`;
      this._operationResult.set({ success: false, message: errorMessage });
      this.operationError.emit(errorMessage);
    } finally {
      this._isExporting.set(false);
    }
  }

  // === TEMPLATE HELPERS ===

  getOperationStatusIcon(): string {
    const result = this._operationResult();
    if (!result) return '';
    
    return result.success ? '✅' : '❌';
  }

  getOperationStatusClass(): string {
    const result = this._operationResult();
    if (!result) return '';
    
    return result.success ? 'success' : 'error';
  }
}