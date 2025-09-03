import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { ImportExportComponent } from './import-export.component';
import { SessionFacade } from '../../data-access';

describe('ImportExportComponent', () => {
  let component: ImportExportComponent;
  let fixture: ComponentFixture<ImportExportComponent>;
  let mockSessionFacade: jasmine.SpyObj<SessionFacade>;

  beforeEach(async () => {
    const sessionFacadeSpy = jasmine.createSpyObj('SessionFacade', [
      'exportAllSessions',
      'exportSelectedSessions',
      'exportSession',
      'importSessionsFromFile',
      'getStorageInfo'
    ], {
      sessionCount: signal(5),
      isLoading: signal(false),
      lastError: signal(null)
    });

    await TestBed.configureTestingModule({
      imports: [ImportExportComponent],
      providers: [
        { provide: SessionFacade, useValue: sessionFacadeSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ImportExportComponent);
    component = fixture.componentInstance;
    mockSessionFacade = TestBed.inject(SessionFacade) as jasmine.SpyObj<SessionFacade>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should export all sessions successfully', async () => {
    mockSessionFacade.exportAllSessions.and.returnValue(Promise.resolve({ success: true }));
    spyOn(component.exportComplete, 'emit');

    await component.exportAllSessions();

    expect(mockSessionFacade.exportAllSessions).toHaveBeenCalled();
    expect(component.exportComplete.emit).toHaveBeenCalledWith({
      success: true,
      message: '5 sessions exportées avec succès'
    });
  });

  it('should export selected sessions successfully', async () => {
    component.selectedSessions = ['session-1', 'session-2'];
    mockSessionFacade.exportSelectedSessions.and.returnValue(Promise.resolve({ success: true }));
    spyOn(component.exportComplete, 'emit');

    await component.exportSelectedSessions();

    expect(mockSessionFacade.exportSelectedSessions).toHaveBeenCalledWith(['session-1', 'session-2']);
    expect(component.exportComplete.emit).toHaveBeenCalledWith({
      success: true,
      message: '2 sessions exportées avec succès'
    });
  });

  it('should handle export errors', async () => {
    mockSessionFacade.exportAllSessions.and.returnValue(Promise.resolve({ 
      success: false, 
      error: 'Export failed' 
    }));
    spyOn(component.operationError, 'emit');

    await component.exportAllSessions();

    expect(component.operationError.emit).toHaveBeenCalledWith('Export failed');
    expect(component.operationResult()?.success).toBe(false);
  });

  it('should trigger file input on import', () => {
    spyOn(component.fileInput.nativeElement, 'click');

    component.triggerImport();

    expect(component.fileInput.nativeElement.click).toHaveBeenCalled();
  });

  it('should validate file type on import', async () => {
    const mockFile = new File(['{}'], 'test.txt', { type: 'text/plain' });
    const mockEvent = {
      target: { files: [mockFile] }
    } as any;

    spyOn(component.operationError, 'emit');

    await component.onFileSelected(mockEvent);

    expect(component.operationError.emit).toHaveBeenCalledWith('Seuls les fichiers JSON sont supportés');
  });

  it('should validate file size on import', async () => {
    const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const mockFile = new File([largeContent], 'test.json', { type: 'application/json' });
    const mockEvent = {
      target: { files: [mockFile] }
    } as any;

    spyOn(component.operationError, 'emit');

    await component.onFileSelected(mockEvent);

    expect(component.operationError.emit).toHaveBeenCalledWith('Le fichier est trop volumineux (maximum 10MB)');
  });

  it('should import file successfully', async () => {
    const mockFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' });
    const mockEvent = {
      target: { files: [mockFile], value: 'test.json' }
    } as any;

    mockSessionFacade.importSessionsFromFile.and.returnValue(Promise.resolve({ 
      success: true, 
      data: '2 sessions importées' 
    }));
    spyOn(component.importComplete, 'emit');

    await component.onFileSelected(mockEvent);

    expect(mockSessionFacade.importSessionsFromFile).toHaveBeenCalledWith(mockFile);
    expect(component.importComplete.emit).toHaveBeenCalledWith({
      success: true,
      message: '2 sessions importées'
    });
  });

  it('should handle drag and drop', async () => {
    const mockFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' });
    const mockEvent = {
      preventDefault: jasmine.createSpy(),
      stopPropagation: jasmine.createSpy(),
      dataTransfer: { files: [mockFile] }
    } as any;

    mockSessionFacade.importSessionsFromFile.and.returnValue(Promise.resolve({ success: true }));
    spyOn(component, 'onFileSelected');

    await component.onDrop(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should clear operation result', () => {
    component['_operationResult'].set({ success: true, message: 'Test' });
    component['_lastOperation'].set('export-all');

    component.clearResult();

    expect(component.operationResult()).toBeNull();
    expect(component.lastOperation()).toBeNull();
  });

  it('should format selected sessions text correctly', () => {
    component.selectedSessions = ['session-1'];
    expect(component.getSelectedSessionsText()).toBe('1 session sélectionnée');

    component.selectedSessions = ['session-1', 'session-2'];
    expect(component.getSelectedSessionsText()).toBe('2 sessions sélectionnées');
  });

  it('should format file size correctly', () => {
    expect(component.getFormattedFileSize(0)).toBe('0 octets');
    expect(component.getFormattedFileSize(1024)).toBe('1 KB');
    expect(component.getFormattedFileSize(1048576)).toBe('1 MB');
    expect(component.getFormattedFileSize(1536)).toBe('1.5 KB');
  });

  it('should compute UI states correctly', () => {
    expect(component.hasSelectedSessions()).toBe(false);
    
    component.selectedSessions = ['session-1', 'session-2'];
    expect(component.hasSelectedSessions()).toBe(true);
    expect(component.canExportSelected()).toBe(true);
  });

  it('should disable operations when processing', () => {
    component['_isExporting'].set(true);
    expect(component.canExportAll()).toBe(false);
    expect(component.canExportSelected()).toBe(false);
    expect(component.canImport()).toBe(false);

    component['_isExporting'].set(false);
    component['_isImporting'].set(true);
    expect(component.canImport()).toBe(false);
  });
});