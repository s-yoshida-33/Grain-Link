// SSEクライアントの拡張
// REST APIとSSEを併用してデータを同期する

export type SseConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type Listener = (data: any) => void;

class SseClient {
  private _status: SseConnectionStatus = 'disconnected';
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Listener[]> = new Map();
  private reconnectTimeout: number | null = null;
  private url: string = '';

  public get status(): SseConnectionStatus {
    return this._status;
  }

  private setStatus(status: SseConnectionStatus) {
    if (this._status !== status) {
      this._status = status;
      this.notifyListeners('status_change', { status });
    }
  }

  public on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: Listener) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    }
  }

  private notifyListeners(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  public async connect(apiEndpoint: string) {
    if (this._status === 'connected' || this._status === 'connecting') return;
    
    this.url = apiEndpoint;
    this.setStatus('connecting');

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      // イベントストリームへの接続
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => {
        console.log('SSE connected');
        this.setStatus('connected');
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this.setStatus('error');
        this.eventSource?.close();
        this.eventSource = null;
        
        // 自動再接続
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = window.setTimeout(() => {
            this.connect(this.url);
        }, 5000);
      };

      // 標準メッセージイベント
      this.eventSource.addEventListener('message', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.notifyListeners('message', data);
          } catch {
            this.notifyListeners('message', e.data);
          }
      });
      
      // ショップデータ直接更新イベント
      this.eventSource.addEventListener('shops', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.notifyListeners('shops', data);
          } catch (err) {
            console.error('Failed to parse shops event:', err);
          }
      });

      // 更新通知イベント (REST API再取得トリガー)
      this.eventSource.addEventListener('update', (e) => {
          this.notifyListeners('update', e.data);
      });
      

    } catch (e) {
      console.error('SSE connection failed:', e);
      this.setStatus('error');
      // 自動再接続
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = window.setTimeout(() => {
          this.connect(this.url);
      }, 5000);
    }
  }

  public disconnect() {
    if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setStatus('disconnected');
  }
}

export const sseClient = new SseClient();
