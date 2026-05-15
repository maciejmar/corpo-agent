import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Task } from '../../services/api.service';

type Column = 'todo' | 'in_progress' | 'done';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  tasks: Task[] = [];
  loading = true;
  showForm = false;
  budgetWarning: string | null = null;

  newTask: Partial<Task> = {
    title: '',
    priority: 'medium',
    status: 'todo',
    requires_budget: false,
    budget_amount: 0,
  };

  columns: { key: Column; label: string; icon: string }[] = [
    { key: 'todo',        label: 'Do zrobienia', icon: '📋' },
    { key: 'in_progress', label: 'W toku',       icon: '🔄' },
    { key: 'done',        label: 'Zrobione',     icon: '✅' },
  ];

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  load() {
    this.api.getTasks().subscribe(t => { this.tasks = t; this.loading = false; });
  }

  getByStatus(status: Column): Task[] {
    return this.tasks.filter(t => t.status === status);
  }

  moveTask(task: Task, status: Column) {
    this.api.updateTask(task.id, { status }).subscribe(() => {
      task.status = status;
    });
  }

  createTask() {
    if (!this.newTask.title) return;
    this.api.createTask(this.newTask).subscribe(t => {
      this.tasks.unshift(t);
      this.newTask = { title: '', priority: 'medium', status: 'todo', requires_budget: false, budget_amount: 0 };
      this.showForm = false;
      if (t.requires_budget) {
        this.api.checkBudget(t.id).subscribe(check => {
          if (!check.ok) this.budgetWarning = check.message;
        });
      }
    });
  }

  deleteTask(task: Task) {
    this.api.deleteTask(task.id).subscribe(() => {
      this.tasks = this.tasks.filter(t => t.id !== task.id);
    });
  }

  priorityClass(p: string) {
    return { low: 'pri-low', medium: 'pri-med', high: 'pri-high' }[p] || '';
  }

  isOverdue(task: Task) {
    return task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
  }
}
