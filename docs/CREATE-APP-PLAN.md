# Plano de entrega — Meu TINO

Este tracker adapta o fluxo de criação ao estado real do produto: a visão e o contrato do MVP já existem no handoff do backend; este repositório começa pela primeira fatia web executável.

| Fase                        | Status  | Resultado                                                                                                                                            |
| --------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Produto e MVP            | done    | MVP 1 limitado a ativação, sessão, consulta de saldo, extrato e push opcional.                                                                       |
| 2. Fluxo principal          | done    | Convite → ativação → Home → extrato, com estados de loading, erro, vazio e sessão indisponível.                                                      |
| 3. Fronteiras               | done    | PWA só apresenta; backend autoriza e é fonte financeira; service worker guarda apenas shell.                                                         |
| 4. Contrato de domínio      | done    | `MeResponse`, `ActivityItem` e sessão por cookie documentados em `docs/INTEGRATION-CONTRACT.md`.                                                     |
| 5. Primeira implementação   | done    | React/Vite/TypeScript, manifest, service worker, API client e UI responsiva.                                                                         |
| 6. Backend customer-channel | done    | V29, convite, ativação one-time, sessão opaca, `/me`, extrato e logout implementados no `backend-tino`; testes PostgreSQL/Modulith focados passaram. |
| 7. E2E real                 | pending | Requer ambiente publicado, convite real pelo provedor, HTTPS e ambiente controlado de Web Push.                                                      |

## Decisões herdadas

- domínio financeiro não é duplicado no browser;
- nenhum dado financeiro é cacheado pelo service worker;
- sessão não fica em `localStorage`, `sessionStorage` ou IndexedDB;
- Pix, ações financeiras e modo offline ficam fora do MVP 1;
- a mesma origem `/api` é o default de produção.

## Próximo incremento

Publicar o backend e executar o fluxo real convite → ativação → `/me` → `/activity`. Depois, adicionar push (configuração, registro e revogação), recuperação e endurecimento de CSRF/rate limit/idempotência para produção.
