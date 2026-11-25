import { tool } from '@strands-agents/sdk';
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { z } from 'zod';
import type { AgentConfig } from './config.js';

/**
 * Bedrock Knowledge Base araması: sabit referans bilgisi (HACCP limitleri, onay matrisi,
 * Ocak–Eylül 2026 veri raporu, kullanım rehberi, model varsayımları).
 * Canlı rakamlar ikiz araçlarından gelir; bu araç yalnızca belge bilgisi döner.
 */
export function makeKnowledgeTool(cfg: AgentConfig) {
  if (!cfg.knowledgeBaseId) return null;
  const client = new BedrockAgentRuntimeClient({ region: cfg.region });
  return tool({
    name: 'bilgi_bankasi',
    description: 'Pınar Et OptiSupply bilgi bankasında arama yapar (Amazon Bedrock Knowledge Base): HACCP kritik kontrol noktaları ve limitleri, kim neyi onaylar, şok aksiyonları ve red gerekçeleri, Ocak–Eylül 2026 aylık tahmin/plan/üretim/sipariş/sevk/stok raporu, ekran kullanım rehberi, model varsayımları. Canlı ikiz rakamları için kullanma.',
    inputSchema: z.object({ sorgu: z.string().describe('Türkçe arama sorgusu') }),
    callback: async ({ sorgu }) => {
      const out = await client.send(new RetrieveCommand({ knowledgeBaseId: cfg.knowledgeBaseId, retrievalQuery: { text: sorgu }, retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 3 } } }));
      return (out.retrievalResults || []).map((r) => ({ belge: (r.location?.s3Location?.uri || '').split('/').pop(), skor: Math.round((r.score || 0) * 100) / 100, metin: (r.content?.text || '').slice(0, 6000) }));
    },
  });
}
