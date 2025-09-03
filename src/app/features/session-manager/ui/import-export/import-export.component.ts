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
import { LooperSession, StorageOperationResult } from '@core/services/looper-storage.types';

export interface ImportExportEvents {
  exportComplete: { success: boolean; message?: string };
  importComplete: { success: boolean; message?: string; sessionsCount?: number };
  operationError: string;
}

@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import-export.component.html',
  styleUrls: ['./import-export.component.scss']
})
export class ImportExportComponent {
  private readonly sessionFacade = inject(SessionFacade);

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

  // Public readonly signals
  readonly isExporting = this._isExporting.asReadonly();
  readonly isImporting = this._isImporting.asReadonly();
  readonly lastOperation = this._lastOperation.asReadonly();
  readonly operationResult = this._operationResult.asReadonly();

  // Computed signals for UI state
  readonly hasSelectedSessions = computed(() => this.selectedSessions.length > 0);
  readonly canExportSelected = computed(() => this.hasSelectedSessions() && !this._isExporting());
  readonly canExportAll = computed(() => this.sessionFacade.sessionCount() > 0 && !this._isExporting());
  readonly canImport = computed(() => !this._isImporting() && !this._isExporting());
  readonly isProcessing = computed(() => this._isExporting() || this._isImporting());

  // Expose facade signals
  readonly sessionCount = this.sessionFacade.sessionCount;
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