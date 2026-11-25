# Requirements Document

## Introduction

OptiSupply is a Turkish-language, agentic digital twin for the Pınar Et red-meat supply chain. It simulates hourly material flow from live-animal intake through slaughter, cutting, fresh and frozen storage, delicatessen production, packaging, quality approval and shipping, and compares an AI-assisted plan (**OptiSupply planı**) with the current tonnage-based plan (**Bugünkü plan**) on the same demand.

The product is built from two supplied files, `OptiSupply_Dijital_Ikiz.html` (prototype) and `OptiSupply_Dijital_Ikiz_Rehberi.html` (user guide), which were supplied by the hackathon team and are not included in this repository. The working application is `frontend/index.html`, derived from the prototype. A NestJS backend runs eight Strands agents on Amazon Bedrock, hosted in Amazon Bedrock AgentCore Runtime, and the system is deployed on AWS (CloudFront, S3, Lambda).

## Glossary

- **Twin**: The hourly simulation of the plant (browser copy in `frontend/index.html`, backend copy in `backend/src/twin/sim.ts`).
- **OptiSupply_Plan** (`ajan` policy): Optimized purchasing, product routing, dynamic pricing and approved actions.
- **Classic_Plan** (`klasik` policy, "Bugünkü plan"): Tonnage purchasing with an 8% buffer, historical line-plan ratios and fixed prices.
- **Snapshot**: JSON state sent from the browser to the backend: `env`, `simA`, `simK`, `WI`.
- **Shock**: One of four scenarios: HoReCa steak demand, three weeks to Kurban, regional quarantine, cold-store failure.
- **Action**: One of six approval-gated plan actions: `partBuy`, `lineBoost`, `pricing`, `campaign`, `storage`, `altSupplier`.
- **Plan_Proposal**: Orchestrator output: selected actions, rationale, decision sentence, 24-hour with/without-plan projection and source flag.
- **Customer_Order**: A demand record (`S-1001`…) with customer, channel, cut, mass and due window.
- **Agent_Graph**: The Strands `Graph` of signal agents, parallel specialists and the Orchestrator.
- **Twin_Tools**: Strands tools that compute every number from the Twin.
- **Assistant**: The streaming chat agent with Twin_Tools, Knowledge Base search and chart tool.
- **Runtime**: The AgentCore Runtime deployment of `backend/dist/runtime.js` (`NODE_22`, code zip).
- **API**: The NestJS application running in AWS Lambda behind a Function URL, and locally on port 3100.
- **Decision_Log**: DynamoDB table `optisupply-kararlar` holding orders, proposals, approvals and rejections.
- **Memory**: AgentCore Memory holding rejection reasons; local in-process memory when not configured.
- **Knowledge_Base**: Bedrock Knowledge Base on S3 Vectors, built from the two source files.

## Formalized Source Baselines

### Material Flow

1. Live-animal intake and veterinary acceptance
2. Slaughter and carcass chilling
3. Cutting and whole-carcass allocation
4. Fresh cold storage at 0/+4 °C
5. Frozen storage at −18 °C
6. Fresh packaging (vacuum, MAP, case)
7. Delicatessen lines: sucuk, sausage/salami, frozen burger/meatball
8. Quality approval and lot release
9. Shipping to Perakende, HoReCa, İhracat, PınarOnline
10. Rendering, fire, quality rejection and waste flows

### Yield and Demand Inputs

| Input | Value |
|---|---:|
| Carcass mass per head | 280 kg |
| Live weight → carcass | 55% |
| Kıymalık / Ön parça / But / Döş / Kaburga | 21.05 / 16.84 / 18.52 / 8.42 / 8.42 % |
| Antrikot / Kontrfile / Bonfile | 5.05 / 4.21 / 1.68 % |
| Rendering / process fire | 15.5 / 0.3 % |
| Delicatessen output per kg meat | 1.33 |
| Fresh hourly base demand (same cut order) | 129.9, 89.1, 96.5, 42.6, 48.3, 37.2, 25.9, 10.5 kg/h |
| Supply capacity | 10 carcasses/h (2,800 kg/h) |
| Fresh storage capacity | 8,000 kg |

### Delicatessen Lines

| Line | Capacity | Order baseline | Classic plan/order ratio |
|---|---:|---:|---:|
| Sucuk | 750 kg/h | 427.5 kg/h | 0.838 |
| Sosis-salam | 889 kg/h | 537.4 kg/h | 0.882 |
| Donuk burger-köfte | 556 kg/h | 310.4 kg/h | 0.962 |

