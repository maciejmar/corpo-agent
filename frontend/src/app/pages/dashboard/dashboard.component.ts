import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, KpiData } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  kpi: KpiData | null = null;
  cashflow: any = null;
  aiAnalysis: any = null;
  analyzing = false;
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit() {
    Promise.all([
      this.api.getKpi().toPromise(),
      this.api.getCashflowSummary().toPromise(),
    ]).then(([kpi, cf]) => {
      this.kpi = kpi!;
      this.cashflow = cf;
      this.loading = false;
    });
  }

  runAiAnalysis() {
    this.analyzing = true;
    this.api.analyzeKpi().subscribe(r => {
      this.aiAnalysis = r;
      this.analyzing = false;
    });
  }
}
