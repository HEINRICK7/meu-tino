# Contrato de integração do Meu TINO

## Fonte da decisão

O contrato foi extraído da arquitetura do Meu TINO em `backend-tino/meu-tino-pwa/ARQUITETURA-TECNOLOGIAS-SEGURANCA.md` e conferido contra os controllers existentes em `backend-tino` e os padrões de rede do app Android `tino`.

## Fronteira

O PWA usa uma sessão opaca por cookie (`credentials: include`). Ele nunca recebe ou guarda JWT de comerciante, `customerId`, `businessId`, saldo calculado localmente, credenciais da Evolution ou chave privada VAPID.

## Rotas consumidas

| Método | Rota                                  | Uso                                                              |
| ------ | ------------------------------------- | ---------------------------------------------------------------- |
| `POST` | `/api/v1/customer-channel/activation` | Consome convite de uso único e estabelece a sessão.              |
| `GET`  | `/api/v1/me`                          | Home autoritativa, com `account.balance.minor` e `account.asOf`. |
| `GET`  | `/api/v1/me/activity`                 | Extrato por cursor; `amount.minor` é sempre positivo.            |
| `GET`  | `/api/v1/me/activity/{id}`            | Deep link de notificação.                                        |
| `POST` | `/api/v1/me/payment-intents`          | Cria ou repete um intento Pix com valor e QR dinâmicos.          |
| `POST` | `/api/v1/me/logout`                   | Revoga a sessão no backend.                                      |
| `GET`  | `/api/v1/me/push-config`              | Obtém somente a chave pública VAPID.                             |
| `POST` | `/api/v1/me/push-subscriptions`       | Registra uma subscription no canal da sessão.                    |

As requisições usam `Accept: application/json`, `credentials: include` e `Cache-Control: no-store` nas leituras financeiras. Os endpoints de ativação, convite e PaymentIntent usam `Idempotency-Key`.

## Criação de pagamento Pix

O PWA envia somente o valor em centavos. O backend confirma o saldo atual, gera um `txid` opaco e devolve o payload Pix com valor embutido:

```http
POST /api/v1/me/payment-intents
Idempotency-Key: <chave-estável-da-tentativa>
Content-Type: application/json

{"amount_minor": 49750}
```

Resposta nova (`201`) ou repetida (`200`):

```json
{
  "paymentIntent": {
    "id": "uuid",
    "customerId": "uuid",
    "amountMinor": 49750,
    "currency": "BRL",
    "pixTxid": "TINO...",
    "pixKey": "chave-pix",
    "copyPaste": "000201...",
    "status": "PENDING",
    "createdAt": "2026-09-10T10:30:00Z",
    "expiresAt": "2026-09-10T11:00:00Z",
    "updatedAt": "2026-09-10T10:30:00Z"
  },
  "replayed": false
}
```

O PWA não altera saldo nem extrato localmente e nunca considera a geração do QR como pagamento confirmado. O mesmo `Idempotency-Key` com outro valor é conflito; valor acima do saldo atual retorna `409`; Pix indisponível retorna `503`. A baixa só ocorrerá após evidência e confirmação no fluxo do comerciante.

## Resposta esperada de `/me`

```json
{
  "channel": { "status": "ACTIVE" },
  "customer": { "displayName": "Gerlane de Araújo" },
  "business": { "displayName": "Mercadinho João" },
  "account": {
    "status": "OPEN",
    "balance": { "minor": 49750, "currency": "BRL" },
    "version": 42,
    "asOf": "2026-09-10T10:30:00Z"
  },
  "features": { "push": true, "pix": true, "agreements": false },
  "push": { "activeSubscriptions": 0 }
}
```

## Estado atual verificado

O backend já possui o primeiro slice executável de `customer-channel`: migration V29, convite autenticado do comerciante, entrega via `WhatsAppDeliveryPort`, ativação de uso único, sessão opaca por cookie, leitura tenant-scoped de `/me`, atividade por cursor e logout. O PWA consome exatamente essa fachada; não há saldo ou extrato de fallback.

O primeiro slice Pix agora está executável: o PWA cria um PaymentIntent e recebe um BR Code dinâmico com valor e `txid`. O que permanece é a captura de evidência no Android, matching seguro, confirmação explícita do comerciante e atualização/notificação do cliente após a baixa. Em produção, `TINO_CUSTOMER_CHANNEL_SESSION_SECURE` deve ser `true` e a API deve ser servida sob HTTPS.