### Shock Profiles

| Shock | Effect before approved actions |
|---|---|
| HoReCa biftek talebi | Antrikot ×1.60, Kontrfile ×1.40, Bonfile ×1.30 |
| Kurban'a 3 hafta | All demand ×1.20, Kıymalık ×1.40, supply ×0.85 |
| Bölgesel karantina | Supply ×0.60 |
| Soğuk depo arızası | Storage ×0.50, quality loss 1.2%/h of stock (0.3%/h with `storage`) |

### Synthetic Unit Costs

Carcass 400 ₺/kg, processing 100 ₺/kg, logistics 15 ₺/kg, holding 0.4 ₺/kg·h. The prototype text stated 40 ₺/kg for processing; this was resolved to the executable value (100) and the text was corrected. Prices are synthetic and labelled as examples in the UI.

### HACCP Profile

KKN-1 intake (veterinary check), KKN-2 carcass chilling ≤7 °C (EU 853/2004), KKN-3 cutting room ≤12 °C (EU 853/2004), KKN-4 fresh store ≤4 °C, KKN-5 metal detector hourly test, KKN-6 sausage/salami core ≥72 °C, KKN-7 sucuk pH ≤5.3. Sensors: T-1/T-2 fresh store (threshold +4 °C), F-1 freezer (threshold −15 °C).

### Approval Matrix

Cutting-input plan → Production planning manager; Line plan → Production manager; Price outside corridor → Commercial director; External cut purchase → Purchasing + Quality; Lot release → Quality assurance; Quarantine/disposal → Quality assurance + veterinarian; Packaging/label change → Quality + Marketing.

## Requirements

### Requirement 1: Source Assets

**User Story:** As a product owner, I want the supplied prototype and guide preserved and reused, so that the result stays traceable to the hackathon material.

#### Acceptance Criteria

1. THE system SHALL NOT modify the supplied source files `OptiSupply_Dijital_Ikiz.html` and `OptiSupply_Dijital_Ikiz_Rehberi.html`; they are kept outside this repository.
2. THE working application SHALL be `frontend/index.html`, derived from the prototype, with all backend integration added inside it.
3. THE Knowledge_Base documents SHALL be generated only from facts contained in the two source files (`infra/kb/build_docs.py`) and committed as Markdown in `infra/kb/docs/`.
4. THE 3D models SHALL be CC0 assets stored in `frontend/models/` together with a license file.

### Requirement 2: Architecture

**User Story:** As an engineering team, I want a clear frontend/backend split, so that the demo is portable and deployable on AWS.

#### Acceptance Criteria

1. THE frontend SHALL be a single-page application in HTML, CSS and plain JavaScript using Three.js r128, GLTFLoader, SkeletonUtils and SheetJS.
2. THE backend SHALL be TypeScript on Node.js 22+, NestJS 12, ECMAScript modules.
3. THE backend SHALL contain the Twin at `backend/src/twin/sim.ts`.
4. THE agent code in `backend/src/agents/` SHALL be independent of NestJS, so that the API and the Runtime entry (`backend/src/runtime.ts`) run the same code.
5. WHEN `AGENT_RUNTIME_ARN` is set, THE API SHALL invoke agents through AgentCore Runtime; OTHERWISE THE API SHALL run them in-process.

### Requirement 3: Live Plant Representation

**User Story:** As an operations user, I want to see the whole flow live, so that decisions and their effects are visible together.

#### Acceptance Criteria

1. THE 3D scene SHALL show every Material Flow stage, the four shipping ramps, the animal pen and the corridor.
2. THE 3D scene SHALL use animated models for cows (walk, idle, eat), workers (walk, interact) and trucks, with procedural fallbacks if model loading fails.
3. THE moving elements SHALL be bound to Twin values: boxes on conveyors per kg flow, inbound trucks per carcass rate, outbound trucks per channel flow, forklift speed per depot throughput, worker activity per station load, and pallets per stock level.
4. WHEN a customer order completes, THE scene SHALL send a truck labelled with the customer from the order's ramp.
5. Station labels SHALL show a short title and one value line; HACCP badges SHALL appear only on deviation; on screens narrower than 600 px only main stations SHALL be labelled.

### Requirement 4: Deterministic Hourly Simulation

