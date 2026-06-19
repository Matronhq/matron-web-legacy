/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class MockWebSocket {
    public static readonly CONNECTING = 0;
    public static readonly OPEN = 1;
    public static readonly CLOSING = 2;
    public static readonly CLOSED = 3;

    public static instances: MockWebSocket[] = [];
    public static last(): MockWebSocket {
        return MockWebSocket.instances[MockWebSocket.instances.length - 1];
    }
    public static reset(): void {
        MockWebSocket.instances = [];
    }

    public readyState: number = MockWebSocket.CONNECTING;
    public url: string;
    public onopen: ((ev: Event) => void) | null = null;
    public onmessage: ((ev: MessageEvent) => void) | null = null;
    public onclose: ((ev: CloseEvent) => void) | null = null;
    public onerror: ((ev: Event) => void) | null = null;

    public constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }

    public close(code?: number, reason?: string): void {
        this.readyState = MockWebSocket.CLOSED;
        const c = code ?? 1000;
        this.onclose?.({ code: c, reason: reason ?? "", wasClean: c === 1000 } as CloseEvent);
    }

    public send(_data: string): void {
        // Client-to-server send is not used by MLiveOutputBody. No-op.
    }

    // Test helpers (driven from the test body)
    public _open(): void {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.({} as Event);
    }
    public _message(data: unknown): void {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        this.onmessage?.({ data: payload } as MessageEvent);
    }
    public _close(code = 1000, reason = ""): void {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.({ code, reason, wasClean: code === 1000 } as CloseEvent);
    }
    public _error(): void {
        this.onerror?.({} as Event);
    }
}

export function installMockWebSocket(): void {
    MockWebSocket.reset();
    (globalThis as any).WebSocket = MockWebSocket;
}

export function restoreWebSocket(original: typeof WebSocket): void {
    (globalThis as any).WebSocket = original;
}
