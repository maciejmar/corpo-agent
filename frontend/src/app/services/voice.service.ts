import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VoiceService {
  isRecording = signal(false);
  transcript = signal('');

  private mediaRecorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private stream?: MediaStream;

  readonly audioBlob$ = new Subject<Blob>();

  async startRecording(): Promise<void> {
    if (this.isRecording()) return;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: mimeType });
      this.audioBlob$.next(blob);
    };

    this.mediaRecorder.start(100);
    this.isRecording.set(true);
  }

  stopRecording(): void {
    if (!this.isRecording()) return;
    this.mediaRecorder?.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.isRecording.set(false);
  }

  // Browser-native STT fallback (no API cost)
  startBrowserStt(): Promise<string> {
    return new Promise((resolve, reject) => {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { reject(new Error('SpeechRecognition not supported')); return; }
      const recog = new SR();
      recog.lang = 'pl-PL';
      recog.continuous = false;
      recog.interimResults = false;
      recog.onresult = (e: any) => resolve(e.results[0][0].transcript);
      recog.onerror = (e: any) => reject(e.error);
      recog.start();
      this.isRecording.set(true);
      recog.onend = () => this.isRecording.set(false);
    });
  }

  speak(text: string): void {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'pl-PL';
    utt.rate = 1.0;
    window.speechSynthesis.speak(utt);
  }
}
