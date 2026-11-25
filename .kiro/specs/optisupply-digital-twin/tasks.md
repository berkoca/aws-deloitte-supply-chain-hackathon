# Implementation Plan: OptiSupply Digital Twin

## Overview

Implementation of the OptiSupply digital twin as specified in `requirements.md` and `design.md`: a plain HTML/CSS/JavaScript frontend derived from the supplied prototype, a TypeScript NestJS backend with eight Strands agents on Amazon Bedrock, AgentCore Runtime / Memory / Observability, a Bedrock Knowledge Base and Guardrail, voice with Transcribe and Polly, and a repeatable AWS deployment. All tasks are complete.

## Tasks

- [x] 1. Analyse the source files and set up the workspace
  - [x] 1.1 Analyse the prototype and the guide (simulation, agents, shocks, approval flow, HACCP, reporting data)
    - _Requirements: 1.1_
  - [x] 1.2 Create `frontend/index.html` from the prototype; leave the supplied source files unchanged (kept outside the repository)
    - _Requirements: 1.1, 1.2_
  - [x] 1.3 Scaffold `backend/` (Node.js, TypeScript, NestJS 12 ESM, Strands Agents SDK, AWS SDK v3, Zod)
    - _Requirements: 2.2_
  - [x] 1.4 Keep the prototype features working in the application: 3D plant, shock buttons, HACCP view and lots, Veri raporu
    - _Requirements: 3.1, 8.1, 12.1, 12.2, 12.3, 19.2_

- [x] 2. Port the twin to the backend
  - [x] 2.1 Port demand, options, carcass evaluation, scenario choice, repricing and hourly step into `backend/src/twin/sim.ts`
    - _Requirements: 2.3, 5.1, 5.2, 5.3, 5.4_
  - [x] 2.2 Implement `project()` (24-hour with/without plan on copies) and `allowedActions()`
    - _Requirements: 8.3, 8.4, 9.4_
  - [x] 2.3 Verify browser/backend projection parity end to end
    - _Requirements: 8.4, 10.1_

- [x] 3. Build the agents
  - [x] 3.1 Implement twin tools (`talep_sinyali`, `karkas_verim`, `hat_kapasitesi`, `fiyat_durumu`, `tedarik_durumu`, `soguk_depo`, `ikiz_gostergeleri`, `plani_projekte_et`, `hafizadaki_kisitlar`)
    - _Requirements: 10.1, 10.3_
  - [x] 3.2 Define the eight agents, prompts, structured outputs and shock lineups in a NestJS-independent module
    - _Requirements: 2.4, 9.1, 9.3_
  - [x] 3.3 Build the Strands Graph negotiation with SSE events, timeouts and server-side projection of the plan
    - _Requirements: 9.2, 9.4, 9.5, 9.6_
  - [x] 3.4 Choose models from the workshop allowlist (Claude Sonnet 4.6 for the orchestrator and assistant, Claude Haiku 4.5 for the specialists); evaluate Nova 2 Lite and keep it as an optional override
    - _Requirements: 9.1_

- [x] 4. Build the API
  - [x] 4.1 Implement NestJS endpoints for health, negotiate (SSE + heartbeat), warm, explain, assistant and memory
    - _Requirements: 2.5, 20.2_
  - [x] 4.2 Serve the frontend from the local server (port 3100) for development
    - _Requirements: 16.3_

- [x] 5. Integrate the frontend with the backend
  - [x] 5.1 Add the bridge: snapshot, health check with retry, SSE negotiation consumer with paced messages and scripted fallback
    - _Requirements: 9.5, 9.6, 16.3_
  - [x] 5.2 Use the orchestrator's actions and rationale in the approval card; pause the clock during negotiation
    - _Requirements: 8.2, 8.3, 11.1_
  - [x] 5.3 Add the agent trace and model commentary to "Neden bu karar?"
    - _Requirements: 17.2_

