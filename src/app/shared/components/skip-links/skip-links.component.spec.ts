import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkipLinksComponent } from './skip-links.component';

describe('SkipLinksComponent', () => {
  let component: SkipLinksComponent;
  let fixture: ComponentFixture<SkipLinksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkipLinksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SkipLinksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
