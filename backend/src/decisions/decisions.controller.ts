import { Body, Controller, Get, HttpException, Param, Post, Query } from '@nestjs/common';
import { DecisionsService } from './decisions.service.js';

const TYPES = ['oneri', 'onay', 'red', 'siparis'];
const s = (v: any, n = 200) => (v == null ? undefined : String(v).slice(0, n));

@Controller('api/decisions')
export class DecisionsController {
  constructor(private readonly decisions: DecisionsService) {}

  @Post()
  put(@Body() b: any) {
    if (!b?.sessionId || !TYPES.includes(b?.type)) throw new HttpException('sessionId ve geçerli type gerekli', 400);
    const p = b.projection || {};
    return this.decisions.put({
      sessionId: s(b.sessionId, 80)!, type: b.type, shock: s(b.shock, 20), shockTitle: s(b.shockTitle, 80),
      actions: Array.isArray(b.actions) ? b.actions.slice(0, 8).map((x: any) => s(x, 20)!) : undefined,
      flag: s(b.flag, 20), reason: s(b.reason, 300), by: s(b.by, 80), source: s(b.source, 20),
      simHour: Number.isFinite(b.simHour) ? b.simHour : undefined, simClock: s(b.simClock, 20),
      projection: { profit: num(p.profit), atil: num(p.atil), serve: num(p.serve), rej: num(p.rej) },
    });
  }

  @Get()
  recent(@Query('limit') limit?: string) { return this.decisions.recent(Math.min(50, Number(limit) || 25)); }

  @Get(':sessionId')
  bySession(@Param('sessionId') id: string) { return this.decisions.bySession(id); }
}
function num(v: any) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined; }