- [x] 6. Add AgentCore Memory
  - [x] 6.1 Create the memory with a semantic strategy (`/kisitlar/{actorId}`)
    - _Requirements: 11.3_
  - [x] 6.2 Implement AgentCore and local memory behind one interface; write rejections and read long-term records in the orchestrator tool
    - _Requirements: 11.2, 11.4_
  - [x] 6.3 Make the actor ID configurable and reset it to `pinar-et-sunum` before the presentation
    - _Requirements: 16.1_

- [x] 7. Deploy to AWS
  - [x] 7.1 Write `infra/deploy.sh` (S3, CloudFront with OAC, Lambda with Web Adapter and streaming Function URL, IAM)
    - _Requirements: 20.1, 20.2_
  - [x] 7.2 Restrict the Lambda permission to Function URL invocations only
    - _Requirements: 20.3_
  - [x] 7.3 Verify the live link, SSE streaming and the full demo flow on CloudFront
    - _Requirements: 20.4_

- [x] 8. Add the Knowledge Base
  - [x] 8.1 Generate Knowledge Base documents from the source files (`infra/kb/build_docs.py`), split for focused retrieval
    - _Requirements: 1.3_
  - [x] 8.2 Create S3 Vectors, the Knowledge Base (Titan Embeddings v2) and ingestion (`infra/kb/setup_kb.sh`); verify Turkish retrieval
    - _Requirements: 13.3_
  - [x] 8.3 Add the `bilgi_bankasi` tool to the assistant
    - _Requirements: 13.3_

- [x] 9. Move the agents to AgentCore Runtime
  - [x] 9.1 Implement `runtime.ts` with `BedrockAgentCoreApp` (negotiate, ask, ask_stream, explain, warm)
    - _Requirements: 15.1, 15.2_
  - [x] 9.2 Implement the Runtime client (SSE and JSON) and API routing with in-process fallback
    - _Requirements: 2.5, 15.4, 16.2_
  - [x] 9.3 Deploy the Runtime as a NODE_22 code zip; warm sessions on page load
    - _Requirements: 15.3_

- [x] 10. Add AgentCore Observability
  - [x] 10.1 Enable CloudWatch Transaction Search
    - _Requirements: 17.1_
  - [x] 10.2 Add AWS Distro for OpenTelemetry to the Runtime and verify graph, agent, model and tool spans in `aws/spans`
    - _Requirements: 17.1_

- [x] 11. Add Guardrails for Amazon Bedrock
  - [x] 11.1 Create the guardrail (`infra/guardrail.sh`): content filters, prompt attack, "Siyaset" topic, PII anonymization with Turkish ID and phone regexes
    - _Requirements: 13.5_
  - [x] 11.2 Test for false positives and remove the investment topic that blocked profitability questions
    - _Requirements: 13.5_
  - [x] 11.3 Attach the guardrail to the assistant in asynchronous streaming mode
    - _Requirements: 13.2, 13.5_

- [x] 12. Add the Decision Log
  - [x] 12.1 Create the DynamoDB table with TTL and the decisions service and endpoints (local fallback)
    - _Requirements: 11.5_
  - [x] 12.2 Log orders, proposals, approvals and rejections; show "Karar kaydı" in the Kalite view
    - _Requirements: 7.5, 11.5_

- [x] 13. Add voice
  - [x] 13.1 Add the Polly endpoint with word speech marks; reveal text in sync with audio
    - _Requirements: 14.3_
  - [x] 13.2 Add Transcribe streaming (tr-TR) with a custom vocabulary
    - _Requirements: 14.2_
  - [x] 13.3 Implement end-of-speech detection and continuous two-way conversation with barge-in on the microphone button
    - _Requirements: 14.1, 14.4_
  - [x] 13.4 Stream speech sentence by sentence; fall back to browser speech recognition
    - _Requirements: 14.3, 14.5_

