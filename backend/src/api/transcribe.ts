import { StartStreamTranscriptionCommand, TranscribeStreamingClient } from '@aws-sdk/client-transcribe-streaming';

/**
 * Amazon Transcribe (tr-TR) canlı akış: tarayıcıdan gelen 16 kHz, 16-bit mono PCM kaydı
 * küçük parçalar halinde akıtılır, son transkript döner.
 */
export async function transcribePcm(pcm: Buffer, region: string, sampleRate = 16000, vocabulary = process.env.TRANSCRIBE_VOCABULARY || '') {
  const client = new TranscribeStreamingClient({ region });
  const CHUNK = 3200; // ~100 ms
  async function* audio() {
    for (let i = 0; i < pcm.length; i += CHUNK) yield { AudioEvent: { AudioChunk: pcm.subarray(i, i + CHUNK) } };
  }
  const out = await client.send(new StartStreamTranscriptionCommand({
    LanguageCode: 'tr-TR', MediaEncoding: 'pcm', MediaSampleRateHertz: sampleRate, AudioStream: audio(),
    ...(vocabulary ? { VocabularyName: vocabulary } : {}),
  }));
  const parts: string[] = [];
  for await (const ev of out.TranscriptResultStream || []) {
    for (const r of ev.TranscriptEvent?.Transcript?.Results || []) {
      if (!r.IsPartial && r.Alternatives?.[0]?.Transcript) parts.push(r.Alternatives[0].Transcript);
    }
  }
  return parts.join(' ').trim();
}
