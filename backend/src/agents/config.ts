/** Ortam değişkenlerinden okunan ajan ayarları. Model kimlikleri hesaba göre değişir; koda gömülmez. */
export const agentConfig = () => ({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
  /** Orkestratör ve asistan için güçlü model */
  modelId: process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6',
  /** Uzman ajanlar için hızlı model */
  fastModelId: process.env.BEDROCK_FAST_MODEL_ID || process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  /** Sinyal ajanları (1. dalga: talep/tedarik/lojistik verisini okur) için model; boşsa hızlı model */
  signalModelId: process.env.BEDROCK_SIGNAL_MODEL_ID || '',
  /** Müzakere için toplam süre sınırı (ms). Aşılırsa ön yüz senaryolu akışa düşer. */
  negotiationTimeoutMs: Number(process.env.NEGOTIATION_TIMEOUT_MS || 28000),
  memoryId: process.env.AGENTCORE_MEMORY_ID || '',
  /** Bedrock Knowledge Base (rehber, HACCP, onay matrisi, veri raporu) */
  knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID || '',
  /** Tanımlıysa ajanlar AgentCore Runtime'da çalışır; değilse API sürecinde */
  runtimeArn: process.env.AGENT_RUNTIME_ARN || '',
  /** Guardrails for Amazon Bedrock (sohbet asistanı) */
  guardrailId: process.env.GUARDRAIL_ID || '',
  /** Sesli sohbette yanıt modeli (gecikme için hızlı model); boşsa ana model */
  voiceModelId: process.env.VOICE_MODEL_ID || '',
  guardrailVersion: process.env.GUARDRAIL_VERSION || 'DRAFT',
  memoryNamespace: process.env.AGENTCORE_MEMORY_NAMESPACE || '',
  memoryActorId: process.env.AGENTCORE_ACTOR_ID || 'pinar-et-planlama',
});
export type AgentConfig = ReturnType<typeof agentConfig>;
