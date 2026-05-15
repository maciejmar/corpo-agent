import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { VoiceService } from '../../services/voice.service';
import { Subscription } from 'rxjs';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  costUsd?: number;
  action?: string;
  timestamp: Date;
}

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assistant.component.html',
  styleUrl: './assistant.component.scss',
})
export class AssistantComponent implements OnInit, OnDestroy {
  messages: Message[] = [];
  textInput = '';
  processing = false;
  useBrowserStt = true;
  totalSessionCost = 0;
  private audioSub?: Subscription;

  constructor(public voice: VoiceService, private api: ApiService) {}

  ngOnInit() {
    this.messages.push({
      role: 'assistant',
      content: 'Cześć! Jestem Twoim asystentem AI. Możesz mówić do mnie lub wpisać polecenie. Przykłady:\n• "Dodaj zadanie: naprawić bug, priorytet wysoki, termin piątek"\n• "Jaki mam cash flow w tym miesiącu?"\n• "Pokaż przeterminowane faktury"',
      timestamp: new Date(),
    });

    this.audioSub = this.voice.audioBlob$.subscribe(blob => this.processAudioBlob(blob));
  }

  ngOnDestroy() { this.audioSub?.unsubscribe(); }

  async toggleRecording() {
    if (this.voice.isRecording()) {
      this.voice.stopRecording();
      return;
    }

    if (this.useBrowserStt) {
      try {
        const transcript = await this.voice.startBrowserStt();
        this.addMessage('user', transcript);
        this.processTranscript(transcript);
      } catch {
        this.addMessage('system', 'Nie udało się uruchomić mikrofonu. Spróbuj wpisać tekst.');
      }
    } else {
      await this.voice.startRecording();
    }
  }

  private async processAudioBlob(blob: Blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    this.processing = true;
    this.api.processVoice(formData).subscribe({
      next: (result) => this.handleVoiceResult(result),
      error: (e) => { this.addMessage('system', `Błąd: ${e.message}`); this.processing = false; },
    });
  }

  private processTranscript(transcript: string) {
    this.processing = true;
    const formData = new FormData();
    formData.append('transcript', transcript);
    this.api.processVoice(formData).subscribe({
      next: (result) => this.handleVoiceResult(result),
      error: (e) => { this.addMessage('system', `Błąd: ${e.message}`); this.processing = false; },
    });
  }

  private handleVoiceResult(result: any) {
    this.processing = false;
    let msg = result.message || '';
    if (result.budgetWarning) msg += `\n\n⚠️ ${result.budgetWarning}`;
    if (result.actionResult?.type === 'task_created') msg += `\n✅ Zadanie "${result.actionResult.data.title}" dodane do backlogu.`;

    this.addMessage('assistant', msg, result.costs?.total_usd, result.intent);
    this.totalSessionCost += result.costs?.total_usd || 0;

    if (msg) this.voice.speak(msg);
  }

  sendText() {
    if (!this.textInput.trim()) return;
    const t = this.textInput.trim();
    this.textInput = '';
    this.addMessage('user', t);
    this.processTranscript(t);
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendText(); }
  }

  private addMessage(role: 'user' | 'assistant' | 'system', content: string, costUsd?: number, action?: string) {
    this.messages.push({ role, content, costUsd, action, timestamp: new Date() });
    setTimeout(() => {
      const el = document.querySelector('.chat-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