**User Story:** As a validator, I want reproducible runs, so that every visit starts from the same point and progresses like a real operation.

#### Acceptance Criteria

1. THE Twin SHALL use seeded random generators: seed 47 for sensors and quality, seed 99 for automatic orders.
2. WHEN the page loads, THE Twin SHALL warm up for 30 hidden hours and start at "Hafta 47 · Pzt 06:00".
3. THE clock SHALL advance one simulated hour per tick and show minutes between ticks; the week number SHALL derive from the simulated hour.
4. THE speeds SHALL be 1× (2.5 s per hour), 4×, 12× and 40×; the demo SHALL run at 0.6 s per hour and restore the user's speed afterwards.
5. WHEN the simulation is paused and resumed, THE clock SHALL continue from the same minute.

### Requirement 5: Plan Comparison

**User Story:** As an executive, I want both plans evaluated on the same demand, so that the benefit is fair.

#### Acceptance Criteria

1. Both plans SHALL receive the same base demand, shock multipliers and customer orders every hour.
2. THE OptiSupply_Plan SHALL score 25 candidate carcass volumes per hour and choose the best by profit, with penalties for loss and frozen surplus.
3. THE Classic_Plan SHALL buy `min(capacity, total demand × 1.08)` carcass mass and plan lines with the historical ratios, at fixed prices.
4. Fresh orders SHALL be served before delicatessen lines; surplus SHALL be routed to lines up to capacity; premium surplus above 1.5 hours of demand SHALL be frozen.
5. THE top KPI cards SHALL compare both plans over the last 24 hours: wasted cuts (kg), fulfilled demand (%), rejected tonnage (unfulfilled + quality + capacity + rejected-plan tonnage) and gross profit.

### Requirement 6: Dynamic Pricing

**User Story:** As a commercial approver, I want prices to react to demand within a corridor, so that demand is shaped under human policy.

#### Acceptance Criteria

1. THE price multiplier SHALL stay within ±8%, or within ±15% while an approved `pricing` action is active.
2. THE price SHALL rise by 1.2 points per hour WHEN less than 97% of demand is served, OR a premium cut's demand exceeds 1.25× its time-of-day baseline, OR the ratio of demand to base demand exceeds 1.02.
3. THE price SHALL fall by 1.2 points per hour WHEN fresh stock covers more than 0.3 days OR the ratio of demand to base demand is below 0.82; otherwise THE price SHALL drift back toward list price.
4. Effective demand SHALL follow each cut's price elasticity (1.3 for standard cuts, 0.7 for premium); THE Classic_Plan SHALL keep list prices.
5. THE browser and backend Twins SHALL apply identical pricing rules.

### Requirement 7: Customer Orders

**User Story:** As a sales user, I want to add customer demand and see the plant respond, so that the twin behaves like a real operation.

#### Acceptance Criteria

1. THE UI SHALL allow entering customer, channel, cut, mass (50–20,000 kg) and due time (6, 12, 24 or 48 hours), and SHALL offer four presets.
2. WHERE "Otomatik müşteri talepleri" is enabled, THE Twin SHALL generate seeded orders (≈8.5% chance per hour, channel by share, cut by base demand).
3. An order SHALL add `mass ÷ due hours` kg/h to the cut's demand during its window, without price elasticity.
4. Fulfilment SHALL be tracked separately per plan; WHEN OptiSupply completes an order, THE Commercial agent SHALL announce delivery; WHEN the due time passes unfulfilled, THE UI SHALL mark the order late.
5. Orders SHALL be included in snapshots so that agents and the Assistant can see them, and SHALL be written to the Decision_Log.

### Requirement 8: Shocks and Projections

**User Story:** As a decision maker, I want shock responses projected before approval, so that options can be compared.

#### Acceptance Criteria

1. THE UI SHALL offer the four Shock buttons (also keys 1–4).
2. WHEN a shock starts, THE system SHALL run the Agent_Graph and show an approval card.
3. THE approval card SHALL show 24-hour profit, wasted cuts, fulfilment and rejected tonnage, with and without the plan.
4. THE projection shown in the browser and the projection computed by the backend Twin for the same snapshot SHALL be identical.

### Requirement 9: Agent Graph

**User Story:** As an AI reviewer, I want explicit agent roles and ordering, so that planning is explainable.

#### Acceptance Criteria

