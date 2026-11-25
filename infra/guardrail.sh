#!/usr/bin/env bash
# Guardrails for Amazon Bedrock: herkese açık sohbet asistanı için koruma. Tekrar çalıştırılabilir.
#   - İçerik filtreleri + prompt saldırısı (STANDARD katman: çok dilli, bölgeler arası profil)
#   - Yasak konu: siyaset (yatırım konusu, ürün kârlılığı sorularını da engellediği için kaldırıldı)
#   - Kişisel veri: e-posta, telefon, TC kimlik no maskelenir
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="${ROOT}/infra/.state.env"; touch "$STATE"; source "$STATE"
save() { grep -v "^$1=" "$STATE" > "$STATE.tmp" || true; echo "$1=$2" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"; export "$1=$2"; }
TIER="${GUARDRAIL_TIER:-STANDARD}"

f() { echo "{\"type\":\"$1\",\"inputStrength\":\"$2\",\"outputStrength\":\"$3\"}"; }
CONTENT="{\"filtersConfig\":[$(f HATE HIGH HIGH),$(f INSULTS HIGH HIGH),$(f SEXUAL HIGH HIGH),$(f VIOLENCE MEDIUM MEDIUM),$(f MISCONDUCT HIGH HIGH),$(f PROMPT_ATTACK HIGH NONE)],\"tierConfig\":{\"tierName\":\"$TIER\"}}"
TOPICS="{\"topicsConfig\":[
 {\"name\":\"Siyaset\",\"definition\":\"Siyasi partiler, seçimler, politikacılar ve hükümet politikaları hakkında görüş veya yorum.\",\"examples\":[\"Hangi partiye oy vermeliyim?\",\"Hükümetin ekonomi politikası hakkında ne düşünüyorsun?\"],\"type\":\"DENY\"}],
 \"tierConfig\":{\"tierName\":\"$TIER\"}}"
PII='{"piiEntitiesConfig":[{"type":"EMAIL","action":"ANONYMIZE"},{"type":"PHONE","action":"ANONYMIZE"}],"regexesConfig":[{"name":"TC_KIMLIK","description":"TC kimlik numarası","pattern":"\\b[1-9][0-9]{10}\\b","action":"ANONYMIZE"},{"name":"TR_TELEFON","description":"Türkiye cep telefonu","pattern":"(\\+90|0)?\\s?5[0-9]{2}\\s?[0-9]{3}\\s?[0-9]{2}\\s?[0-9]{2}","action":"ANONYMIZE"}]}'
XR=(); [ "$TIER" = STANDARD ] && XR=(--cross-region-config guardrailProfileIdentifier=us.guardrail.v1:0)
MSG_IN='Bu soruya yanıt veremiyorum. OptiSupply asistanı yalnızca tedarik planı, üretim, fiyat, depo ve kalite konularında yardımcı olur.'
MSG_OUT='Bu yanıt güvenlik politikası nedeniyle gösterilemiyor. Lütfen sorunuzu tedarik planı kapsamında yeniden sorun.'

if [ -z "${GUARDRAIL_ID:-}" ]; then
  GUARDRAIL_ID="$(aws bedrock create-guardrail --name optisupply-asistan-guardrail --description 'OptiSupply sohbet asistani korumasi' \
    --content-policy-config "$CONTENT" --topic-policy-config "$TOPICS" --sensitive-information-policy-config "$PII" "${XR[@]}" \
    --blocked-input-messaging "$MSG_IN" --blocked-outputs-messaging "$MSG_OUT" --query guardrailId --output text)"
  save GUARDRAIL_ID "$GUARDRAIL_ID"
else
  aws bedrock update-guardrail --guardrail-identifier "$GUARDRAIL_ID" --name optisupply-asistan-guardrail \
    --content-policy-config "$CONTENT" --topic-policy-config "$TOPICS" --sensitive-information-policy-config "$PII" "${XR[@]}" \
    --blocked-input-messaging "$MSG_IN" --blocked-outputs-messaging "$MSG_OUT" >/dev/null
fi
for i in $(seq 1 20); do st="$(aws bedrock get-guardrail --guardrail-identifier "$GUARDRAIL_ID" --query status --output text)"; [ "$st" = READY ] && break; sleep 3; done
V="$(aws bedrock create-guardrail-version --guardrail-identifier "$GUARDRAIL_ID" --description "$(date +%F-%H%M)" --query version --output text)"
save GUARDRAIL_VERSION "$V"
echo "Guardrail $GUARDRAIL_ID sürüm $V ($TIER)"
