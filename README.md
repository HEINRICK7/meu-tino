# Meu TINO

PWA do canal do cliente TINO. Este repositório contém a experiência web; a autorização, o saldo, o extrato e as notificações continuam sendo responsabilidades do TINO Backend.

## Rodar localmente

```bash
npm install
npm run dev
```

O frontend assume a API no mesmo domínio, em `/api`. Para apontar para outro ambiente, copie `.env.example` para `.env.local` e configure `VITE_API_BASE_URL`.

```bash
VITE_API_BASE_URL=https://api.example.com/api npm run dev
```

## Verificação

```bash
npm run typecheck
npm test
npm run build
```

## Contrato do backend

O PWA usa a fachada segura do cliente definida em `docs/INTEGRATION-CONTRACT.md`:

- `POST /api/v1/customer-channel/activation` — ativa convite e estabelece cookie HttpOnly;
- `GET /api/v1/me` — retorna identidade, comerciante e saldo em minor units;
- `GET /api/v1/me/activity` — retorna extrato paginado;
- `GET/POST /api/v1/me/push-config` e `/push-subscriptions` — notificações;
- `POST /api/v1/me/logout` — revoga a sessão.

O backend `../backend-tino` já publica o slice `customer-channel` usado pelo PWA: convite do comerciante, ativação de uso único, sessão opaca por cookie, `/me`, extrato e logout. O PWA não chama endpoints administrativos do comerciante nem inventa dados para encobrir indisponibilidade.

Para desenvolvimento local, configure `TINO_CUSTOMER_CHANNEL_PUBLIC_BASE_URL=http://localhost:5173` e mantenha `TINO_CUSTOMER_CHANNEL_SESSION_SECURE=false`. Em HTTPS, ative `TINO_CUSTOMER_CHANNEL_SESSION_SECURE=true`.

Push ainda está explicitamente desabilitado no backend deste slice (`features.push=false`); os endpoints de push permanecem como próximo incremento do contrato.
