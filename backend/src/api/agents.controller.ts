import { Body, Controller, Get, HttpException, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AgentsService } from './agents.service.js';
import { transcribePcm } from './transcribe.js';

@Controller('api')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get('health')
  health(@Query('deep') deep?: string) { return this.agents.health(deep === '1'); }

  /** Şok müzakeresi: Server-Sent Events akışı (POST gövdesinde ikiz anlık görüntüsü) */
  @Post('agents/negotiate')
  async negotiate(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    if (!body?.snapshot || !this.agents.isShock(body?.shock)) throw new HttpException('snapshot ve geçerli shock gerekli', 400);
    res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    const emit = (e: any) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`); };
    // CloudFront/Lambda bağlantıyı açık tutsun: orkestratör 10-15 sn sessiz kalabiliyor
    const hb = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n'); }, 3000);
    try { await this.agents.negotiate(body.snapshot, body.shock, body.sessionId || 'anon', emit, ac.signal); }
    catch (e: any) { emit({ type: 'error', message: `${e.name}: ${e.message}` }); }
    finally { clearInterval(hb); res.end(); }
  }

  @Post('agents/warm')
  warm(@Body() body: any) { return this.agents.warm(String(body?.sessionId || 'anon')); }

  @Post('assistant/ask')
  async ask(@Body() body: any) {
    if (!body?.snapshot || !body?.question) throw new HttpException('snapshot ve question gerekli', 400);
    return this.agents.ask(body.snapshot, String(body.question).slice(0, 500), body.history, body.sessionId || 'anon', !!body.voice);
  }

  /** Akışlı asistan (SSE): araç adları, metin parçaları ve son yanıt */
  @Post('assistant/stream')
  async askStream(@Body() body: any, @Res() res: Response) {
    if (!body?.snapshot || !body?.question) throw new HttpException('snapshot ve question gerekli', 400);
    res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    const emit = (e: any) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`); };
    const hb = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n'); }, 3000);
    try { await this.agents.askStream(body.snapshot, String(body.question).slice(0, 500), body.history, body.sessionId || 'anon', !!body.voice, emit, ac.signal); }
    catch (e: any) { emit({ type: 'error', message: `${e.name}: ${e.message}` }); }
    finally { clearInterval(hb); res.end(); }
  }

  @Post('agents/explain')
  explain(@Body() body: any) {
    if (!body?.snapshot) throw new HttpException('snapshot gerekli', 400);
    return this.agents.explain(body.snapshot, String(body.facts || '').slice(0, 4000), body.sessionId || 'anon');
  }

  /** Amazon Transcribe (tr-TR): gövde { audio: base64 PCM16 mono, sampleRate } */
  @Post('voice/transcribe')
  async transcribe(@Body() body: any) {
    if (!body?.audio) throw new HttpException('audio gerekli', 400);
    const pcm = Buffer.from(String(body.audio), 'base64');
    if (pcm.length > 16000 * 2 * 30) throw new HttpException('kayıt en fazla 30 sn', 413);
    const t0 = Date.now();
    const text = await transcribePcm(pcm, this.agents.cfg.region, Number(body.sampleRate) || 16000);
    return { text, ms: Date.now() - t0, engine: 'amazon-transcribe' };
  }

  @Post('voice/speak')
  async speak(@Body() body: any, @Res() res: Response) {
    if (!body?.text) throw new HttpException('text gerekli', 400);
    if (body.marks) { res.status(200).json(await this.agents.speakWithMarks(String(body.text))); return; }
    const mp3 = await this.agents.speak(String(body.text));
    res.status(200).set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }).send(mp3);
  }

  @Post('memory/:sessionId')
  remember(@Param('sessionId') sessionId: string, @Body() body: any) {
    if (!body?.flag) throw new HttpException('flag gerekli', 400);
    return this.agents.remember(sessionId, { flag: String(body.flag), reason: String(body.reason || ''), shock: body.shock, at: body.at });
  }

  @Get('memory/:sessionId')
  memories(@Param('sessionId') sessionId: string) { return this.agents.memories(sessionId); }
}
