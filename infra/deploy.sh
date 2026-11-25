#!/usr/bin/env bash
# OptiSupply AWS kurulumu (tekrar çalıştırılabilir).
#   Ön yüz : S3 (özel) + CloudFront (OAC)
#   API    : Lambda (Node 22, arm64) + Lambda Web Adapter, Function URL (RESPONSE_STREAM)
#   CloudFront /api/*  →  Lambda Function URL (SSE akışı)
# Kullanım: infra/deploy.sh [all|backend|frontend]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
APP="optisupply"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
ARTIFACTS="${APP}-artifacts-${ACCOUNT}"
SITE="${APP}-site-${ACCOUNT}"
FN="${APP}-api"
ROLE="${APP}-api-role"
LWA_LAYER="arn:aws:lambda:${REGION}:753240598075:layer:LambdaAdapterLayerArm64:25"
STATE="${ROOT}/infra/.state.env"
WORK="${TMPDIR:-/tmp}/${APP}-build"
MODE="${1:-all}"
touch "$STATE"; source "$STATE"
save() { grep -v "^$1=" "$STATE" > "$STATE.tmp" || true; echo "$1=$2" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"; export "$1=$2"; }
log() { printf '\n== %s\n' "$*"; }

# Lambda ortam değişkenleri backend/.env'den (AWS_REGION Lambda'da ayrılmış)
envjson() {
  python3 - "$ROOT/backend/.env" <<'EOF'
import json,sys
v={}
for l in open(sys.argv[1]):
    l=l.strip()
    if not l or l.startswith('#') or '=' not in l: continue
    k,x=l.split('=',1)
    if k in ('AWS_REGION','PORT'): continue
    v[k]=x
import os
if os.environ.get('AGENT_RUNTIME_ARN') and os.environ.get('USE_RUNTIME','1')=='1': v['AGENT_RUNTIME_ARN']=os.environ['AGENT_RUNTIME_ARN']
v.update({'AWS_LAMBDA_EXEC_WRAPPER':'/opt/bootstrap','AWS_LWA_INVOKE_MODE':'response_stream','AWS_LWA_PORT':'8080','PORT':'8080',
          'AWS_LWA_READINESS_CHECK_PATH':'/api/health','NODE_OPTIONS':'--enable-source-maps'})
print(json.dumps({'Variables':v}))
EOF
}

ensure_buckets() {
  for b in "$ARTIFACTS" "$SITE"; do
    aws s3api head-bucket --bucket "$b" 2>/dev/null || aws s3api create-bucket --bucket "$b" --region "$REGION" >/dev/null
  done
  aws s3api put-public-access-block --bucket "$SITE" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
}

ensure_role() {
  if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
    aws iam create-role --role-name "$ROLE" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
    aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    sleep 10
  fi
  # Yalnızca workshop allowlist'indeki modeller + AgentCore Memory/Runtime + Knowledge Base + Polly
  aws iam put-role-policy --role-name "$ROLE" --policy-name "${APP}-access" --policy-document "$(cat <<EOF
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream"],"Resource":[
   "arn:aws:bedrock:*:${ACCOUNT}:inference-profile/*",
   "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-6",
   "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
   "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-5",
   "arn:aws:bedrock:*::foundation-model/amazon.nova-2-lite-v1:0",
   "arn:aws:bedrock:*::foundation-model/cohere.embed-multilingual-v3"]},
 {"Effect":"Allow","Action":["bedrock-agentcore:CreateEvent","bedrock-agentcore:ListEvents","bedrock-agentcore:RetrieveMemoryRecords","bedrock-agentcore:InvokeAgentRuntime"],"Resource":"*"},
 {"Effect":"Allow","Action":["bedrock:Retrieve","bedrock:RetrieveAndGenerate"],"Resource":"*"},
 {"Effect":"Allow","Action":["bedrock:ApplyGuardrail"],"Resource":["arn:aws:bedrock:*:${ACCOUNT}:guardrail/*","arn:aws:bedrock:*:${ACCOUNT}:guardrail-profile/*","arn:aws:bedrock:*::guardrail-profile/*"]},
 {"Effect":"Allow","Action":["polly:SynthesizeSpeech","transcribe:StartStreamTranscription"],"Resource":"*"},
 {"Effect":"Allow","Action":["dynamodb:PutItem","dynamodb:Query","dynamodb:Scan"],"Resource":"arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${APP}-kararlar"}]}
