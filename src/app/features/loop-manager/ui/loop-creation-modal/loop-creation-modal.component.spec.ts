import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoopCreationModalComponent } from './loop-creation-modal.component';

describe('LoopCreationModalComponent', () => {
  let component: LoopCreationModalComponent;
  let fixture: ComponentFixture<LoopCreationModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoopCreationModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoopCreationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
