#!/usr/bin/env bash
# Bedrock Knowledge Base (S3 Vectors) kurulumu ve belge yükleme. Tekrar çalıştırılabilir.
#   Belgeler   : infra/kb/docs/*.md  → s3://optisupply-kb-<hesap>/docs/
#   Vektörler  : S3 Vectors (optisupply-vectors-<hesap>/optisupply-kb), Amazon Titan Text Embeddings v2 (1024)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
DOCS="optisupply-kb-${ACCOUNT}"
VB="optisupply-vectors-${ACCOUNT}"
IDX="optisupply-kb"
ROLE="optisupply-kb-role"
EMB="arn:aws:bedrock:${REGION}::foundation-model/amazon.titan-embed-text-v2:0"
STATE="${ROOT}/infra/.state.env"; touch "$STATE"; source "$STATE"
save() { grep -v "^$1=" "$STATE" > "$STATE.tmp" || true; echo "$1=$2" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"; export "$1=$2"; }

# Kaynak HTML dosyaları varsa belgeleri yeniden üret; yoksa infra/kb/docs/ altındaki hazır belgeleri kullan
if [ -f "$ROOT/OptiSupply_Dijital_Ikiz.html" ] && [ -f "$ROOT/OptiSupply_Dijital_Ikiz_Rehberi.html" ]; then python3 "$ROOT/infra/kb/build_docs.py" >/dev/null; fi
aws s3api head-bucket --bucket "$DOCS" 2>/dev/null || aws s3api create-bucket --bucket "$DOCS" --region "$REGION" >/dev/null
aws s3 sync "$ROOT/infra/kb/docs/" "s3://$DOCS/docs/" --delete --quiet

aws s3vectors get-vector-bucket --vector-bucket-name "$VB" >/dev/null 2>&1 || aws s3vectors create-vector-bucket --vector-bucket-name "$VB" >/dev/null
if ! aws s3vectors get-index --vector-bucket-name "$VB" --index-name "$IDX" >/dev/null 2>&1; then
  # Bedrock metni ve metaveriyi bu anahtarlarda saklar; filtrelenebilir metaveri sınırını aşmasın diye filtrelenemez olmalı
  aws s3vectors create-index --vector-bucket-name "$VB" --index-name "$IDX" --data-type float32 --dimension 1024 --distance-metric cosine \
    --metadata-configuration '{"nonFilterableMetadataKeys":["AMAZON_BEDROCK_TEXT","AMAZON_BEDROCK_METADATA"]}' >/dev/null
fi
IDX_ARN="$(aws s3vectors get-index --vector-bucket-name "$VB" --index-name "$IDX" --query index.indexArn --output text)"

if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"bedrock.amazonaws.com\"},\"Action\":\"sts:AssumeRole\",\"Condition\":{\"StringEquals\":{\"aws:SourceAccount\":\"${ACCOUNT}\"}}}]}" >/dev/null
  sleep 10
fi
aws iam put-role-policy --role-name "$ROLE" --policy-name kb-access --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
 {\"Effect\":\"Allow\",\"Action\":\"bedrock:InvokeModel\",\"Resource\":\"${EMB}\"},
 {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:ListBucket\"],\"Resource\":[\"arn:aws:s3:::${DOCS}\",\"arn:aws:s3:::${DOCS}/*\"]},
 {\"Effect\":\"Allow\",\"Action\":[\"s3vectors:PutVectors\",\"s3vectors:GetVectors\",\"s3vectors:DeleteVectors\",\"s3vectors:QueryVectors\",\"s3vectors:GetIndex\"],\"Resource\":\"${IDX_ARN}\"}]}"
ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)"

if [ -z "${KB_ID:-}" ]; then
  sleep 20
  KB_ID="$(aws bedrock-agent create-knowledge-base --name optisupply-bilgi-bankasi \
    --description 'Pınar Et OptiSupply: rehber, HACCP, onay matrisi, veri raporu, model varsayımları' \
    --role-arn "$ROLE_ARN" \
    --knowledge-base-configuration "{\"type\":\"VECTOR\",\"vectorKnowledgeBaseConfiguration\":{\"embeddingModelArn\":\"${EMB}\"}}" \
    --storage-configuration "{\"type\":\"S3_VECTORS\",\"s3VectorsConfiguration\":{\"indexArn\":\"${IDX_ARN}\"}}" \
    --query knowledgeBase.knowledgeBaseId --output text)"
  save KB_ID "$KB_ID"
fi
for i in $(seq 1 30); do st="$(aws bedrock-agent get-knowledge-base --knowledge-base-id "$KB_ID" --query knowledgeBase.status --output text)"; [ "$st" = ACTIVE ] && break; sleep 4; done
echo "KB $KB_ID: $st"

if [ -z "${KB_DS_ID:-}" ]; then
  KB_DS_ID="$(aws bedrock-agent create-data-source --knowledge-base-id "$KB_ID" --name proje-belgeleri \
    --data-source-configuration "{\"type\":\"S3\",\"s3Configuration\":{\"bucketArn\":\"arn:aws:s3:::${DOCS}\",\"inclusionPrefixes\":[\"docs/\"]}}" \
    --vector-ingestion-configuration '{"chunkingConfiguration":{"chunkingStrategy":"FIXED_SIZE","fixedSizeChunkingConfiguration":{"maxTokens":300,"overlapPercentage":15}}}' \
    --query dataSource.dataSourceId --output text)"
  save KB_DS_ID "$KB_DS_ID"
fi
JOB="$(aws bedrock-agent start-ingestion-job --knowledge-base-id "$KB_ID" --data-source-id "$KB_DS_ID" --query ingestionJob.ingestionJobId --output text)"
for i in $(seq 1 60); do
  read -r st stats < <(aws bedrock-agent get-ingestion-job --knowledge-base-id "$KB_ID" --data-source-id "$KB_DS_ID" --ingestion-job-id "$JOB" --query '[ingestionJob.status, to_string(ingestionJob.statistics)]' --output text)
  case "$st" in COMPLETE|FAILED|STOPPED) break;; esac; sleep 5
done
echo "Yükleme: $st $stats"
aws bedrock-agent get-ingestion-job --knowledge-base-id "$KB_ID" --data-source-id "$KB_DS_ID" --ingestion-job-id "$JOB" --query ingestionJob.failureReasons --output text