EOF
)"
  ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)"; save ROLE_ARN "$ROLE_ARN"
}

# Karar kayıtları (öneri / onay / red) — Amazon DynamoDB, 30 gün TTL
TABLE="${APP}-kararlar"
ensure_table() {
  if ! aws dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
    aws dynamodb create-table --table-name "$TABLE" --billing-mode PAY_PER_REQUEST \
      --attribute-definitions AttributeName=sessionId,AttributeType=S AttributeName=ts,AttributeType=S \
      --key-schema AttributeName=sessionId,KeyType=HASH AttributeName=ts,KeyType=RANGE >/dev/null
    aws dynamodb wait table-exists --table-name "$TABLE"
    aws dynamodb update-time-to-live --table-name "$TABLE" --time-to-live-specification Enabled=true,AttributeName=ttl >/dev/null
  fi
}

build_backend() {
  log "backend derleniyor"
  (cd "$ROOT/backend" && npm run build >/dev/null)
  rm -rf "$WORK" && mkdir -p "$WORK/pkg"
  cp -R "$ROOT/backend/dist" "$ROOT/backend/package.json" "$ROOT/backend/package-lock.json" "$WORK/pkg/"
  (cd "$WORK/pkg" && npm ci --omit=dev --no-audit --no-fund --cache "$WORK/.npm" >/dev/null)
  printf '#!/bin/bash\nexec node dist/main.js\n' > "$WORK/pkg/run.sh"; chmod +x "$WORK/pkg/run.sh"
  (cd "$WORK/pkg" && zip -qr "$WORK/api.zip" .)
  aws s3 cp "$WORK/api.zip" "s3://$ARTIFACTS/api.zip" --quiet
}

deploy_lambda() {
  log "Lambda: $FN"
  local env; env="$(AGENT_RUNTIME_ARN="${AGENT_RUNTIME_ARN:-}" envjson)"
  if aws lambda get-function --function-name "$FN" >/dev/null 2>&1; then
    aws lambda update-function-code --function-name "$FN" --s3-bucket "$ARTIFACTS" --s3-key api.zip >/dev/null
    aws lambda wait function-updated --function-name "$FN"
    aws lambda update-function-configuration --function-name "$FN" --environment "$env" --timeout 120 --memory-size 1536 --layers "$LWA_LAYER" >/dev/null
  else
    aws lambda create-function --function-name "$FN" --runtime nodejs22.x --architectures arm64 --handler run.sh \
      --role "$ROLE_ARN" --code "S3Bucket=$ARTIFACTS,S3Key=api.zip" --timeout 120 --memory-size 1536 \
      --layers "$LWA_LAYER" --environment "$env" >/dev/null
  fi
  aws lambda wait function-updated --function-name "$FN"
  if ! aws lambda get-function-url-config --function-name "$FN" >/dev/null 2>&1; then
    aws lambda create-function-url-config --function-name "$FN" --auth-type NONE --invoke-mode RESPONSE_STREAM >/dev/null
    aws lambda add-permission --function-name "$FN" --statement-id url-public --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE >/dev/null
    aws lambda add-permission --function-name "$FN" --statement-id url-invoke --action lambda:InvokeFunction --principal '*' --invoked-via-function-url >/dev/null 2>&1 || true
  fi
  FN_URL="$(aws lambda get-function-url-config --function-name "$FN" --query FunctionUrl --output text)"; save FN_URL "$FN_URL"
  echo "Function URL: $FN_URL"
}

