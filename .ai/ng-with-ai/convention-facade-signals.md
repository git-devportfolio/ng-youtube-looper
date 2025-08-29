# Convention de développement – Pattern Façade (Angular + Signals)

## Objectif

Le **pattern de façade** agit comme une *couche de délégation* entre composants et services.
Il permet de :

* Retirer des composants la logique « lourde » (HTTP, mapping, orchestration, gestion d’état).
* Garantir un **data-flow unique** et lisible.
* Laisser aux composants uniquement l’UI et la gestion d’événements.
* Préparer le terrain pour une éventuelle intégration future (NgRx, store externe) sans casser les composants.

---

## Règles du pattern (variante **Signals**)

* Une façade **par feature** (route, page ou domaine UI).
* La façade **orchestré l’état UI** (chargement, erreurs, sélection, `vm`).
* La façade **ne contient pas** de logique métier complexe (ça reste dans les services métier).
* Les composants **ne s’abonnent pas** (aucun `subscribe`) → ils lisent directement les **Signals** exposés.
* La façade expose uniquement des **signals en lecture seule** (jamais de `signal` ou `Subject` public modifiable).
* Les composants publient des **commandes** (méthodes de la façade).

---

## Étapes de mise en place

### 1. Service de data (HTTP pur, sans état)

```ts
// data-access/widget.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Widget { id: number; name: string; }

@Injectable({ providedIn: 'root' })
export class WidgetService {
  constructor(private http: HttpClient) {}
  list()   { return this.http.get<Widget[]>('/api/widgets'); }
  create(dto: Partial<Widget>) { return this.http.post<Widget>('/api/widgets', dto); }
}
```

---

### 2. Façade (orchestration + état UI avec Signals)

```ts
// feature/widget.facade.ts
import { Injectable, computed, signal } from '@angular/core';
import { WidgetService, Widget } from '../data-access/widget.service';
import { take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class WidgetFacade {
  readonly widgets    = signal<Widget[]>([]);
  readonly loading    = signal(false);
  readonly error      = signal<string | null>(null);
  readonly selectedId = signal<number | null>(null);

  readonly selected = computed(
    () => this.widgets().find(w => w.id === this.selectedId()) ?? null
  );

  readonly vm = computed(() => ({
    widgets: this.widgets(),
    loading: this.loading(),
    error: this.error(),
    selected: this.selected()
  }));

  constructor(private api: WidgetService) {}

  load(): void {
    this.loading.set(true);
    this.api.list().pipe(take(1)).subscribe({
      next: ws => { this.widgets.set(ws); this.error.set(null); },
      error: () => this.error.set('Loading widgets failed'),
      complete: () => this.loading.set(false),
    });
  }

  create(input: Partial<Widget>): void {
    this.loading.set(true);
    this.api.create(input).pipe(take(1)).subscribe({
      next: w => this.widgets.set([...this.widgets(), w]),
      error: () => this.error.set('Create failed'),
      complete: () => this.loading.set(false),
    });
  }

  select(id: number | null): void { this.selectedId.set(id); }
  resetSelection(): void { this.selectedId.set(null); }
}
```

---

### 3. Composant mince (réactif via Signals)

```ts
// feature/widget.page.ts
import { Component, OnInit } from '@angular/core';
import { WidgetFacade } from './widget.facade';

@Component({
  selector: 'app-widget-page',
  templateUrl: './widget.page.html',
})
export class WidgetPage implements OnInit {
  constructor(public facade: WidgetFacade) {}
  ngOnInit() { this.facade.load(); }

  onCreate(name: string) { this.facade.create({ name }); }
  onSelect(id: number)   { this.facade.select(id); }
}
```

```html
<!-- feature/widget.page.html -->
<ng-container *ngIf="facade.vm() as vm">
  <button (click)="facade.load()" [disabled]="vm.loading">Reload</button>
  <div *ngIf="vm.error">{{ vm.error }}</div>

  <ul>
    <li *ngFor="let w of vm.widgets"
        (click)="onSelect(w.id)"
        [class.active]="vm.selected?.id === w.id">
      {{ w.name }}
    </li>
  </ul>

  <button (click)="onCreate('New Widget')">Add</button>
</ng-container>
```

---

### 4. Organisation conseillée

```
/features/widgets/
  data-access/
    widget.service.ts
  feature/
    widget.facade.ts
    widget.page.ts
    widget.page.html
  ui/
    widget-list.component.ts   // composants UI purs
```

---

## Bonnes pratiques

✅ **À faire :**

* Une façade **par feature**.
* Exposer uniquement des **Signals en lecture seule**.
* Les composants déclenchent des **commandes** (méthodes de façade).
* Centraliser dans la façade l’état UI (`loading`, `error`, `vm`).

❌ **À éviter :**

* Mettre des règles métier dans la façade (elles vont dans les services).
* Laisser des `subscribe` ou états dispersés dans les composants.
* Transformer la façade en **God object** : si elle grossit, découper par sous-contexte.

---

## Migration rapide (refacto incrémental)

1. Identifier dans le composant les `subscribe`, appels HTTP et états locaux.
2. Les déplacer dans une façade dédiée.
3. Exposer une `vm` via `computed`.
4. Dans le template, remplacer la logique par `facade.vm()`.
5. Le composant ne fait plus que publier des événements (méthodes de façade).

