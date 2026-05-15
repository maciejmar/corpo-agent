import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ApiService, CostSummary } from '../../services/api.service';
import { interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-cost-tracker',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="cost-tracker" [class.alert]="costs && costs.today_usd > 0.10">
      <div class="cost-label">💸 Live Costs</div>
      <div class="cost-row">
        <span class="cost-val">\${{ costs?.today_usd | number:'1.4-6' }}</span>
        <span class="cost-sub">dzisiaj</span>
      </div>
      <div class="cost-row small">
        <span class="cost-val">\${{ costs?.this_month_usd | number:'1.4-6' }}</span>
        <span class="cost-sub">ten miesiąc</span>
      </div>
      <div class="cost-blink" *ngIf="justUpdated">●</div>
    </div>
  `,
  styles: [`
    .cost-tracker {
      position: fixed;
      top: 16px;
      right: 20px;
      background: #1a1f2e;
      border: 1px solid #2d3748;
      border-radius: 10px;
      padding: 10px 14px;
      z-index: 999;
      min-width: 140px;
      font-size: 12px;
      transition: border-color 0.3s;
      &.alert { border-color: #f59e0b; }
    }
    .cost-label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
    .cost-row { display: flex; align-items: baseline; gap: 6px; }
    .cost-row.small { margin-top: 2px; }
    .cost-val { color: #34d399; font-weight: 700; font-size: 14px; }
    .cost-row.small .cost-val { color: #60a5fa; font-size: 12px; }
    .cost-sub { color: #475569; font-size: 10px; }
    .cost-blink { color: #34d399; animation: blink 0.5s ease; position: absolute; top: 8px; right: 8px; font-size: 8px; }
    @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
  `],
})
export class CostTrackerComponent implements OnInit, OnDestroy {
  costs: CostSummary | null = null;
  justUpdated = false;
  private sub?: Subscription;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.sub = interval(5000).pipe(
      startWith(0),
      switchMap(() => this.api.getCosts()),
    ).subscribe(c => {
      const prev = this.costs?.today_usd;
      this.costs = c;
      if (prev !== undefined && c.today_usd !== prev) {
        this.justUpdated = true;
        setTimeout(() => (this.justUpdated = false), 800);
      }
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }
}
