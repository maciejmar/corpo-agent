import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, FinancialDoc } from '../../services/api.service';

@Component({
  selector: 'app-finances',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finances.component.html',
  styleUrl: './finances.component.scss',
})
export class FinancesComponent implements OnInit {
  docs: FinancialDoc[] = [];
  cashflow: any[] = [];
  summary: any = null;
  loading = true;
  showForm = false;
  showCfForm = false;
  activeTab: 'docs' | 'cashflow' = 'docs';

  newDoc: any = { title: '', type: 'invoice', amount: 0, currency: 'PLN', client: '', due_date: '', status: 'pending', content: '' };
  newCf: any = { type: 'income', amount: 0, currency: 'PLN', description: '', date: new Date().toISOString().split('T')[0] };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    Promise.all([
      this.api.getFinancialDocs().toPromise(),
      this.api.getCashflow(90).toPromise(),
      this.api.getCashflowSummary().toPromise(),
    ]).then(([docs, cf, summary]) => {
      this.docs = docs || [];
      this.cashflow = cf || [];
      this.summary = summary;
      this.loading = false;
    });
  }

  createDoc() {
    if (!this.newDoc.title || !this.newDoc.amount) return;
    this.api.createFinancialDoc(this.newDoc).subscribe(d => {
      this.docs.unshift(d);
      this.newDoc = { title: '', type: 'invoice', amount: 0, currency: 'PLN', client: '', due_date: '', status: 'pending', content: '' };
      this.showForm = false;
      this.api.getCashflowSummary().subscribe(s => this.summary = s);
    });
  }

  markPaid(doc: FinancialDoc) {
    this.api.updateDocStatus(doc.id, 'paid').subscribe(d => {
      Object.assign(doc, d);
      this.api.getCashflowSummary().subscribe(s => this.summary = s);
    });
  }

  addCashflow() {
    if (!this.newCf.amount || !this.newCf.date) return;
    this.api.addCashflow(this.newCf).subscribe(c => {
      this.cashflow.unshift(c);
      this.newCf = { type: 'income', amount: 0, currency: 'PLN', description: '', date: new Date().toISOString().split('T')[0] };
      this.showCfForm = false;
      this.api.getCashflowSummary().subscribe(s => this.summary = s);
    });
  }

  statusBadge(s: string) {
    const map: any = { pending: '🕐 Oczekuje', paid: '✅ Opłacona', overdue: '🔴 Przeterminowana', cancelled: '❌ Anulowana' };
    return map[s] || s;
  }
}
