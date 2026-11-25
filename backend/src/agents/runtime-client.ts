import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import type { AgentConfig } from './config.js';

/** AgentCore Runtime'daki ajanları çağırır; SSE olaylarını sırayla onEvent'e iletir. */
export async function invokeAgentRuntime(cfg: AgentConfig, body: Record<string, unknown>, onEvent: (e: any) => void, signal?: AbortSignal) {
  const client = new BedrockAgentCoreClient({ region: cfg.region });
  const sid = `optisupply-${String(body.sessionId || 'anon')}`.padEnd(40, '0').slice(0, 100); // en az 33 karakter
  const out = await client.send(
    new InvokeAgentRuntimeCommand({
      agentRuntimeArn: cfg.runtimeArn, qualifier: 'DEFAULT', runtimeSessionId: sid,
      contentType: 'application/json', accept: body.action === 'negotiate' || body.action === 'ask_stream' ? 'text/event-stream' : 'application/json',
      payload: new TextEncoder().encode(JSON.stringify(body)),
    }),
    { abortSignal: signal as any },
  );
  const stream: any = out.response;
  const dec = new TextDecoder(); let buf = '', sse = false;
  const handle = (block: string) => {
    if (!block.includes('data:')) return;
    sse = true;
    const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
    if (!data) return;
    let v: any = JSON.parse(data); if (typeof v === 'string') v = JSON.parse(v);
    onEvent(v);
  };
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    const parts = buf.split(/\r?\n\r?\n/); buf = parts.pop() || '';
    parts.forEach(handle);
  }
  if (buf.trim()) { if (!sse && !buf.includes('data:')) { const v = JSON.parse(buf); onEvent(v.type ? v : { type: 'result', ...v }); } else handle(buf); }
}
