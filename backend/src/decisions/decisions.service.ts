import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

/** Karar kaydı: ajan önerisi, insan onayı / reddi. Tedarik planı için denetim izi. */
export interface DecisionRecord {
  sessionId: string;
  ts: string;
  type: 'oneri' | 'onay' | 'red' | 'siparis';
  shock?: string;
  shockTitle?: string;
  actions?: string[];
  flag?: string;
  reason?: string;
  by?: string;
  source?: string;
  simHour?: number;
  simClock?: string;
  projection?: { profit?: number; atil?: number; serve?: number; rej?: number };
  ttl?: number;
}

/** DYNAMODB_TABLE tanımlıysa Amazon DynamoDB, değilse bellek içi. */
@Injectable()
export class DecisionsService {
  private readonly log = new Logger('Decisions');
  private readonly table = process.env.DYNAMODB_TABLE || '';
  private readonly ddb = this.table ? DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }), { marshallOptions: { removeUndefinedValues: true } }) : null;
  private local: DecisionRecord[] = [];
  private seq = 0;
  get kind() { return this.ddb ? 'dynamodb' : 'local'; }

  async put(rec: Omit<DecisionRecord, 'ts'>) {
    const item: DecisionRecord = { ...rec, ts: `${new Date().toISOString()}#${String(++this.seq).padStart(4, '0')}`, ttl: Math.floor(Date.now() / 1000) + 30 * 86400 };
    if (!this.ddb) { this.local.push(item); return { stored: 'local', item }; }
    try { await this.ddb.send(new PutCommand({ TableName: this.table, Item: item })); return { stored: 'dynamodb', item }; }
    catch (e: any) { this.log.warn(`DynamoDB yazılamadı: ${e.message}`); this.local.push(item); return { stored: 'local', item, error: e.message }; }
  }

  async bySession(sessionId: string, limit = 30) {
    if (!this.ddb) return { kind: 'local', items: this.local.filter((r) => r.sessionId === sessionId).slice(-limit).reverse() };
    const out = await this.ddb.send(new QueryCommand({ TableName: this.table, KeyConditionExpression: 'sessionId = :s', ExpressionAttributeValues: { ':s': sessionId }, ScanIndexForward: false, Limit: limit }));
    return { kind: 'dynamodb', items: (out.Items || []) as DecisionRecord[] };
  }

  /** Tüm oturumlardan son kararlar (küçük demo tablosu için tarama yeterli) */
  async recent(limit = 25) {
    if (!this.ddb) return { kind: 'local', items: this.local.slice(-limit).reverse() };
    const out = await this.ddb.send(new ScanCommand({ TableName: this.table, Limit: 500 }));
    return { kind: 'dynamodb', items: ((out.Items || []) as DecisionRecord[]).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit) };
  }
}
