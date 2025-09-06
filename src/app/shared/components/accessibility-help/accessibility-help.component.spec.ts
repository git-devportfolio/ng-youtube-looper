import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessibilityHelpComponent } from './accessibility-help.component';

describe('AccessibilityHelpComponent', () => {
  let component: AccessibilityHelpComponent;
  let fixture: ComponentFixture<AccessibilityHelpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessibilityHelpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccessibilityHelpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