- [x] 14. Rework the live factory
  - [x] 14.1 Add a deterministic start (Pzt 06:00), a seeded RNG, the minute clock, speed levels and the demo speed
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 14.2 Add customer orders (form, presets, automatic orders), per-plan fulfilment, delivery and late events
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 14.3 Port orders to the backend twin and the `talep_sinyali` tool
    - _Requirements: 7.5_
  - [x] 14.4 Bind 3D elements to twin values; simplify the labels
    - _Requirements: 3.3, 3.5_
  - [x] 14.5 Add CC0 GLTF models (cow, worker, truck), workers at stations, truck wheel pivots and the cow sound
    - _Requirements: 1.4, 3.2, 3.4_
  - [x] 14.6 Add the 12-step demo with camera close-ups and optional Polly narration (off by default)
    - _Requirements: 18.4_

- [x] 15. Redesign the chat
  - [x] 15.1 Add the bottom "OptiSupply'a sor" bar and the dialog with greeting, quick-start cards, live summary and new chat
    - _Requirements: 13.1_
  - [x] 15.2 Add streaming answers (`/api/assistant/stream`) with tool status, preamble reset and fallbacks
    - _Requirements: 13.2, 13.6_
  - [x] 15.3 Add the `grafik_goster` tool and the SVG chart renderer with side-by-side layout and animations
    - _Requirements: 10.2, 13.3, 13.4_

- [x] 16. Fix data consistency across views
  - [x] 16.1 Derive dates and weeks from the clock; anchor the history to 16 Kas 2026; rename the periods to "Son 7 gün / Önceki 7 gün"
    - _Requirements: 18.5_
  - [x] 16.2 Correct the pricing rule in both twins (demand-driven up and down moves, positive profit effect)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 16.3 Fix the parts-table revenue share and processing cost, the channel shares, the KPI label ("Reddedilen tonaj") and the cost note (100 ₺/kg)
    - _Requirements: 5.5, 18.5_
  - [x] 16.4 Apply Turkish number formatting, consistent plan names and working Excel download
    - _Requirements: 18.1, 19.1_

- [x] 17. Make the UI responsive and polish it
  - [x] 17.1 Add doctype and viewport; add mobile layout rules for the header, tabs, KPIs, scene, orders and chat
    - _Requirements: 18.2, 18.3_
  - [x] 17.2 Align the scene and agent column with the KPI grid; show agent cards in two columns with full names; keep the feed scrollable inside its card
    - _Requirements: 18.3_
  - [x] 17.3 Position the stage bar above the chat bar
    - _Requirements: 18.4_

- [x] 18. Write the documentation
  - [x] 18.1 Update `README.md` with architecture, endpoints and deployment commands
    - _Requirements: 20.1_
  - [x] 18.2 Write `DEPLOY.md` (AWS deployment guide) and `TEKNOLOJILER.md` (technologies, purposes and relationships)
    - _Requirements: 2.1, 2.2_
  - [x] 18.3 Align the Kiro spec (requirements, design, tasks) with the implemented system
    - _Requirements: 1.1_

- [x] 19. Add unit tests for the backend twin
  - [x] 19.1 Write `backend/test/twin.test.mjs` with `node:test` (no network): determinism, price corridors (±8% / ±15%), premium price rise under the HoReCa shock, projection isolation, allowed actions after rejections, Classic purchasing formula, carcass yield split, customer-order demand and delivery bounds, OptiSupply vs Classic KPIs, chart builder output
    - _Requirements: 4.1, 5.3, 6.1, 6.2, 6.4, 7.3, 8.4, 9.4, 10.2_
  - [x] 19.2 Add `npm test` and verify that all 11 tests pass
    - _Requirements: 4.1_

## Notes

- Unit tests: `cd backend && npm run build && npm test` (11 tests, `node:test`, offline).
- End-to-end checks were run with headless Chrome (Puppeteer) and the AWS CLI during development; those scripts are not committed to the repository.
- Out-of-scope items are listed at the end of `requirements.md`.
