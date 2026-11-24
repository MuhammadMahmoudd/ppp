/**
 * One Durable Object per couple: the live wire between the two phones.
 *  • broadcast  — typing, game moves, touch taps, miss-you (relayed to the other socket)
 *  • presence   — who is online and on which screen
 *  • db notices — "row X in table T changed"; clients re-fetch it through the
 *                 rule-checked REST API, so nothing private leaks through here.
 * Uses the WebSocket Hibernation API so idle couples cost nothing.
 */
import type { Env } from './env';

type Attachment = { uid: string; meta: Record<string, unknown> | null };

export class CoupleRoom implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {
    void this.env;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/notify' && req.method === 'POST') {
      const events = await req.text();
      const msg = JSON.stringify({ t: 'db', events: JSON.parse(events) });
      for (const ws of this.state.getWebSockets()) {
        try {
          ws.send(msg);
        } catch {
          // socket closing
        }
      }
      return new Response('ok');
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const uid = req.headers.get('x-uid');
    if (!uid) return new Response('unauthorized', { status: 401 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.state.acceptWebSocket(server, [uid]);
    server.serializeAttachment({ uid, meta: null } satisfies Attachment);
    server.send(JSON.stringify({ t: 'hello' }));
    this.sendPresence(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== 'string' || data.length > 256 * 1024) return;
    let msg: { t?: string; event?: string; payload?: unknown; meta?: Record<string, unknown> };
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    const att = ws.deserializeAttachment() as Attachment;
    if (msg.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong' }));
    } else if (msg.t === 'bc' && typeof msg.event === 'string') {
      const out = JSON.stringify({ t: 'bc', event: msg.event, payload: msg.payload ?? {}, from: att.uid });
      for (const other of this.state.getWebSockets()) if (other !== ws) other.send(out);
    } else if (msg.t === 'track') {
      ws.serializeAttachment({ uid: att.uid, meta: msg.meta ?? {} } satisfies Attachment);
      this.broadcastPresence();
    } else if (msg.t === 'untrack') {
      ws.serializeAttachment({ uid: att.uid, meta: null } satisfies Attachment);
      this.broadcastPresence();
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {
      // already closed
    }
    this.broadcastPresence(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcastPresence(ws);
  }

  private presence(exclude?: WebSocket): Record<string, Record<string, unknown>[]> {
    const state: Record<string, Record<string, unknown>[]> = {};
    for (const ws of this.state.getWebSockets()) {
      if (ws === exclude) continue;
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.meta) (state[att.uid] ??= []).push(att.meta);
    }
    return state;
  }

  private sendPresence(ws: WebSocket) {
    ws.send(JSON.stringify({ t: 'presence', state: this.presence() }));
  }

  private broadcastPresence(exclude?: WebSocket) {
    const msg = JSON.stringify({ t: 'presence', state: this.presence(exclude) });
    for (const ws of this.state.getWebSockets()) {
      if (ws === exclude) continue;
      try {
        ws.send(msg);
      } catch {
        // closing
      }
    }
  }
}