ensure_cloudfront() {
  [ -n "${CF_ID:-}" ] && return
  log "CloudFront oluşturuluyor"
  local oac fnhost
  oac="$(aws cloudfront create-origin-access-control --origin-access-control-config "Name=${APP}-oac-${ACCOUNT},SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" --query OriginAccessControl.Id --output text)"
  fnhost="$(echo "$FN_URL" | sed -E 's#https://([^/]+)/?#\1#')"
  cat > "$WORK/cf.json" <<EOF
{"CallerReference":"${APP}-$(date +%s)","Comment":"OptiSupply dijital ikiz","Enabled":true,"DefaultRootObject":"index.html","PriceClass":"PriceClass_100","HttpVersion":"http2and3",
 "Origins":{"Quantity":2,"Items":[
  {"Id":"site","DomainName":"${SITE}.s3.${REGION}.amazonaws.com","OriginAccessControlId":"${oac}","S3OriginConfig":{"OriginAccessIdentity":""}},
  {"Id":"api","DomainName":"${fnhost}","CustomOriginConfig":{"HTTPPort":80,"HTTPSPort":443,"OriginProtocolPolicy":"https-only","OriginSslProtocols":{"Quantity":1,"Items":["TLSv1.2"]},"OriginReadTimeout":60,"OriginKeepaliveTimeout":60}}]},
 "DefaultCacheBehavior":{"TargetOriginId":"site","ViewerProtocolPolicy":"redirect-to-https","Compress":true,"CachePolicyId":"658327ea-f89d-4fab-a63d-7e88639e58f6",
   "AllowedMethods":{"Quantity":2,"Items":["GET","HEAD"],"CachedMethods":{"Quantity":2,"Items":["GET","HEAD"]}}},
 "CacheBehaviors":{"Quantity":1,"Items":[{"PathPattern":"/api/*","TargetOriginId":"api","ViewerProtocolPolicy":"redirect-to-https","Compress":false,
   "CachePolicyId":"4135ea2d-6df8-44a3-9df3-4b5a84be39ad","OriginRequestPolicyId":"b689b0a8-53d0-40ab-baf2-68738e2966ac",
   "AllowedMethods":{"Quantity":7,"Items":["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],"CachedMethods":{"Quantity":2,"Items":["GET","HEAD"]}}}]}}
EOF
  local out; out="$(aws cloudfront create-distribution --distribution-config "file://$WORK/cf.json" --output json)"
  save CF_ID "$(echo "$out" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Distribution"]["Id"])')"
  save CF_DOMAIN "$(echo "$out" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Distribution"]["DomainName"])')"
  aws s3api put-bucket-policy --bucket "$SITE" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"cloudfront.amazonaws.com\"},\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::${SITE}/*\",\"Condition\":{\"StringEquals\":{\"AWS:SourceArn\":\"arn:aws:cloudfront::${ACCOUNT}:distribution/${CF_ID}\"}}}]}"
}

deploy_frontend() {
  log "ön yüz yükleniyor"
  aws s3 cp "$ROOT/frontend/index.html" "s3://$SITE/index.html" --content-type 'text/html; charset=utf-8' --cache-control 'no-cache' --quiet
  aws s3 cp "$ROOT/frontend/config.js" "s3://$SITE/config.js" --content-type 'application/javascript; charset=utf-8' --cache-control 'no-cache' --quiet
  # 3B modeller (Quaternius, CC0)
  aws s3 sync "$ROOT/frontend/models/" "s3://$SITE/models/" --exclude '*' --include '*.glb' --content-type 'model/gltf-binary' --cache-control 'public, max-age=86400' --quiet
  aws s3 cp "$ROOT/frontend/models/LISANS.txt" "s3://$SITE/models/LISANS.txt" --content-type 'text/plain; charset=utf-8' --quiet
  [ -n "${CF_ID:-}" ] && aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths '/*' >/dev/null || true
}

# Ajanlar: Amazon Bedrock AgentCore Runtime (NODE_22 kod dağıtımı, Docker gerekmez)
deploy_runtime() {
  log "AgentCore Runtime"
  local rrole="${APP}-agentcore-role" name="optisupply_ajanlar"
  if ! aws iam get-role --role-name "$rrole" >/dev/null 2>&1; then
    aws iam create-role --role-name "$rrole" --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"bedrock-agentcore.amazonaws.com\"},\"Action\":\"sts:AssumeRole\",\"Condition\":{\"StringEquals\":{\"aws:SourceAccount\":\"${ACCOUNT}\"}}}]}" >/dev/null
  fi
  aws iam put-role-policy --role-name "$rrole" --policy-name "${APP}-agents" --policy-document "$(aws iam get-role-policy --role-name "$ROLE" --policy-name "${APP}-access" --query PolicyDocument --output json)"
  aws iam put-role-policy --role-name "$rrole" --policy-name "${APP}-observability" --policy-document '{"Version":"2012-10-17","Statement":[
   {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents","logs:DescribeLogStreams","logs:DescribeLogGroups"],"Resource":"*"},
   {"Effect":"Allow","Action":["xray:PutTraceSegments","xray:PutTelemetryRecords","xray:GetSamplingRules","xray:GetSamplingTargets","xray:PutSpans","xray:PutSpansForIndexing"],"Resource":"*"},
   {"Effect":"Allow","Action":"cloudwatch:PutMetricData","Resource":"*","Condition":{"StringEquals":{"cloudwatch:namespace":"bedrock-agentcore"}}},
   {"Effect":"Allow","Action":["bedrock-agentcore:GetWorkloadAccessToken","bedrock-agentcore:GetWorkloadAccessTokenForJWT","bedrock-agentcore:GetWorkloadAccessTokenForUserId"],"Resource":"*"}]}'
  local rarn; rarn="$(aws iam get-role --role-name "$rrole" --query Role.Arn --output text)"
  aws s3 cp "$WORK/api.zip" "s3://$ARTIFACTS/runtime.zip" --quiet
  local art="{\"codeConfiguration\":{\"code\":{\"s3\":{\"bucket\":\"${ARTIFACTS}\",\"prefix\":\"runtime.zip\"}},\"runtime\":\"NODE_22\",\"entryPoint\":[\"dist/runtime.js\"]}}"
  local renv; renv="$(python3 -c "import json,sys; print(json.dumps({k:v for k,v in json.loads(sys.argv[1])['Variables'].items() if not k.startswith('AWS_L') and k not in ('PORT','AGENT_RUNTIME_ARN','NODE_OPTIONS')} | {
    # AgentCore Observability: ADOT, Strands span'lerini (gen_ai) CloudWatch Transaction Search'e gönderir
    'AGENT_OBSERVABILITY_ENABLED':'true','OTEL_SERVICE_NAME':'optisupply_ajanlar','OTEL_LOGS_EXPORTER':'none','OTEL_METRICS_EXPORTER':'none',
    'OTEL_RESOURCE_ATTRIBUTES':'service.name=optisupply_ajanlar,deployment.environment=hackathon',
    'NODE_OPTIONS':'--require @aws/aws-distro-opentelemetry-node-autoinstrumentation/register'}))" "$(USE_RUNTIME=0 envjson)")"
  if [ -z "${AGENT_RUNTIME_ID:-}" ]; then
    sleep 10
    local out; out="$(aws bedrock-agentcore-control create-agent-runtime --agent-runtime-name "$name" --description 'OptiSupply Strands ajanlari' \
      --agent-runtime-artifact "$art" --role-arn "$rarn" --network-configuration networkMode=PUBLIC --protocol-configuration serverProtocol=HTTP \
      --environment-variables "$renv" --output json)"
    save AGENT_RUNTIME_ID "$(echo "$out" | python3 -c 'import json,sys;print(json.load(sys.stdin)["agentRuntimeId"])')"
    save AGENT_RUNTIME_ARN "$(echo "$out" | python3 -c 'import json,sys;print(json.load(sys.stdin)["agentRuntimeArn"])')"
  else
    aws bedrock-agentcore-control update-agent-runtime --agent-runtime-id "$AGENT_RUNTIME_ID" --agent-runtime-artifact "$art" --role-arn "$rarn" \
      --network-configuration networkMode=PUBLIC --protocol-configuration serverProtocol=HTTP --environment-variables "$renv" >/dev/null
  fi
  sleep 10  # güncelleme başlamadan READY görmemek için
  for i in $(seq 1 60); do st="$(aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id "$AGENT_RUNTIME_ID" --query status --output text)"; case "$st" in READY|*FAILED) break;; esac; sleep 5; done
  echo "Runtime $AGENT_RUNTIME_ID: $st"
}

mkdir -p "$WORK"
case "$MODE" in
  runtime) ensure_role; build_backend; deploy_runtime ;;
  backend) build_backend; deploy_lambda ;;
  frontend) deploy_frontend ;;
  all) ensure_buckets; ensure_table; ensure_role; build_backend; deploy_runtime; deploy_lambda; ensure_cloudfront; deploy_frontend ;;
esac
log "bitti"
[ -n "${CF_DOMAIN:-}" ] && echo "Uygulama: https://${CF_DOMAIN}"
