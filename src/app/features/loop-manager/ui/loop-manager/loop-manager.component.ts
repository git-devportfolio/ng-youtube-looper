import { Component, OnInit, Output, EventEmitter, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { LoopManagerFacade } from '../../data-access/loop-manager.facade';
import { LoopFormComponent } from '../loop-form/loop-form.component';
import { LoopSegment } from '@shared/interfaces/loop.types';

export interface LoopManagerViewModel {
  loops: LoopSegment[];
  currentLoop: LoopSegment | null;
  isLoading: boolean;
  error: string | null;
  totalLoops: number;
  hasLoops: boolean;
}

@Component({
  selector: 'app-loop-manager',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoopFormComponent
  ],
  templateUrl: './loop-manager.component.html',
  styleUrl: './loop-manager.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoopManagerComponent implements OnInit {
  private readonly loopManagerFacade = inject(LoopManagerFacade);

  // Timeline synchronization outputs
  @Output() syncWithTimeline = new EventEmitter<{
    action: 'select' | 'play' | 'navigate' | 'update';
    loopId?: string;
    loop?: LoopSegment;
    timestamp?: number;
  }>();

  @Output() loopSelectionChange = new EventEmitter<{
    selectedLoop: LoopSegment | null;
    previousLoop: LoopSegment | null;
  }>();

  @Output() activeLoopChange = new EventEmitter<{
    activeLoop: LoopSegment | null;
    isPlaying: boolean;
  }>();

  // Local state
  readonly showAddForm = signal(false);
  readonly editingLoopId = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly sortBy = signal<'name' | 'startTime' | 'duration'>('name');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');

  // Timeline synchronization state
  readonly selectedLoopForTimeline = signal<LoopSegment | null>(null);
  readonly timelineSyncEnabled = signal(true);
  readonly focusedLoopId = signal<string | null>(null);
  
  // Animation and interaction state
  private animationInProgress = signal(false);

  // Computed view model
  readonly vm = computed<LoopManagerViewModel>(() => {
    const facade = this.loopManagerFacade;
    const loops = facade.loops() || [];
    const filteredLoops = this.applyFiltersAndSort(loops);

    return {
      loops: filteredLoops,
      currentLoop: facade.currentLoop(),
      isLoading: facade.isLoading(),
      error: facade.error(),
      totalLoops: loops.length,
      hasLoops: loops.length > 0
    };
  });

  ngOnInit(): void {
    // Initialize loop manager
    console.log('LoopManagerComponent initialized');
  }

  // Actions
  onAddLoop(): void {
    this.showAddForm.set(true);
    this.editingLoopId.set(null);
  }

  onEditLoop(loop: LoopSegment): void {
    this.editingLoopId.set(loop.id);
    this.showAddForm.set(true);
  }

  onDeleteLoop(loop: LoopSegment): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la boucle "${loop.name}" ?`)) {
      this.loopManagerFacade.deleteLoop(loop.id);
    }
  }

  onDuplicateLoop(loop: LoopSegment): void {
    const duplicated: Omit<LoopSegment, 'id'> = {
      name: `${loop.name} (copie)`,
      startTime: loop.startTime,
      endTime: loop.endTime,
      playbackSpeed: loop.playbackSpeed,
      playCount: 0,
      color: loop.color || '#3B82F6',
      isActive: false,
      repeatCount: loop.repeatCount || 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.loopManagerFacade.createLoop(duplicated);
  }

  onPlayLoop(loop: LoopSegment): void {
    this.loopManagerFacade.playLoop(loop.id);
    
    // Sync with Timeline
    this.syncLoopWithTimeline('play', loop);
    
    // Update selected loop for timeline synchronization
    this.updateSelectedLoopForTimeline(loop);
    
    // Emit active loop change
    this.activeLoopChange.emit({
      activeLoop: loop,
      isPlaying: true
    });
  }

  onStopLoop(): void {
    this.loopManagerFacade.stopLoop();
    
    // Emit active loop change
    this.activeLoopChange.emit({
      activeLoop: null,
      isPlaying: false
    });
  }

  onLoopFormSubmit(result: any): void {
    const editingId = this.editingLoopId();
    
    if (editingId && result.type === 'update') {
      this.loopManagerFacade.updateLoop(editingId, result.data);
      // Sync update with Timeline
      const updatedLoop = this.vm().loops.find(l => l.id === editingId);
      if (updatedLoop) {
        this.syncLoopWithTimeline('update', updatedLoop);
      }
    } else if (result.type === 'create') {
      this.loopManagerFacade.createLoop(result.data as Omit<LoopSegment, 'id'>);
    }
    
    this.closeForm();
  }

  onLoopFormCancel(): void {
    this.closeForm();
  }

  // Search and sort
  onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  onSortChange(sortBy: 'name' | 'startTime' | 'duration'): void {
    if (this.sortBy() === sortBy) {
      // Toggle direction if same field
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(sortBy);
      this.sortDirection.set('asc');
    }
  }

  private closeForm(): void {
    this.showAddForm.set(false);
    this.editingLoopId.set(null);
  }

  private applyFiltersAndSort(loops: LoopSegment[]): LoopSegment[] {
    let filtered = [...loops];

    // Apply search filter
    const search = this.searchTerm().toLowerCase();
    if (search) {
      filtered = filtered.filter(loop => 
        loop.name.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    const sortBy = this.sortBy();
    const direction = this.sortDirection();
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'startTime':
          comparison = a.startTime - b.startTime;
          break;
        case 'duration':
          const aDuration = a.endTime - a.startTime;
          const bDuration = b.endTime - b.startTime;
          comparison = aDuration - bDuration;
          break;
      }
      
      return direction === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }

  // Helper methods for template
  getEditingLoop(): LoopSegment | null {
    const editingId = this.editingLoopId();
    return editingId ? this.vm().loops.find(l => l.id === editingId) || null : null;
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  formatDuration(startTime: number, endTime: number): string {
    const duration = endTime - startTime;
    return this.formatTime(duration);
  }

  // Timeline Synchronization Methods

  /**
   * Sync loop action with Timeline component
   */
  private syncLoopWithTimeline(action: 'select' | 'play' | 'navigate' | 'update', loop: LoopSegment): void {
    if (!this.timelineSyncEnabled()) return;

    const now = Date.now();

    this.syncWithTimeline.emit({
      action,
      loopId: loop.id,
      loop,
      timestamp: now
    });
  }

  /**
   * Update selected loop for timeline synchronization with animation
   */
  private updateSelectedLoopForTimeline(loop: LoopSegment | null): void {
    const previousLoop = this.selectedLoopForTimeline();
    
    if (previousLoop?.id !== loop?.id) {
      // Start animation
      this.animationInProgress.set(true);
      
      // Update selection
      this.selectedLoopForTimeline.set(loop);
      
      // Emit selection change
      this.loopSelectionChange.emit({
        selectedLoop: loop,
        previousLoop
      });

      // End animation after transition
      setTimeout(() => {
        this.animationInProgress.set(false);
      }, 300);
    }
  }

  /**
   * Navigate to specific loop (called from Timeline)
   */
  navigateToLoop(loopId: string): void {
    const loop = this.vm().loops.find(l => l.id === loopId);
    if (loop) {
      this.updateSelectedLoopForTimeline(loop);
      this.syncLoopWithTimeline('navigate', loop);
      
      // Scroll loop into view with smooth animation
      this.scrollLoopIntoView(loopId);
    }
  }

  /**
   * Handle loop selection from external sources (Timeline)
   */
  onExternalLoopSelect(loop: LoopSegment | null): void {
    this.updateSelectedLoopForTimeline(loop);
    
    if (loop) {
      this.scrollLoopIntoView(loop.id);
    }
  }

  /**
   * Toggle timeline synchronization
   */
  toggleTimelineSync(): void {
    this.timelineSyncEnabled.update(enabled => !enabled);
    
    if (this.timelineSyncEnabled()) {
      // Re-sync current state
      const currentLoop = this.selectedLoopForTimeline();
      if (currentLoop) {
        this.syncLoopWithTimeline('select', currentLoop);
      }
    }
  }

  /**
   * Enhanced loop selection with Timeline sync
   */
  onLoopSelect(loop: LoopSegment): void {
    this.updateSelectedLoopForTimeline(loop);
    this.syncLoopWithTimeline('select', loop);
    
    // Update focus for accessibility
    this.focusedLoopId.set(loop.id);
  }

  /**
   * Enhanced loop deselection
   */
  onLoopDeselect(): void {
    this.updateSelectedLoopForTimeline(null);
    this.focusedLoopId.set(null);
  }

  // Accessibility Methods

  /**
   * Get ARIA label for loop item
   */
  getLoopAriaLabel(loop: LoopSegment, index: number): string {
    const duration = this.formatDuration(loop.startTime, loop.endTime);
    const startTime = this.formatTime(loop.startTime);
    const isSelected = this.selectedLoopForTimeline()?.id === loop.id;
    const isActive = this.vm().currentLoop?.id === loop.id;
    
    let label = `Loop ${index + 1}: ${loop.name}, duration ${duration}, starts at ${startTime}`;
    
    if (isActive) {
      label += ', currently playing';
    }
    
    if (isSelected) {
      label += ', selected for timeline';
    }
    
    return label;
  }

  /**
   * Get ARIA role for loop item
   */
  getLoopAriaRole(): string {
    return 'option';
  }

  /**
   * Handle keyboard navigation for accessibility
   */
  onLoopKeyDown(event: KeyboardEvent, loop: LoopSegment, index: number): void {
    const loops = this.vm().loops;
    
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.onLoopSelect(loop);
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        if (index > 0) {
          const prevLoop = loops[index - 1];
          this.onLoopSelect(prevLoop);
          this.scrollLoopIntoView(prevLoop.id);
        }
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        if (index < loops.length - 1) {
          const nextLoop = loops[index + 1];
          this.onLoopSelect(nextLoop);
          this.scrollLoopIntoView(nextLoop.id);
        }
        break;
        
      case 'Home':
        event.preventDefault();
        if (loops.length > 0) {
          const firstLoop = loops[0];
          this.onLoopSelect(firstLoop);
          this.scrollLoopIntoView(firstLoop.id);
        }
        break;
        
      case 'End':
        event.preventDefault();
        if (loops.length > 0) {
          const lastLoop = loops[loops.length - 1];
          this.onLoopSelect(lastLoop);
          this.scrollLoopIntoView(lastLoop.id);
        }
        break;
    }
  }

  /**
   * Scroll specific loop into view with smooth animation
   */
  private scrollLoopIntoView(loopId: string, smooth: boolean = true): void {
    // Use requestAnimationFrame for smooth performance
    requestAnimationFrame(() => {
      const loopElement = document.querySelector(`[data-loop-id="${loopId}"]`);
      if (loopElement) {
        loopElement.scrollIntoView({
          behavior: smooth ? 'smooth' : 'auto',
          block: 'nearest',
          inline: 'nearest'
        });
        
        // Update focus for accessibility
        const focusableElement = loopElement.querySelector('[tabindex]') as HTMLElement;
        if (focusableElement) {
          focusableElement.focus();
        }
      }
    });
  }

  /**
   * Get CSS classes for timeline synchronization states
   */
  getTimelineSyncClasses(): string {
    const classes: string[] = [];
    
    if (this.timelineSyncEnabled()) {
      classes.push('timeline-sync-enabled');
    } else {
      classes.push('timeline-sync-disabled');
    }
    
    if (this.animationInProgress()) {
      classes.push('sync-animation-active');
    }
    
    return classes.join(' ');
  }

  /**
   * Get CSS classes for loop item with enhanced states
   */
  getEnhancedLoopClasses(loop: LoopSegment): string {
    const classes: string[] = ['loop-item'];
    
    // Selection states
    if (this.selectedLoopForTimeline()?.id === loop.id) {
      classes.push('timeline-selected');
    }
    
    if (this.focusedLoopId() === loop.id) {
      classes.push('keyboard-focused');
    }
    
    // Active state
    if (this.vm().currentLoop?.id === loop.id) {
      classes.push('currently-active');
    }
    
    // Animation state
    if (this.animationInProgress()) {
      classes.push('transition-animation');
    }
    
    return classes.join(' ');
  }

  /**
   * Check if timeline sync is available
   */
  get isTimelineSyncAvailable(): boolean {
    return this.timelineSyncEnabled() && this.vm().hasLoops;
  }

  /**
   * Get current sync status for display
   */
  get timelineSyncStatus(): string {
    if (!this.timelineSyncEnabled()) {
      return 'Timeline synchronization disabled';
    }
    
    const selectedLoop = this.selectedLoopForTimeline();
    if (selectedLoop) {
      return `Synchronized with "${selectedLoop.name}"`;
    }
    
    return 'Timeline synchronization enabled';
  }
}