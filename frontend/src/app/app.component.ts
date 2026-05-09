import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';

type MessageResponse = {
  message: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  readonly message = signal('バックエンドからの応答を取得しています...');
  readonly error = signal('');

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<MessageResponse>('/api/message').subscribe({
      next: (response) => {
        this.message.set(response.message);
      },
      error: () => {
        this.error.set('バックエンドからの応答を取得できませんでした。');
      },
    });
  }
}
