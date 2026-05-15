import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  client?: string;
  deadline?: string;
  requires_budget: boolean;
  budget_amount: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface FinancialDoc {
  id: string;
  title: string;
  type: 'invoice' | 'expense' | 'contract' | 'other';
  amount: number;
  currency: string;
  client?: string;
  due_date?: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
}

export interface CostSummary {
  total_usd: number;
  today_usd: number;
  this_month_usd: number;
  by_service: { service: string; cost: number; calls: number }[];
  recent: any[];
  pricing: any;
}

export interface KpiData {
  task_completion_rate: number;
  total_tasks: number;
  done_tasks: number;
  overdue_tasks: number;
  pending_invoices: number;
  overdue_invoices: number;
  pending_invoices_total: number;
  monthly_income: number;
  monthly_expenses: number;
  net_cashflow: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // Tasks
  getTasks(filters?: Partial<{ status: string; priority: string; client: string }>): Observable<Task[]> {
    let params = new HttpParams();
    if (filters?.status)   params = params.set('status', filters.status);
    if (filters?.priority) params = params.set('priority', filters.priority);
    if (filters?.client)   params = params.set('client', filters.client);
    return this.http.get<Task[]>(`${this.base}/tasks`, { params });
  }

  createTask(task: Partial<Task>): Observable<Task> {
    return this.http.post<Task>(`${this.base}/tasks`, task);
  }

  updateTask(id: string, data: Partial<Task>): Observable<Task> {
    return this.http.patch<Task>(`${this.base}/tasks/${id}`, data);
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/tasks/${id}`);
  }

  checkBudget(id: string): Observable<{ ok: boolean; message: string; balance?: number; needed?: number }> {
    return this.http.get<any>(`${this.base}/tasks/${id}/budget-check`);
  }

  // Financial docs
  getFinancialDocs(filters?: Partial<{ type: string; status: string; client: string }>): Observable<FinancialDoc[]> {
    let params = new HttpParams();
    if (filters?.type)   params = params.set('type', filters.type);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.client) params = params.set('client', filters.client);
    return this.http.get<FinancialDoc[]>(`${this.base}/finances/docs`, { params });
  }

  createFinancialDoc(data: FormData | object): Observable<FinancialDoc> {
    return this.http.post<FinancialDoc>(`${this.base}/finances/docs`, data);
  }

  updateDocStatus(id: string, status: string): Observable<FinancialDoc> {
    return this.http.patch<FinancialDoc>(`${this.base}/finances/docs/${id}/status`, { status });
  }

  getCashflowSummary(): Observable<any> {
    return this.http.get<any>(`${this.base}/finances/cashflow/summary`);
  }

  getCashflow(days = 30): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/finances/cashflow?days=${days}`);
  }

  addCashflow(entry: { type: string; amount: number; currency: string; description: string; date: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/finances/cashflow`, entry);
  }

  // Voice
  processVoice(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.base}/voice/process`, formData);
  }

  queryVoice(transcript: string): Observable<{ answer: string; costUsd: number }> {
    return this.http.post<any>(`${this.base}/voice/query`, { transcript });
  }

  // KPI
  getKpi(): Observable<KpiData> {
    return this.http.get<KpiData>(`${this.base}/kpi`);
  }

  analyzeKpi(): Observable<any> {
    return this.http.post<any>(`${this.base}/kpi/analyze`, {});
  }

  // Costs
  getCosts(): Observable<CostSummary> {
    return this.http.get<CostSummary>(`${this.base}/costs/total`);
  }
}
