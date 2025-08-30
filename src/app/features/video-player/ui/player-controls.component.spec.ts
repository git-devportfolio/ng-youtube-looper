import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerControlsComponent } from './player-controls.component';

describe('PlayerControlsComponent', () => {
  let component: PlayerControlsComponent;
  let fixture: ComponentFixture<PlayerControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerControlsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerControlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default input values', () => {
    expect(component.canPlay).toBe(false);
    expect(component.canPause).toBe(false);
    expect(component.isPlaying).toBe(false);
  });

  it('should calculate canSeek correctly', () => {
    expect(component.canSeek).toBe(false);
    
    component.canPlay = true;
    expect(component.canSeek).toBe(true);
    
    component.canPlay = false;
    component.canPause = true;
    expect(component.canSeek).toBe(true);
  });

  it('should emit play when togglePlayPause is called and can play', () => {
    spyOn(component.play, 'emit');
    
    component.canPlay = true;
    component.isPlaying = false;
    
    component.togglePlayPause();
    
    expect(component.play.emit).toHaveBeenCalled();
  });

  it('should emit pause when togglePlayPause is called and is playing', () => {
    spyOn(component.pause, 'emit');
    
    component.canPause = true;
    component.isPlaying = true;
    
    component.togglePlayPause();
    
    expect(component.pause.emit).toHaveBeenCalled();
  });

  it('should not emit when togglePlayPause is called but cannot play or pause', () => {
    spyOn(component.play, 'emit');
    spyOn(component.pause, 'emit');
    
    component.canPlay = false;
    component.canPause = false;
    component.isPlaying = false;
    
    component.togglePlayPause();
    
    expect(component.play.emit).not.toHaveBeenCalled();
    expect(component.pause.emit).not.toHaveBeenCalled();
  });

  it('should display correct play/pause icon based on playing state', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    // When not playing, should show play icon
    component.isPlaying = false;
    fixture.detectChanges();
    
    let playPauseButton = compiled.querySelector('.play-pause-button .control-icon');
    expect(playPauseButton?.textContent).toBe('▶️');
    
    // When playing, should show pause icon
    component.isPlaying = true;
    fixture.detectChanges();
    
    playPauseButton = compiled.querySelector('.play-pause-button .control-icon');
    expect(playPauseButton?.textContent).toBe('⏸️');
  });

  it('should disable buttons when cannot perform actions', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    component.canPlay = false;
    component.canPause = false;
    fixture.detectChanges();
    
    const playPauseButton = compiled.querySelector('.play-pause-button') as HTMLButtonElement;
    const seekButtons = compiled.querySelectorAll('.seek-button') as NodeListOf<HTMLButtonElement>;
    const stopButton = compiled.querySelector('.stop-button') as HTMLButtonElement;
    
    expect(playPauseButton.disabled).toBe(true);
    expect(stopButton.disabled).toBe(true);
    
    seekButtons.forEach(button => {
      expect(button.disabled).toBe(true);
    });
  });

  it('should enable buttons when can perform actions', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    component.canPlay = true;
    fixture.detectChanges();
    
    const playPauseButton = compiled.querySelector('.play-pause-button') as HTMLButtonElement;
    const seekButtons = compiled.querySelectorAll('.seek-button') as NodeListOf<HTMLButtonElement>;
    const stopButton = compiled.querySelector('.stop-button') as HTMLButtonElement;
    
    expect(playPauseButton.disabled).toBe(false);
    expect(stopButton.disabled).toBe(false);
    
    seekButtons.forEach(button => {
      expect(button.disabled).toBe(false);
    });
  });

  it('should emit events when buttons are clicked', () => {
    spyOn(component.stop, 'emit');
    spyOn(component.seekBack, 'emit');
    spyOn(component.seekForward, 'emit');
    
    component.canPlay = true; // Enable buttons
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    
    const stopButton = compiled.querySelector('.stop-button') as HTMLButtonElement;
    const seekBackButton = compiled.querySelectorAll('.seek-button')[0] as HTMLButtonElement;
    const seekForwardButton = compiled.querySelectorAll('.seek-button')[1] as HTMLButtonElement;
    
    stopButton.click();
    seekBackButton.click();
    seekForwardButton.click();
    
    expect(component.stop.emit).toHaveBeenCalled();
    expect(component.seekBack.emit).toHaveBeenCalled();
    expect(component.seekForward.emit).toHaveBeenCalled();
  });
});