1. THE system SHALL define eight agents: Orchestratör (OR), Talep (TA), Karkas/Verim (VE), Ürün Karması (UK), Fiyat (FY), Tedarik (TE), Lojistik (LO), Ticari (TI).
2. THE Agent_Graph SHALL run signal agents first, then specialists in parallel, then the Orchestrator, using the shock-specific lineup defined in the design.
3. Specialists SHALL return structured output (message, conflict flag, suggested actions); THE Orchestrator SHALL return actions, rationale and a decision sentence.
4. THE Orchestrator SHALL select only allowed actions (the shock's actions minus remembered rejections) and SHALL evaluate at least two action sets with `plani_projekte_et`.
5. Agent messages, tool calls, the plan and a trace SHALL stream to the browser as server-sent events.
6. THE graph SHALL time out after 28 seconds; IF the browser receives no plan within 32 seconds, THEN THE browser SHALL fall back to the scripted negotiation.

### Requirement 10: Numeric Provenance

**User Story:** As a business reviewer, I want numbers to come from the Twin, so that the model cannot invent results.

#### Acceptance Criteria

1. Every number in agent and assistant answers SHALL come from Twin_Tools, the Knowledge_Base or the chart tool.
2. Chart data SHALL be computed by the backend Twin; THE model SHALL only choose the chart type.
3. THE system prompts SHALL forbid inventing numbers and require tool calls before answering.

### Requirement 11: Human Approval and Memory

**User Story:** As a manager, I want material changes gated by approval and my rejections remembered, so that the agent stays under human control.

#### Acceptance Criteria

1. THE approval card SHALL offer approve, reject with a reason, defer, and a phone preview.
2. WHEN an action is rejected, THE system SHALL store the reason in Memory, exclude the action and rebuild the plan.
3. AgentCore Memory SHALL store each rejection as an event and extract long-term records with a semantic strategy (namespace `/kisitlar/{actorId}`).
4. WHERE AgentCore Memory is not configured or fails, THE system SHALL use local memory.
5. Orders, proposals, approvals and rejections SHALL be written to the Decision_Log and shown under "Karar kaydı".

### Requirement 12: HACCP and Lots

**User Story:** As a quality user, I want critical limits enforced, so that unsafe product is held.

#### Acceptance Criteria

1. THE Kalite view SHALL show KKN-1 to KKN-7 with limit, live value and status.
2. WHEN a sensor exceeds its threshold for two consecutive hours, THE system SHALL raise an alarm and quarantine the affected lot.
3. Lots from a deviating hour SHALL be held; users SHALL be able to release or hold lots.

### Requirement 13: Assistant

**User Story:** As a user, I want to ask questions in Turkish and get grounded, streaming answers, so that I can explore the twin quickly.

#### Acceptance Criteria

1. THE chat SHALL open from a bottom "OptiSupply'a sor" bar into a dialog with a greeting, five quick-start cards, three live-summary cards and a "Yeni sohbet" action.
2. Answers SHALL stream token by token with tool-status lines; any text written before a tool call SHALL be discarded.
3. THE Assistant SHALL use Twin_Tools, the Knowledge_Base (`bilgi_bankasi`) and `grafik_goster` (eight chart types).
4. Charts SHALL appear after the first words: beside the text on wide screens and below it on narrow screens, with draw and grow animations.
5. Guardrails SHALL block prompt attacks and political topics and SHALL anonymize e-mail addresses, phone numbers and Turkish ID numbers, in asynchronous streaming mode.
6. IF streaming fails before any text arrives, THEN THE chat SHALL fall back to the non-streaming endpoint, and then to rule-based answers.

### Requirement 14: Voice Conversation

**User Story:** As a user, I want a two-way voice conversation, so that I can talk to the assistant hands-free.

#### Acceptance Criteria

1. WHEN the microphone button is pressed, THE UI SHALL start a continuous conversation until the button is pressed again.
2. THE UI SHALL detect the end of speech after one second of silence and send 16 kHz PCM audio to Amazon Transcribe (tr-TR, custom vocabulary).
3. Answers SHALL be spoken sentence by sentence with Amazon Polly (Burcu, neural) while the text is revealed in sync with word speech marks.
4. WHEN the user speaks while the assistant is speaking, THE assistant SHALL stop and listen (barge-in).
5. IF Transcribe returns no text, THEN THE next attempt SHALL use the browser's speech recognition.

### Requirement 15: AgentCore Runtime

**User Story:** As a platform engineer, I want agents hosted in AgentCore Runtime, so that they run isolated and observable.

#### Acceptance Criteria

1. THE Runtime SHALL expose `GET /ping` and `POST /invocations` on port 8080 through `BedrockAgentCoreApp`.
2. `/invocations` SHALL accept the actions `negotiate` and `ask_stream` (server-sent events) and `ask`, `explain` and `warm` (JSON).
3. THE API SHALL use a runtime session id of at least 33 characters per browser session and SHALL warm the session when the page opens.
4. IF the Runtime fails before sending any event, THEN THE API SHALL run the same agent code in-process.

### Requirement 16: Configuration and Fallbacks

**User Story:** As a developer, I want every managed service to be optional, so that the app runs locally and degrades safely.

#### Acceptance Criteria

1. Memory, Knowledge_Base, Guardrail, Decision_Log, Transcribe vocabulary, Runtime and model IDs SHALL be configured independently through environment variables (`backend/.env`, template `backend/.env.example`).
2. Each missing integration SHALL fall back locally without affecting the others.
3. IF the backend is unreachable, THEN THE UI SHALL keep working with the scripted agents and the rule-based assistant.

### Requirement 17: Observability and Audit

**User Story:** As a reviewer, I want agent steps traceable, so that decisions can be audited.

#### Acceptance Criteria

1. THE Runtime SHALL export Strands spans (graph, agent, model, tool) with AWS Distro for OpenTelemetry to CloudWatch Transaction Search (AgentCore Observability).
2. THE "Neden bu karar?" dialog SHALL show the triggering data, constraints, evaluated options, the agent trace (tools, duration, tokens) and a model commentary.

### Requirement 18: Turkish, Responsive and Accessible UI

**User Story:** As a user on any device, I want a clear Turkish interface, so that the demo works on desktop and mobile.

#### Acceptance Criteria

1. All text, dates and numbers SHALL be Turkish (`tr-TR`, decimal comma, "−" minus sign).
2. THE page SHALL declare `<!doctype html>` and a responsive viewport; at 390 px width no view SHALL overflow horizontally.
3. On desktop, the 3D scene and the agent column SHALL align with the four-column KPI grid; on mobile, the header SHALL compact to three rows and the tabs SHALL scroll horizontally.
4. THE demo ("Demoyu oynat") SHALL run 12 steps with camera close-ups; spoken narration SHALL be off by default and toggled from the stage bar, which SHALL sit above the chat bar.
5. THE views (Plan ve fiyat, Kalite, Kazanç, Yönetim ekranı, Soğuk zincir, Geçmiş, Veri raporu) SHALL use consistent period labels (son 24 saat, canlı ikiz başladığından beri, Son 7 gün, Önceki 7 gün, 30 gün) and consistent plan names.

### Requirement 19: Export and Reporting

**User Story:** As an analyst, I want data export and source reporting, so that results can be reviewed offline.

#### Acceptance Criteria

1. "Excel'e aktar" SHALL download an `.xlsx` workbook built with SheetJS.
2. THE Veri raporu view SHALL present the January–September 2026 source data (scaled ×2, as stated in the source).

### Requirement 20: Deployment and Operations

**User Story:** As a team, I want a repeatable AWS deployment, so that we have a working public link.

#### Acceptance Criteria

1. `infra/deploy.sh [all|backend|runtime|frontend]`, `infra/kb/setup_kb.sh` and `infra/guardrail.sh` SHALL create or update all resources idempotently and record resource IDs in `infra/.state.env`.
2. CloudFront SHALL serve S3 content and route `/api/*` to the Lambda Function URL (response streaming) with caching disabled; server-sent event responses SHALL send a heartbeat every 3 seconds.
3. THE Lambda resource policy SHALL allow invocation only through the Function URL.
4. Shock negotiation SHALL complete in 15–25 seconds; streaming chat SHALL show its first words in about 4 seconds.

## Out of Scope for This Phase

- Integration with real SAP, Rotamen, PınarOnline or sensor systems (actions are simulated).
- User authentication, role-based approval enforcement and rate limiting.
- Persistence of the live twin and orders across page reloads.
- A formal snapshot codec, a numeric-provenance guard component, property-based tests and a CI pipeline (unit tests for the backend twin exist in `backend/test/`).
- Speech-to-speech models (Amazon Nova 2 Sonic does not support Turkish).
