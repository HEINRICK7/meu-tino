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
| `POST` | `/api/v1/me/logout`                   | Revoga a sessão no backend.                                      |
| `GET`  | `/api/v1/me/push-config`              | Obtém somente a chave pública VAPID.                             |
| `POST` | `/api/v1/me/push-subscriptions`       | Registra uma subscription no canal da sessão.                    |

As requisições usam `Accept: application/json`, `credentials: include` e `Idempotency-Key` nos endpoints de ativação e subscription.

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
  "features": { "push": true, "pix": false, "agreements": false },
  "push": { "activeSubscriptions": 0 }
}
```

## Estado atual verificado

O backend já possui o primeiro slice executável de `customer-channel`: migration V29, convite autenticado do comerciante, entrega via `WhatsAppDeliveryPort`, ativação de uso único, sessão opaca por cookie, leitura tenant-scoped de `/me`, atividade por cursor e logout. O PWA consome exatamente essa fachada; não há saldo ou extrato de fallback.

O que permanece como próximo slice é push (configuração, registro e revogação), recuperação do cliente e endurecimento operacional de CSRF/rate limit/idempotência de ativação. Em produção, `TINO_CUSTOMER_CHANNEL_SESSION_SECURE` deve ser `true` e a API deve ser servida sob HTTPS.
