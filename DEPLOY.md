# Dağıtım (AWS)

Bu belge OptiSupply'ın AWS'ye kurulumunu anlatır. Bütün betikler tekrar çalıştırılabilir; var olan kaynağı günceller, olmayanı oluşturur. Oluşan kaynak kimlikleri `infra/.state.env` dosyasına yazılır (git'e girmez).

## Ön koşullar

- AWS CLI v2 ve oturum: `aws login` (ya da `~/.aws/credentials` profili), bölge `us-east-1`
- Node.js 22+ ve npm, Python 3, `zip`
- Bedrock'ta model erişimi: Claude Sonnet 4.6, Claude Haiku 4.5, Amazon Titan Text Embeddings v2
- İzinler: S3, CloudFront, Lambda, IAM (rol oluşturma, PassRole), Bedrock, Bedrock AgentCore, S3 Vectors, DynamoDB, Polly, Transcribe, CloudWatch Logs, X-Ray

## Kurulum sırası

```bash
# 1) Ortam dosyası
cp backend/.env.example backend/.env

# 2) AgentCore Memory (bir kez)
aws bedrock-agentcore-control create-memory --region us-east-1 \
  --name OptiSupplyPlanlamaHafizasi --event-expiry-duration 30 \
  --memory-strategies '[{"semanticMemoryStrategy":{"name":"RedGerekceleri","namespaces":["/kisitlar/{actorId}"]}}]'
#    → dönen id'yi backend/.env içinde AGENTCORE_MEMORY_ID'ye yazın

# 3) Bilgi bankası (S3 Vectors + Titan Embeddings v2 + belge yükleme)
infra/kb/setup_kb.sh
#    → infra/.state.env içindeki KB_ID'yi backend/.env içinde KNOWLEDGE_BASE_ID'ye yazın

# 4) Guardrail
infra/guardrail.sh
#    → GUARDRAIL_ID ve GUARDRAIL_VERSION'ı backend/.env'e yazın

# 5) Transcribe özel sözlüğü (bir kez)
aws transcribe create-vocabulary --region us-east-1 --vocabulary-name optisupply-tr --language-code tr-TR \
  --phrases Antrikot Kontrfile Bonfile Kıymalık Kaburga Döş But HoReCa OptiSupply Pınar şarküteri sucuk sosis salam köfte karkas Kurban karantina PınarOnline

# 6) Gözlem (AgentCore Observability için CloudWatch Transaction Search, hesapta bir kez)
#    aws logs put-resource-policy ... (X-Ray'in aws/spans'a yazma izni) ve:
aws xray update-trace-segment-destination --destination CloudWatchLogs

# 7) Uygulama: S3 + CloudFront + DynamoDB + Lambda + AgentCore Runtime
infra/deploy.sh all
```

`deploy.sh all` sonunda uygulama adresini yazar: `https://<dağıtım>.cloudfront.net`.

## deploy.sh modları

| Komut | Ne yapar |
|---|---|
| `infra/deploy.sh all` | Bucket'lar, DynamoDB tablosu, IAM rolleri, kod paketi, AgentCore Runtime, Lambda, CloudFront, ön yüz |
| `infra/deploy.sh backend` | Yalnızca Lambda (API) kodu ve ortam değişkenleri |
| `infra/deploy.sh runtime` | Yalnızca AgentCore Runtime (ajanlar) |
| `infra/deploy.sh frontend` | `index.html`, `config.js`, `models/*.glb` yükleme + CloudFront önbellek temizliği |

Backend kodu değiştiyse `backend` ve `runtime` (ya da `all`), yalnızca arayüz değiştiyse `frontend` yeterlidir.

## Oluşan kaynaklar

| Kaynak | Ad / açıklama |
|---|---|
| S3 | `optisupply-site-<hesap>` (site, özel; CloudFront OAC ile), `optisupply-artifacts-<hesap>` (kod paketleri), `optisupply-kb-<hesap>` (bilgi bankası belgeleri) |
| S3 Vectors | `optisupply-vectors-<hesap>` / indeks `optisupply-kb` (1024 boyut, kosinüs) |
| CloudFront | Varsayılan davranış → S3; `/api/*` → Lambda Function URL (önbellek kapalı, 60 sn okuma zaman aşımı) |
| Lambda | `optisupply-api` (Node 22, arm64, Lambda Web Adapter, Function URL `RESPONSE_STREAM`) |
| AgentCore Runtime | `optisupply_ajanlar` (NODE_22 kod paketi, giriş `dist/runtime.js`, ADOT açık) |
| AgentCore Memory | `OptiSupplyPlanlamaHafizasi` (semantik strateji, `/kisitlar/{actorId}`) |
| Bedrock | Knowledge Base `optisupply-bilgi-bankasi`, guardrail `optisupply-asistan-guardrail` |
| DynamoDB | `optisupply-kararlar` (karar kaydı, 30 gün TTL) |
| Transcribe | Özel sözlük `optisupply-tr` |
| IAM | `optisupply-api-role`, `optisupply-agentcore-role`, `optisupply-kb-role` |

## Ortam değişkenleri (`backend/.env`)

| Değişken | Açıklama |
|---|---|
| `AWS_REGION` | `us-east-1` |
| `BEDROCK_MODEL_ID` | Orkestratör ve asistan (`global.anthropic.claude-sonnet-4-6`) |
| `BEDROCK_FAST_MODEL_ID` | Uzman ajanlar (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) |
| `NEGOTIATION_TIMEOUT_MS` | Ajan grafiği zaman aşımı (28000) |
| `AGENTCORE_MEMORY_ID`, `AGENTCORE_MEMORY_NAMESPACE`, `AGENTCORE_ACTOR_ID` | Hafıza; aktör kimliğini değiştirmek hafızayı sıfırlar |
| `KNOWLEDGE_BASE_ID` | Bilgi bankası |
| `GUARDRAIL_ID`, `GUARDRAIL_VERSION` | Guardrail |
| `DYNAMODB_TABLE` | Karar kaydı tablosu |
| `TRANSCRIBE_VOCABULARY` | Transcribe özel sözlüğü |
| `PORT` | Yerel sunucu portu (3100) |

`AGENT_RUNTIME_ARN` Lambda'ya `deploy.sh` tarafından eklenir; tanımlı değilse API ajanları kendi sürecinde çalıştırır. Herhangi bir değişken boşsa ilgili özellik yerel yedekle çalışır.

## Doğrulama

```bash
curl -s "https://<dağıtım>.cloudfront.net/api/health?deep=1"     # ok:true, agentHost: agentcore-runtime
cd backend && npm run build && npm test                           # birim testleri (ağ gerekmez)
```

## Güvenlik notları

- Uygulama kimlik doğrulamasızdır; demo dışında kullanılacaksa CloudFront önüne AWS WAF (istek sınırı) ve kimlik doğrulama eklenmelidir.
- Lambda yalnızca Function URL üzerinden çağrılabilir (`lambda:InvokedViaFunctionUrl` koşulu).
- Roller yalnızca gerekli servis ve modellere izin verir; `.env` ve `infra/.state.env` git'e girmez.

## Kaldırma

Kaynaklar şu sırayla silinir: CloudFront dağıtımı (önce devre dışı bırakılır), Lambda ve Function URL, AgentCore Runtime, Knowledge Base ve veri kaynağı, S3 Vectors indeksi ve bucket'ı, S3 bucket'ları, DynamoDB tablosu, AgentCore Memory, guardrail, Transcribe sözlüğü, IAM rolleri.
