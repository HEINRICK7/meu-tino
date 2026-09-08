# Meu TINO PWA — Arquitetura, Tecnologias e Segurança

**Produto:** TINO

**Canal:** Meu TINO — PWA do cliente

**Escopo deste documento:** MVP 1

**Status:** handoff para implementação por outro agente
**Última decisão registrada:** não usar Konsta UI nem outro kit visual pronto; a interface terá identidade própria do TINO.

> Este documento não substitui a visão completa do produto. Ele fatia a primeira entrega sem descartar o que foi definido para as próximas versões.

## 1. Decisão principal

O Meu TINO será um novo frontend web instalável como PWA. Não será um aplicativo nativo de loja, não será um novo backend e não será uma coleção de páginas renderizadas diretamente pelo Spring Boot.

O frontend será compilado como arquivos estáticos e servido pelo mesmo domínio público do canal. O backend atual continuará sendo a fonte autoritativa para identidade, autorização, clientes, caderneta, ledger, eventos e integrações.

```text
WhatsApp / Evolution
          |
          v
Meu TINO PWA
          |
          v
TINO Backend — API REST
          |
          +--> customer / customer-channel
          +--> identity / sessões
          +--> credit / ledger / saldo
          +--> payment / eventos de pagamento
          +--> messaging / notificações
          +--> PostgreSQL
```

### 1.1 O que cada parte faz

| Parte             | Responsabilidade                                                                    | Não deve fazer                                                                  |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Meu TINO PWA      | Telas, navegação, apresentação, instalação, service worker e assinatura de push     | Calcular saldo, decidir autorização, falar com Evolution ou guardar credenciais |
| TINO Backend      | Casos de uso, sessão, autorização, dados financeiros, convites, eventos e políticas | Delegar segurança ao browser                                                    |
| Serviço Go        | Entrega de WhatsApp pela Evolution para convite e recuperação                       | Criar convite, calcular saldo, escolher cliente ou alterar ledger               |
| PostgreSQL        | Fonte persistente dos dados e outbox de eventos                                     | Ser acessado diretamente pelo PWA                                               |
| Web Push provider | Entregar notificações                                                               | Ser fonte de verdade financeira                                                 |

## 2. MVP 1

### 2.1 Objetivo do MVP

Validar a hipótese de que o cliente recebe um convite, ativa seu canal próprio e passa a acompanhar a caderneta sem depender de uma conversa contínua no WhatsApp.

### 2.2 Incluído

#### Cliente

- receber convite pelo WhatsApp;
- abrir link seguro de ativação;
- ativar o Meu TINO sem criar senha convencional;
- manter sessão segura no aparelho;
- recuperar acesso pelo WhatsApp;
- visualizar comerciante e nome do cliente;
- visualizar saldo autoritativo;
- visualizar últimas movimentações;
- abrir o extrato;
- receber push de nova compra e pagamento confirmado;
- tocar na notificação e abrir a atividade correta;
- receber orientação para instalar na tela inicial;
- usar a PWA mesmo se recusar notificações;
- ver estados de loading, erro, vazio, link expirado e sem conexão.

#### Comerciante

- iniciar convite a partir de um cliente já cadastrado;
- reenviar convite com rate limit;
- visualizar o estado do canal: `INVITED`, `ACTIVE`, `SUSPENDED` ou `REVOKED`;
- visualizar se existem subscriptions de push ativas.

#### Plataforma

- criar e invalidar convites de uso único;
- criar e revogar sessões;
- persistir subscriptions de push;
- publicar notificações a partir de fatos reais do domínio;
- manter rastreabilidade de convite, ativação e entrega;
- garantir isolamento entre comerciante e cliente;
- operar com valores em minor units e datas canônicas;
- ter testes unitários, de integração, segurança e E2E do fluxo principal.

### 2.3 Fora do MVP 1, mas mantido no roadmap

Nada abaixo foi descartado; apenas não bloqueia a primeira validação do canal:

- geração, pagamento e conciliação de Pix;
- acordos detalhados e ações sobre acordos;
- snapshot financeiro offline;
- fallback automático de eventos operacionais para WhatsApp;
- seleção visual de múltiplos estabelecimentos;
- histórico completo de comunicações;
- customização visual por comerciante;
- editor de templates;
- catálogo, pedidos, cashback, pontos, score, gamificação e marketplace;
- chat, mensagens livres ou IA conversando com o cliente;
- login por senha ou login social;
- SMS e e-mail.

### 2.4 Regra de corte

O MVP pode ser entregue com o cliente apenas consultando a caderneta. Nenhuma ação financeira mutável será adicionada para “completar” a experiência antes de as regras de Pix e conciliação estarem definidas.

## 3. Arquitetura do frontend

### 3.1 Stack decidida

- **React** para composição da interface;
- **TypeScript** com `strict` habilitado;
- **Vite** para desenvolvimento e build estático;
- **React Router** para rotas do PWA;
- **TanStack Query** para server state, cache controlado e invalidação;
- **CSS Modules + CSS variables** para estilos e tokens do TINO;
- **Web App Manifest** para instalação;
- **Service Worker próprio usando Workbox**, preferencialmente integrado ao Vite;
- **Push API, Notifications API e Service Worker API** para notificações;
- **Vitest** para testes unitários;
- **React Testing Library** para componentes;
- **Playwright** para E2E;
- **axe-core** ou equivalente para verificações de acessibilidade;
- **ESLint, Prettier e TypeScript** como gates de qualidade;
- **Node.js LTS + npm**, com lockfile versionado.

### 3.2 O que não usar no frontend

- Konsta UI;
- Ionic, Framework7 ou outro app shell mobile no MVP;
- biblioteca visual genérica que imponha aparência ao produto;
- Redux apenas por padrão;
- JWT sensível em `localStorage`, `sessionStorage` ou IndexedDB;
- lógica financeira no componente, store ou service worker;
- acesso direto ao banco, ao serviço Go ou à Evolution;
- `any` nos contratos da API;
- cache indiscriminado de respostas financeiras.

### 3.3 Design system próprio do TINO

O visual deve ser construído para o TINO, usando a referência aprovada do Meu TINO e não a aparência de um framework.

Tokens mínimos:

- `color-primary`: verde principal TINO;
- `color-debt`: laranja para compra fiada e atenção;
- `color-payment`: verde para pagamento confirmado;
- `color-agreement`: azul para acordos e informação;
- `color-overdue`: vermelho usado com parcimônia para vencimentos;
- superfícies, bordas, textos primário/secundário e estados de foco;
- escala de espaçamento;
- raios de borda;
- sombras;
- tamanhos e pesos tipográficos;
- áreas mínimas de toque;
- breakpoints mobile-first.

Os valores devem ficar centralizados em tokens. Hex codes não devem ser espalhados pelos componentes.

Componentes de negócio previstos:

- `TinoAppShell`;
- `TinoHeader`;
- `BusinessIdentity`;
- `BalanceCard`;
- `QuickActions`;
- `ActivityList`;
- `ActivityItem`;
- `DebtActivityItem`;
- `PaymentActivityItem`;
- `InstallPwaCard`;
- `PushPermissionCard`;
- `OfflineBanner`;
- `EmptyState`;
- `BottomNavigation`.

Os componentes devem usar elementos HTML semânticos e acessíveis. Uma biblioteca pode ser usada futuramente apenas como primitiva sem estilo, mediante decisão explícita; a aparência e a API dos componentes continuam sendo do TINO.

### 3.4 Estrutura sugerida do frontend

```text
meu-tino-pwa/
  src/
    app/
      router/
      providers/
    design-system/
      tokens.css
      components/
    features/
      activation/
      home/
      activity/
      push/
      session/
      pwa-install/
    shared/
      api/
      formatting/
      types/
      accessibility/
    service-worker/
    main.tsx
  public/
    manifest.webmanifest
    icons/
  tests/
```

A estrutura é orientação. Não criar camadas artificiais ou arquivos pass-through sem responsabilidade real.

## 4. Arquitetura do backend

### 4.1 Forma de implantação

Manter o backend como monólito modular Java + Spring Boot, com limites internos claros. Não criar microserviço para o Meu TINO no MVP.

Módulos existentes continuam sendo donos das suas regras. O novo comportamento deve ser adicionado em um módulo `customer-channel` ou equivalente, sem misturar regra de cliente final com o adaptador de WhatsApp.

### 4.2 Limites sugeridos

```text
customer-channel
  - CustomerChannel
  - CustomerInvite
  - CustomerSession
  - PushSubscription
  - CustomerCommunicationEvent
  - casos de uso do canal do cliente

customer / credit / payment
  - dados e fatos de negócio já existentes
  - saldo, ledger, compras e pagamentos

identity
  - autenticação e sessão
  - OTP ou recuperação pelo canal autorizado

messaging
  - intenção de notificar
  - templates determinísticos
  - política de canais

adapters
  - Web Push
  - WhatsAppBootstrapPort
  - Evolution/Go
  - persistência e HTTP
```

### 4.3 Regra de dependência

O domínio e os casos de uso não podem conhecer:

- React ou PWA;
- navegador ou Service Worker;
- WhatsApp ou Evolution;
- Baileys;
- Web Push ou VAPID;
- biblioteca concreta de persistência;
- DTO HTTP externo.

O domínio deve expressar fatos e intenções, por exemplo:

```text
CustomerChannelActivated
DebtCreated
PaymentConfirmed
NotifyCustomer
InviteCustomer
```

Os adapters implementam ports definidos pelo núcleo da aplicação.

Ports importantes:

```java
CustomerNotificationPort
WhatsAppBootstrapPort
WebPushPort
CustomerChannelRepository
CustomerInviteRepository
CustomerSessionRepository
PushSubscriptionRepository
```

### 4.4 Fluxo de convite

```text
Android do comerciante
  -> caso de uso de convite
  -> cria CustomerInvite
  -> guarda somente tokenHash
  -> monta URL curta e segura
  -> WhatsAppBootstrapPort
  -> Serviço Go
  -> Evolution API
  -> WhatsApp do cliente
```

O Serviço Go apenas entrega e retorna o identificador/status do provider. Ele não decide se um cliente deve ser convidado nem constrói o token.

### 4.5 Fluxo de ativação

```text
Cliente abre /i/{token}
  -> PWA envia token ao endpoint de ativação
  -> backend calcula hash e valida convite
  -> valida cliente, comerciante e vínculo
  -> cria ou ativa CustomerChannel
  -> cria sessão segura
  -> consome convite
  -> redireciona para /
```

Depois da ativação, o token deve ser removido da URL e não deve permanecer no histórico, analytics ou logs de acesso.

### 4.6 Fluxo de notificação

```text
Fato de domínio
  -> transação do domínio confirma a mudança
  -> evento/outbox persistido
  -> CustomerNotificationService
  -> resolve CustomerChannel e subscriptions ativas
  -> cria template versionado
  -> WebPushPort
  -> browser recebe notificação
  -> click abre rota
  -> PWA busca dados atuais no backend
```

Push é best effort. A notificação nunca é a fonte de verdade e não deve carregar o objeto financeiro inteiro.

## 5. Modelo de dados mínimo

Os nomes abaixo são conceituais e devem ser adaptados ao padrão de IDs, auditoria e migrations já usado pelo backend.

### 5.1 CustomerChannel

```text
id
customerId
businessId
status: INVITED | ACTIVE | SUSPENDED | REVOKED
activatedAt
lastAccessAt
createdAt
updatedAt
```

Regra inicial: um vínculo por combinação `customerId + businessId`. O modelo deve permitir que o mesmo cliente tenha canais em vários estabelecimentos, sem exigir uma interface multiestabelecimento no MVP.

### 5.2 CustomerInvite

```text
id
customerChannelId
tokenHash
expiresAt
consumedAt
revokedAt
createdAt
```

Índices necessários: `tokenHash`, `customerChannelId`, validade e estado. O token puro nunca é persistido.

### 5.3 CustomerSession

```text
id
sessionTokenHash
customerChannelId
createdAt
lastSeenAt
expiresAt
revokedAt
```

A sessão deve ser opaca para o cliente. O cookie contém o identificador/segredo necessário para localizar a sessão, nunca dados financeiros ou autorização codificada de forma confiável apenas pelo browser.

### 5.4 CustomerPushSubscription

```text
id
customerChannelId
endpoint
p256dh
auth
userAgent
createdAt
lastSuccessAt
lastFailureAt
revokedAt
```

Uma cliente pode possuir várias subscriptions. Endpoint, user-agent e identificadores de dispositivo são dados operacionais sensíveis e não devem entrar em analytics.

### 5.5 Comunicação

Usar uma representação de evento e entrega suficiente para auditoria:

```text
CustomerCommunicationEvent
  id
  customerChannelId
  type
  createdAt

CommunicationDelivery
  id
  eventId
  channel: WHATSAPP | WEB_PUSH
  status: QUEUED | SENT | FAILED | EXPIRED_SUBSCRIPTION
  providerMessageId
  sentAt
  deliveredAt
  failureCode
  attemptCount
```

Não guardar o conteúdo completo indefinidamente. Se o conteúdo for necessário para suporte, aplicar retenção e mascaramento definidos pela política de privacidade.

## 6. API do PWA

Todas as rotas autenticadas devem derivar o contexto da sessão:

```text
session
  -> customerChannel
  -> customer + business autorizados
```

O browser não pode escolher livremente `customerId` ou `businessId` para determinar o que será exibido.

### 6.1 Rotas conceituais

```text
POST /api/v1/customers/{customerId}/customer-channel/invite
POST /api/v1/customers/{customerId}/customer-channel/reinvite
POST /api/v1/customer-channel/activation
POST /api/v1/customer-channel/recovery

GET  /api/v1/me
GET  /api/v1/me/activity
GET  /api/v1/me/agreements        # roadmap; somente leitura
POST /api/v1/me/push-subscriptions
DELETE /api/v1/me/push-subscriptions/{subscriptionId}
POST /api/v1/me/logout
```

As rotas de convite são destinadas ao comerciante autenticado. As rotas `/me` são destinadas à sessão do cliente.

### 6.2 Home

Resposta mínima esperada:

```json
{
  "customer": {
    "displayName": "Gerlane de Araújo"
  },
  "business": {
    "displayName": "Mercadinho João"
  },
  "account": {
    "status": "OPEN",
    "openBalanceMinor": 49750,
    "currency": "BRL",
    "asOf": "2026-09-10T10:30:00Z"
  },
  "actions": {
    "pixAvailable": false,
    "agreementsAvailable": false
  }
}
```

O campo `asOf` ou equivalente é importante para que o cliente saiba quando a informação foi consolidada.

### 6.3 Atividade

```json
{
  "items": [
    {
      "id": "evt_1",
      "type": "PAYMENT_CONFIRMED",
      "occurredAt": "2026-09-10T10:30:00Z",
      "amountMinor": 19600,
      "currency": "BRL"
    }
  ],
  "nextCursor": null
}
```

O frontend interpreta o significado pelo `type`. Não usar valores negativos como fonte de verdade; a semântica visual de compra e pagamento vem do tipo do evento.

Listas devem ser paginadas por cursor antes de serem expostas para clientes com histórico grande.

## 7. Segurança

### 7.1 Minimização de dados

No perfil do cliente do MVP, armazenar e exibir apenas o necessário:

- nome de exibição;
- telefone para comunicação e recuperação;
- vínculo com comerciante;
- dados da caderneta autorizados pelo backend.

Isso não elimina a responsabilidade sobre outros dados pessoais operacionais, como IP, logs, endpoint de push, user-agent, IDs de sessão e IDs de transação. Todos devem ter finalidade, acesso e retenção definidos.

Não armazenar no TINO:

- senha do cliente;
- cartão;
- credenciais bancárias;
- chave privada VAPID no frontend;
- API key da Evolution no frontend;
- token de provider no browser;
- token puro de convite no banco.

### 7.2 Convite

O token de convite deve:

- ser criptograficamente aleatório, com entropia suficiente;
- não conter `customerId`, telefone, saldo ou nome;
- ter expiração curta e configurável, inicialmente sugerida em 15 minutos;
- ser de uso único;
- ser revogável por reenvio ou ação administrativa;
- ser comparado por hash no backend;
- ser removido da URL após o primeiro uso;
- ser omitido de logs, métricas, analytics e referers.

O endpoint deve responder de forma que não revele detalhes desnecessários sobre clientes, convites existentes ou motivos internos de falha.

### 7.3 Sessão

Preferir sessão de servidor por cookie:

```text
HttpOnly
Secure
SameSite=Lax
Path=/
expiração controlada
rotação após ativação
revogação no backend
```

Não usar access token sensível em `localStorage`, `sessionStorage` ou IndexedDB. O logout deve revogar a sessão no servidor e limpar o cookie.

Como a PWA e a API devem compartilhar o mesmo domínio público no MVP, não haverá necessidade de CORS aberto. Se no futuro forem separados, a origem permitida deverá ser uma allowlist explícita e a política de cookies/CSRF deverá ser reavaliada.

### 7.4 Autorização e IDOR

Cada requisição autenticada deve resolver:

```text
sessão -> CustomerChannel -> customer/business
```

Testes obrigatórios:

- cliente A tenta acessar a atividade de B;
- cliente de um comerciante tenta acessar dados de outro;
- sessão revogada tenta consultar `/me`;
- sessão expirada tenta registrar subscription;
- usuário sem permissão tenta enviar convite;
- convite de um estabelecimento é usado em outro contexto.

O resultado deve ser `404` ou `403` conforme a política de não enumeração, nunca dados cruzados.

### 7.5 CSRF e headers

Para cookies de sessão:

- proteger endpoints mutáveis com token CSRF quando aplicável;
- validar `Origin` e, quando necessário, `Referer`;
- limitar métodos e `Content-Type` esperados;
- usar `SameSite` como camada adicional, nunca como única defesa.

Configurar no domínio:

```text
Content-Security-Policy
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy
Strict-Transport-Security
```

A CSP deve permitir somente os próprios assets, API e serviços explicitamente necessários.

### 7.6 Push

- chaves VAPID privadas somente no backend;
- payload mínimo, sem objeto financeiro inteiro;
- não expor saldo em push por padrão em aparelho compartilhado;
- ao receber `410 Gone`, revogar a subscription;
- diferenciar falha transitória de subscription inválida;
- não registrar endpoint completo em analytics;
- ao clicar, abrir a rota e buscar o estado atual do backend;
- nunca tratar a entrega do push como confirmação de pagamento.

Se o cliente negar push, a PWA continua funcionando normalmente.

### 7.7 Dados financeiros

- saldo e histórico vêm resolvidos pelo backend/ledger;
- frontend nunca calcula `compras - pagamentos`;
- dinheiro é transportado como `amountMinor` + `currency`;
- backend não aceita do browser dados que definam autorização ou valor final;
- home e atividade devem indicar o momento de consolidação;
- eventos duplicados não podem produzir notificações duplicadas sem idempotência;
- nenhuma ação financeira mutável funciona offline no MVP.

### 7.8 Rate limiting e abuso

Aplicar rate limit e auditoria em:

- convite;
- reenvio;
- recuperação;
- ativação;
- registro e atualização de push subscription;
- tentativas de sessão inválida.

Começar com limites configuráveis, por exemplo, três convites por canal em uma janela definida, e ajustar com métricas. O backend deve evitar revelar se um telefone está cadastrado.

### 7.9 Logs, LGPD e segredos

Logs estruturados podem usar:

```text
businessId
customerChannelId
eventType
deliveryChannel
status
correlationId
```

Não registrar:

- token de convite;
- cookie ou sessão;
- telefone completo;
- endpoint push completo;
- payload financeiro desnecessário;
- API keys ou secrets.

Segredos ficam no mecanismo de secrets do ambiente. Rotação e revogação devem ser possíveis sem alteração de código.

## 8. Cache, offline e PWA

### 8.1 MVP 1

Cachear somente:

- shell da aplicação;
- JavaScript, CSS, ícones e assets versionados;
- fallback de conectividade sem dados financeiros.

Não cachear saldo ou extrato no primeiro MVP. O snapshot financeiro offline permanece no roadmap porque exige decisão adicional de privacidade para aparelho compartilhado.

### 8.2 Service worker

Responsabilidades:

- precache do shell;
- versionamento e limpeza de caches antigos;
- fallback de navegação;
- recebimento de push;
- `notificationclick`;
- foco de aba existente ou abertura controlada.

O service worker não contém:

- regra financeira;
- autorização;
- token de provider;
- cálculo de saldo;
- decisão de pagamento.

### 8.3 Rotas de notificação

Exemplos:

```text
/activity/{id}
/account
/agreements/{id}
```

Ao clicar, a PWA deve procurar uma aba aberta, focá-la e navegar. Só abrir nova janela quando necessário.

## 9. Confiabilidade e consistência

### 9.1 Fonte de verdade

O ledger e os casos de uso do backend são a fonte autoritativa. O PWA é uma projeção de leitura e não pode alterar o ledger.

### 9.2 Outbox e idempotência

Eventos de notificação devem ser persistidos de maneira transacional com o fato que os originou, preferencialmente por uma outbox no PostgreSQL no MVP.

Cada processamento deve ter:

- identificador idempotente;
- tentativas limitadas;
- retry apenas para falhas transitórias;
- backoff com jitter;
- estado final observável;
- possibilidade de reprocessamento seguro.

### 9.3 Falhas esperadas

| Falha                            | Comportamento                                                        |
| -------------------------------- | -------------------------------------------------------------------- |
| WhatsApp/Evolution indisponível  | Convite fica falho/pendente e pode ser reenviado com rate limit      |
| Web Push indisponível            | Registrar falha; PWA continua consultável                            |
| Subscription inválida            | Revogar e não insistir indefinidamente                               |
| Backend sem conexão              | Mostrar erro ou shell; não inventar dados                            |
| Cliente offline                  | Mostrar shell e aviso; nenhuma ação financeira mutável               |
| Evento duplicado                 | Deduplicar por chave idempotente                                     |
| Dados financeiros desatualizados | Exibir `asOf`/estado de atualização e buscar novamente ao reconectar |

Toda chamada externa deve ter timeout. O fluxo de notificação não pode bloquear a confirmação do fato financeiro.

## 10. Hospedagem e deploy

### 10.1 Topologia recomendada

```text
https://meu.tino.app/
  /                -> arquivos estáticos do PWA
  /i/{token}       -> shell de ativação
  /api/v1/...      -> proxy para TINO Backend
```

O Nginx pode servir os assets estáticos e encaminhar `/api` para o backend. A mesma origem simplifica cookies, CSRF e instalação do service worker.

### 10.2 Requisitos de produção

- HTTPS obrigatório;
- fallback de rota SPA configurado;
- escopo do service worker limitado ao Meu TINO;
- assets com hash e cache longo;
- HTML e manifest com estratégia de atualização segura;
- rollback da versão do frontend;
- não apagar caches novos antes de garantir compatibilidade;
- API e frontend versionados de forma compatível;
- health/readiness do backend e smoke de abertura do PWA;
- secrets fora do repositório.

Atualizações do service worker devem ser tratadas com cuidado para não deixar clientes presos em uma versão incompatível com a API.

## 11. Testes

### 11.1 Frontend

- formatação de `amountMinor` para PT-BR;
- formatação de datas e timezone;
- mapeamento de tipos de atividade;
- estados da home;
- estados de sessão;
- ativação de PWA;
- permissão concedida, negada e indisponível;
- subscription nova, repetida e revogada;
- offline shell;
- `notificationclick`;
- componentes de saldo, atividade, instalação, push e erros;
- acessibilidade, foco e navegação por teclado.

### 11.2 Backend

- token aleatório e hash;
- expiração, revogação e uso único;
- sessão criada e revogada;
- recuperação sem enumeração de telefone;
- rate limit;
- autorização por `CustomerChannel`;
- IDOR;
- CSRF;
- múltiplas subscriptions;
- remoção após `410 Gone`;
- idempotência de eventos;
- outbox e reprocessamento;
- template determinístico;
- falha e retry de provider.

### 11.3 E2E obrigatório do MVP 1

```text
1. Cliente existe no comerciante.
2. Comerciante envia convite.
3. Backend cria convite e registra envio.
4. Go/Evolution entrega o link.
5. Cliente abre o link.
6. Backend valida e consome o convite.
7. Sessão é criada.
8. Home mostra saldo correto.
9. Cliente ativa push.
10. Subscription é persistida.
11. Comerciante registra nova compra.
12. Ledger é atualizado.
13. Evento de notificação é publicado.
14. Push chega ao cliente.
15. Click abre a atividade correta.
16. PWA busca e mostra o saldo atualizado.
```

O E2E deve usar cliente, comerciante, número de WhatsApp e ambiente controlados. Não enviar mensagens de teste para clientes reais sem destinatário explicitamente aprovado.

## 12. Observabilidade

### 12.1 Eventos de produto

```text
customer_invite_sent
customer_channel_activated
customer_recovery_requested
pwa_install_prompt_shown
pwa_installed
push_explainer_shown
push_permission_granted
push_permission_denied
push_delivery_success
push_delivery_failed
statement_viewed
```

Não enviar tokens, telefone completo, endpoint push ou conteúdo financeiro desnecessário para analytics.

### 12.2 Métricas backend

```text
customer_channel_invites_total
customer_channel_activations_total
customer_channel_recovery_total
web_push_send_total
web_push_failure_total
web_push_expired_subscription_total
customer_channel_active_total
notification_outbox_pending_total
notification_outbox_retry_total
```

Logs e métricas devem permitir responder:

- convite foi criado?
- foi entregue ao WhatsApp?
- foi aberto/ativado?
- push foi aceito pelo provider?
- subscription expirou?
- o cliente consultou a versão atual do saldo?

## 13. Critérios de aceite do MVP 1

- [ ] PWA abre em smartphone pequeno, tablet e desktop.
- [ ] Link de convite não expõe identificadores pessoais.
- [ ] Convite expira, pode ser revogado e só é usado uma vez.
- [ ] Sessão usa cookie seguro e não depende de token em storage do browser.
- [ ] Cliente só acessa o próprio `CustomerChannel`.
- [ ] Home mostra saldo vindo do backend.
- [ ] Extrato mostra compras e pagamentos com semântica visual diferente.
- [ ] Frontend não calcula saldo.
- [ ] Frontend não acessa Evolution nem banco.
- [ ] PWA possui manifest e service worker versionado.
- [ ] Instalação tem UX própria para Android e orientação para iPhone.
- [ ] Push é pedido somente após explicação e ação do usuário.
- [ ] Subscription é persistida e removida quando inválida.
- [ ] Nova compra gera push quando o cliente tem push ativo.
- [ ] Pagamento confirmado gera push quando o cliente tem push ativo.
- [ ] Click do push abre rota relevante e recarrega dados atuais.
- [ ] Recusa de push não bloqueia o uso.
- [ ] Offline mostra apenas shell/estado de conectividade no MVP.
- [ ] IDOR, sessão expirada, CSRF e rate limit têm cobertura.
- [ ] Outbox/retry/idempotência estão observáveis.
- [ ] E2E convite → ativação → push passa em ambiente controlado.
- [ ] Nenhuma funcionalidade de chat foi introduzida.

## 14. Decisões ainda necessárias antes do primeiro código

Estas são as poucas decisões que o agente implementador deve confirmar antes de começar:

1. domínio final e localização pública do PWA;
2. se o frontend ficará em um repositório separado ou nesta pasta do backend;
3. tempo exato de expiração da sessão e do convite;
4. política de detalhes em notificações para aparelhos compartilhados;
5. ambiente controlado para o E2E real de WhatsApp e Web Push;
6. contrato definitivo de `GET /api/v1/me` e `GET /api/v1/me/activity`;
7. formato da outbox conforme o padrão de transações já existente;
8. browser matrix mínima para Android e iPhone;
9. política de retenção de logs, subscriptions e comunicações;
10. confirmação de que Pix permanecerá fora do MVP 1.

## 15. Ordem de implementação

1. criar o shell React/TypeScript/Vite e os tokens visuais TINO;
2. configurar manifest, service worker e deploy estático;
3. implementar ativação segura e sessão;
4. implementar `CustomerChannel` e convite/reenvio no backend;
5. integrar convite pelo WhatsApp através do port existente;
6. implementar Home e Activity com contratos de leitura;
7. implementar subscription e Web Push;
8. conectar eventos de compra e pagamento confirmado à outbox;
9. implementar recuperação, estados de erro e observabilidade;
10. executar testes de segurança e E2E controlado;
11. publicar com feature flag e confirmar readiness, fluxo e rollback.

## 16. Regra final para o agente implementador

Construir menos coisas, mas preservar as fronteiras importantes:

```text
PWA = experiência
Backend = autorização e verdade financeira
Evolution/Go = bootstrap WhatsApp
Web Push = comunicação oportunista
PostgreSQL/ledger = persistência autoritativa
TINO Design System = identidade visual
```

O trabalho só deve ser considerado concluído quando UI, API, segurança, PWA, persistência, testes, E2E e observabilidade estiverem funcionando juntos. A existência de telas isoladas não é suficiente.

## 17. Contrato mastigado para o backend

Esta seção é a orientação operacional para o agente implementador. Ela distingue o que já existe no backend do que precisa ser criado para atender o Meu TINO.

### 17.1 Regra mais importante

O PWA não deve chamar diretamente os endpoints administrativos existentes do comerciante.

O PWA não deve chamar diretamente:

- `/api/v1/businesses/{businessId}/customers/...`;
- `/api/v1/businesses/{businessId}/customers/{customerId}/credit`;
- `/api/v1/businesses/{businessId}/payments/...`;
- `/api/v1/auth/otp/...` sem um fluxo específico para cliente;
- endpoints internos do serviço Go;
- Evolution API.

Esses endpoints usam identidade de comerciante, autorização por negócio e/ou credenciais diferentes. O PWA precisa de uma fachada de leitura e sessão própria, sempre resolvida por `CustomerChannel`.

### 17.2 O que já existe e como reutilizar

| Capacidade existente   | Local/padrão atual                                                         | Uso pelo Meu TINO                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Cliente do comerciante | `modules/customer`, `CustomerController`, `GetCustomer`, `CustomerView`    | Reutilizar os dados de nome, nickname, telefone, status e vínculo; não expor o controller administrativo ao PWA                               |
| Saldo da caderneta     | `modules/credit`, `GetCreditBalance`, `CreditBalanceView`                  | Reutilizar o modelo e a fonte de dados; criar consulta autorizada por `CustomerChannel`, sem inventar `userId` de comerciante                 |
| Lançamentos de crédito | `CreditLedgerEntry`, `CreditDirection`, `CreditRepository`                 | Projetar para uma atividade própria do cliente; omitir `actorUserId`, IDs internos desnecessários e detalhes administrativos                  |
| Histórico de compras   | `modules/receiving`, `GetPurchaseHistory`, `PurchaseHistoryRepository`     | Reutilizar a consulta/repositório onde fizer sentido; não chamar controller internamente                                                      |
| Pagamentos             | `modules/payment`, `PaymentView`, `ProcessPayment`, `IngestPaymentWebhook` | Usar fatos de pagamento confirmado para gerar eventos; não expor os endpoints de pagamento do comerciante no MVP 1                            |
| Autenticação atual     | `modules/identity`, JWT, `AuthenticatedPrincipal`                          | Permanecer para comerciantes e Android; não entregar JWT de comerciante ao cliente final                                                      |
| OTP atual              | `/api/v1/auth/otp/...`, `OtpController`                                    | Não usar diretamente no PWA no MVP 1; o fluxo inicial usa convite/recovery link. Se OTP for adotado depois, criar propósito e client próprios |
| Mensageria WhatsApp    | `modules/messaging` e serviço Go                                           | Usar somente através de `WhatsAppBootstrapPort` para convite e recuperação                                                                    |
| Correlation ID         | `CorrelationIdFilter`, header `X-Correlation-Id`                           | Preservar no contrato; o PWA pode enviar um ID seguro e deve guardar o ID retornado para suporte                                              |
| Erros HTTP             | `ErrorResponse(code, message, correlationId)`                              | Manter o envelope e mapear `code` para mensagens amigáveis no frontend                                                                        |

O agente deve consultar os casos de uso e ports existentes antes de criar duplicações. O backend pode adicionar uma nova query/fachada, mas não deve duplicar saldo, ledger ou regra de autorização no módulo do frontend.

### 17.3 Sessão do cliente final

O backend atual autentica comerciantes por JWT validado pelo resource server. Para o Meu TINO, a recomendação é uma sessão opaca própria, emitida pelo backend após a ativação do convite.

```text
Convite válido
  -> CustomerChannelSession criada no backend
  -> cookie HttpOnly enviado ao browser
  -> filtro resolve sessão
  -> CustomerChannelPrincipal
  -> /api/v1/me/*
```

O agente deve implementar uma identidade distinta, por exemplo:

```text
CustomerChannelPrincipal
  sessionId
  customerChannelId
```

O principal do cliente não deve ser convertido em `AuthenticatedPrincipal` de comerciante nem ganhar permissões de negócio.

Cookie recomendado:

```text
Name: tino_customer_session
HttpOnly: true
Secure: true
SameSite: Lax
Path: /
Max-Age: configurável
```

Recomendação inicial para o MVP: sessão persistente por até 30 dias, com expiração por inatividade configurável em 14 dias, rotação após ativação e revogação server-side.

Não usar:

- JWT de comerciante no browser;
- token de sessão em `localStorage`;
- customer ID como autorização;
- telefone como autorização;
- sessão sem registro/revogação no backend.

### 17.4 Alteração necessária na segurança atual

O `SecurityFoundationConfiguration` atual libera rotas específicas e usa OAuth2 Resource Server com JWT; a configuração atual também desabilita CSRF globalmente. O agente deve tratar isso como um ponto de integração obrigatório.

Implementar uma separação clara:

1. rotas públicas de ativação e recovery link;
2. rotas `/api/v1/me/**` autenticadas exclusivamente por sessão de cliente;
3. rotas administrativas existentes autenticadas por JWT de comerciante;
4. webhooks internos/provider com autenticação própria, sem receber sessão do cliente.

Para as rotas autenticadas por cookie:

- habilitar proteção CSRF para endpoints mutáveis;
- validar `Origin` e, quando aplicável, `Referer`;
- usar `SameSite` como camada adicional, nunca como única defesa;
- não permitir que um JWT de comerciante seja aceito como sessão de cliente;
- não permitir que um cookie de cliente seja aceito em rotas administrativas.

O agente pode usar chains/filtros separados ou uma implementação equivalente, mas deve preservar o comportamento das rotas existentes e cobrir a matriz de autenticação em testes.

### 17.5 Módulo novo no backend

Criar um módulo ou bounded context `customer-channel`, preferencialmente no monólito modular existente.

#### Entidades/agregados

```text
CustomerChannel
CustomerInvite
CustomerSession
CustomerPushSubscription
CustomerCommunicationEvent
```

#### Casos de uso de entrada

```text
CreateCustomerChannelInvite
ReinviteCustomerChannel
ActivateCustomerChannel
RequestCustomerChannelRecovery
GetCustomerHome
ListCustomerActivity
GetCustomerActivity
GetCustomerPushConfig
RegisterCustomerPushSubscription
RevokeCustomerPushSubscription
LogoutCustomerSession
```

#### Ports de saída

```text
CustomerChannelRepository
CustomerInviteRepository
CustomerSessionRepository
CustomerPushSubscriptionRepository
CustomerActivityQuery
CustomerAccountQuery
WhatsAppBootstrapPort
WebPushPort
CustomerNotificationOutbox
```

Nenhum caso de uso do módulo deve depender diretamente de controller, `HttpServletRequest`, `JsonNode`, jOOQ, JDBC, Evolution, Web Push ou biblioteca concreta de provider.

### 17.6 Migrations e restrições de banco

Criar migrations compatíveis com o padrão Flyway e RLS/tenant isolation já usado no backend.

#### `customer_channel`

```text
id UUID/UUIDv7 primary key
customer_id UUID not null
business_id UUID not null
status varchar not null
activated_at timestamptz null
last_access_at timestamptz null
created_at timestamptz not null
updated_at timestamptz not null
```

Restrições:

- foreign keys para customer e business quando compatível com o modelo atual;
- unique `(business_id, customer_id)`;
- índice por `(business_id, status)`;
- RLS que impeça leitura cruzada entre businesses;
- transições de status validadas pelo domínio.

#### `customer_invite`

```text
id UUID/UUIDv7 primary key
customer_channel_id UUID not null
token_hash varchar(128) not null
idempotency_key varchar(200) null
expires_at timestamptz not null
consumed_at timestamptz null
revoked_at timestamptz null
created_at timestamptz not null
```

Restrições:

- unique `token_hash`;
- nunca persistir o token puro;
- índice por `customer_channel_id` e estado de validade;
- reenvio revoga convite anterior ainda válido antes de criar o próximo;
- concorrência de consumo protegida por lock/constraint transacional.

#### `customer_session`

```text
id UUID/UUIDv7 primary key
session_token_hash varchar(128) not null
customer_channel_id UUID not null
created_at timestamptz not null
last_seen_at timestamptz not null
expires_at timestamptz not null
revoked_at timestamptz null
```

Restrições:

- unique `session_token_hash`;
- token puro somente no cookie do cliente;
- lookup por hash em tempo constante quando aplicável;
- revogação individual e revogação por `customerChannelId`;
- não registrar cookie em logs.

#### `customer_push_subscription`

```text
id UUID/UUIDv7 primary key
customer_channel_id UUID not null
endpoint text not null
p256dh text not null
auth text not null
user_agent text null
created_at timestamptz not null
last_success_at timestamptz null
last_failure_at timestamptz null
revoked_at timestamptz null
```

Restrições:

- unique por `(customer_channel_id, endpoint)` enquanto ativa;
- endpoint deve ser HTTPS e ter tamanho limitado;
- validar base64/base64url de `p256dh` e `auth`;
- endpoint completo não entra em logs/analytics;
- subscription revogada pode ser substituída por nova assinatura do mesmo aparelho.

#### Outbox de notificação

```text
id UUID/UUIDv7 primary key
event_id varchar(200) not null
customer_channel_id UUID not null
event_type varchar(80) not null
aggregate_id UUID null
status varchar not null
attempt_count integer not null
available_at timestamptz not null
last_error_code varchar(120) null
created_at timestamptz not null
processed_at timestamptz null
```

Use unique `(event_id, customer_channel_id, event_type)` para evitar push duplicado.

### 17.7 API pública de ativação

#### `POST /api/v1/customer-channel/activation`

**Autenticação:** pública, mas exige token de convite no corpo.

**CSRF:** proteger contra origens externas e validar `Origin`/Fetch Metadata; o token é o segredo de ativação.
**Rate limit:** por IP, hash do token e fingerprint de tentativa.

Request:

```json
{
  "token": "token-entregue-no-whatsapp"
}
```

Headers:

```text
Content-Type: application/json
Idempotency-Key: uuid-ou-valor-aleatorio
X-Correlation-Id: opcional
```

Comportamento transacional:

1. validar formato e tamanho;
2. calcular hash;
3. localizar convite por hash;
4. verificar existência, expiração, revogação e consumo;
5. validar que `CustomerChannel`, customer e business continuam ativos;
6. criar sessão opaca;
7. marcar convite como consumido;
8. emitir cookie de sessão;
9. retornar somente status de ativação, nunca dados administrativos.

Response `200`:

```json
{
  "status": "ACTIVE"
}
```

O response deve incluir `Set-Cookie: tino_customer_session=...` com os atributos definidos na seção de sessão.

O PWA obterá nome, comerciante e saldo somente pelo `GET /api/v1/me` após a sessão estar estabelecida.

Para uma repetição causada por timeout de rede, o backend deve tratar a operação de forma segura e idempotente quando a mesma tentativa já tiver sido concluída. Não permitir que um token consumido seja usado livremente para criar sessões ilimitadas.

### 17.8 API de recuperação

No MVP, a recuperação deve ser vinculada ao estabelecimento conhecido pelo fluxo inicial. Não implementar busca global por telefone em todos os estabelecimentos.

#### `POST /api/v1/public/businesses/{businessRef}/customer-channel/recovery`

`businessRef` é um identificador público/opaque do estabelecimento; não é um segredo nem substitui autorização.

Request:

```json
{
  "phone": "+55XXXXXXXXXXX"
}
```

Comportamento:

- normalizar telefone para o formato canônico existente;
- procurar somente canais elegíveis daquele estabelecimento;
- se houver um canal ativo, criar link de recuperação de uso único;
- enviar o link pelo `WhatsAppBootstrapPort`;
- registrar tentativa e resultado sem guardar o token puro;
- responder igual se o telefone não existir;
- não revelar se houve cliente, canal ou envio.

Response sempre que possível:

```json
{
  "status": "REQUEST_ACCEPTED"
}
```

O rate limit deve ser aplicado por IP, `businessRef` e telefone hash. Se houver múltiplos canais elegíveis no mesmo estabelecimento, não escolher silenciosamente: registrar como conflito operacional e orientar recuperação pelo comerciante.

### 17.9 API de sessão

#### `POST /api/v1/me/logout`

- exigir sessão de cliente;
- revogar a sessão no banco;
- limpar o cookie;
- retornar `204 No Content`;
- ser seguro quando a sessão já estiver revogada.

#### `GET /api/v1/me`

- exigir sessão de cliente;
- atualizar `lastAccessAt` sem transformar leitura em operação pesada;
- resolver somente o `CustomerChannel` da sessão;
- não aceitar `customerId` ou `businessId` do browser;
- responder `401` para sessão ausente/expirada;
- responder `403` para canal suspenso/revogado, sem dados financeiros.

Response:

```json
{
  "channel": {
    "status": "ACTIVE"
  },
  "customer": {
    "displayName": "Gerlane de Araújo"
  },
  "business": {
    "displayName": "Mercadinho João"
  },
  "account": {
    "status": "OPEN",
    "balance": {
      "minor": 49750,
      "currency": "BRL"
    },
    "version": 42,
    "asOf": "2026-09-10T10:30:00Z"
  },
  "features": {
    "push": true,
    "pix": false,
    "agreements": false
  },
  "push": {
    "activeSubscriptions": 1
  }
}
```

Regras:

- não retornar telefone no `/me` salvo necessidade explícita de UX;
- não retornar `customerId`, `businessId`, `accountId` ou `actorUserId` se o PWA não precisar;
- converter `BigDecimal balance` do backend para minor units no contrato do PWA;
- `version` e `asOf` devem vir da mesma leitura consistente;
- `Cache-Control: no-store` para dados autenticados;
- datas em ISO-8601 UTC.

### 17.10 API de atividade/extrato

#### `GET /api/v1/me/activity`

Query params:

```text
limit: 1..50, default 20
cursor: opcional
type: opcional, filtrado por enum permitido
```

Response:

```json
{
  "items": [
    {
      "id": "activity_opaque_id",
      "type": "DEBT_CREATED",
      "impact": "INCREASES_BALANCE",
      "amount": {
        "minor": 14000,
        "currency": "BRL"
      },
      "label": "Compra fiada",
      "occurredAt": "2026-09-07T18:20:00Z"
    },
    {
      "id": "activity_opaque_id_2",
      "type": "PAYMENT_CONFIRMED",
      "impact": "DECREASES_BALANCE",
      "amount": {
        "minor": 19600,
        "currency": "BRL"
      },
      "label": "Pagamento recebido",
      "occurredAt": "2026-09-10T10:30:00Z"
    }
  ],
  "nextCursor": null,
  "asOf": "2026-09-10T10:30:00Z"
}
```

Enums do MVP:

```text
DEBT_CREATED
PAYMENT_CONFIRMED
ADJUSTMENT
```

Regras:

- `amount.minor` é sempre positivo;
- o frontend usa `type` e `impact` para cor, ícone e texto;
- o frontend não calcula saldo somando itens;
- ocultar `actorUserId`, reason interno e identificadores de provider;
- ordenar por `occurredAt` e ID estável;
- paginação por cursor, sem `offset` para histórico crescente;
- se um item não estiver autorizado ao canal, responder como inexistente.

#### `GET /api/v1/me/activity/{activityId}`

Usado pelo deep link de uma notificação. Deve repetir a verificação de escopo da sessão e retornar `404` se a atividade não pertencer ao canal atual.

### 17.11 API de Web Push

#### `GET /api/v1/me/push-config`

Response:

```json
{
  "enabled": true,
  "vapidPublicKey": "public-key-base64url"
}
```

Somente a chave pública pode sair do backend. Se push estiver desabilitado, retornar `enabled: false` sem erro de aplicação.

#### `POST /api/v1/me/push-subscriptions`

Request:

```json
{
  "endpoint": "https://push-provider.example/subscription",
  "keys": {
    "p256dh": "base64url",
    "auth": "base64url"
  }
}
```

Headers:

```text
Content-Type: application/json
Idempotency-Key: uuid-ou-valor-aleatorio
```

Comportamento:

- exigir sessão de cliente;
- validar endpoint HTTPS e limites de tamanho;
- validar chaves;
- associar sempre ao `CustomerChannel` da sessão;
- fazer upsert por endpoint dentro do canal;
- não aceitar `customerChannelId` no request;
- registrar user-agent a partir do request, se necessário;
- não enviar payload de teste automaticamente.

Response `201` ou `200`:

```json
{
  "id": "subscription_opaque_id",
  "status": "ACTIVE"
}
```

#### `DELETE /api/v1/me/push-subscriptions/{subscriptionId}`

- exigir sessão;
- verificar que a subscription pertence ao canal atual;
- marcar `revokedAt`, não depender de delete físico para auditoria;
- retornar `204` mesmo se já revogada, quando isso não esconder abuso.

### 17.12 APIs do comerciante para iniciar o fluxo

O Android usa JWT de comerciante e os padrões atuais de `BusinessAuthorization`.

#### `POST /api/v1/businesses/{businessId}/customers/{customerId}/customer-channel/invite`

Headers:

```text
Authorization: Bearer <JWT do comerciante>
Idempotency-Key: obrigatório
```

Comportamento:

1. autorizar usuário no business;
2. localizar cliente dentro do mesmo business;
3. normalizar e validar telefone;
4. criar ou reutilizar `CustomerChannel`;
5. invalidar convite anterior conforme política;
6. criar token aleatório e persistir somente hash;
7. montar a URL pública;
8. enviar template curto pelo `WhatsAppBootstrapPort`;
9. registrar `INVITE_SENT`/`DELIVERY_FAILED`;
10. não retornar token puro ao Android.

Response:

```json
{
  "channelId": "channel_opaque_id",
  "status": "INVITED",
  "deliveryStatus": "QUEUED"
}
```

#### `POST /api/v1/businesses/{businessId}/customers/{customerId}/customer-channel/reinvite`

Mesmas regras do convite, com rate limit e revogação explícita do convite anterior. O endpoint não deve criar múltiplos convites válidos simultaneamente para o mesmo canal.

#### `GET /api/v1/businesses/{businessId}/customers/{customerId}/customer-channel`

Uso exclusivo do Android para exibir:

```json
{
  "status": "ACTIVE",
  "activatedAt": "2026-09-10T10:20:00Z",
  "lastAccessAt": "2026-09-10T10:30:00Z",
  "activePushSubscriptions": 1
}
```

Esse endpoint pode expor o estado operacional ao comerciante autorizado, mas nunca deve ser usado pelo PWA.

### 17.13 Consulta de saldo e atividade sem quebrar autorização

Os casos de uso atuais de crédito e histórico recebem autorização de usuário/business. A sessão do cliente não possui usuário comerciante equivalente.

O agente deve criar uma porta de leitura específica, por exemplo:

```java
public interface CustomerChannelAccountQuery {
    CustomerAccountSnapshot findFor(CustomerChannelId channelId);
}

public interface CustomerChannelActivityQuery {
    CustomerActivityPage list(CustomerChannelId channelId, ActivityCursor cursor, int limit);
    Optional<CustomerActivity> find(CustomerChannelId channelId, CustomerActivityId activityId);
}
```

Implementações podem reutilizar `CreditRepository`, `PurchaseHistoryRepository`, tabelas de pagamentos e eventos existentes, mas devem validar o par `businessId + customerId` vindo exclusivamente do canal autenticado.

Não fazer:

```text
customer session
  -> inventar userId
  -> chamar GetCreditBalance como se fosse comerciante
```

Fazer:

```text
customer session
  -> carregar CustomerChannel
  -> obter businessId/customerId do registro confiável
  -> executar query read-only com escopo do canal
  -> mapear resposta pública mínima
```

### 17.14 Eventos que alimentam o push

O backend deve gerar notificação somente depois de o fato de negócio estar confirmado.

#### Compra fiada

```text
lançamento de compra confirmado
  -> transação do ledger concluída
  -> outbox CustomerNotificationEvent
  -> type=DEBT_CREATED
  -> push para subscriptions ativas
```

#### Pagamento confirmado

```text
provider/webhook confirmado
  -> Payment status transition válida
  -> ledger atualizado/conciliação concluída
  -> outbox CustomerNotificationEvent
  -> type=PAYMENT_CONFIRMED
  -> push para subscriptions ativas
```

Não gerar push para:

- tentativa de pagamento ainda pendente;
- abertura de tela pelo cliente;
- resposta do browser;
- mudança não confirmada do provider;
- erro de integração sem fato financeiro confirmado.

### 17.15 Serviço de notificações

Criar `CustomerNotificationService` na camada de aplicação.

Responsabilidades:

1. receber evento de domínio/outbox;
2. localizar canais ativos elegíveis;
3. localizar subscriptions não revogadas;
4. escolher template determinístico versionado;
5. gerar payload mínimo;
6. chamar `WebPushPort` com timeout;
7. registrar sucesso/falha;
8. revogar subscription em `410 Gone`;
9. aplicar retry somente para falhas transitórias;
10. deduplicar por `(eventId, channelId, channel)`.

Payload inicial:

```json
{
  "type": "DEBT_CREATED",
  "title": "Nova compra registrada",
  "body": "Sua caderneta foi atualizada.",
  "target": "/activity/activity_opaque_id"
}
```

No MVP, não incluir valor ou saldo no push por padrão. A PWA busca o valor atual após o click.

Fallback automático para WhatsApp fica desativado no MVP 1, salvo decisão explícita de produto e consentimento/política de mensagens.

### 17.16 Política de erros da API

Preservar o envelope existente:

```json
{
  "code": "INVITE_INVALID",
  "message": "Este link não é mais válido.",
  "correlationId": "correlation-id"
}
```

Codes mínimos:

| HTTP | Code                        | Uso                                       |
| ---: | --------------------------- | ----------------------------------------- |
|  400 | `INVALID_REQUEST`           | JSON, formato ou parâmetro inválido       |
|  401 | `CUSTOMER_SESSION_REQUIRED` | sessão ausente/expirada                   |
|  403 | `CHANNEL_INACTIVE`          | canal suspenso ou revogado                |
|  404 | `RESOURCE_NOT_FOUND`        | atividade/canal fora do escopo            |
|  409 | `ACTIVATION_CONFLICT`       | concorrência ou idempotência incompatível |
|  410 | `INVITE_INVALID`            | convite expirado, revogado ou consumido   |
|  429 | `RATE_LIMITED`              | abuso ou excesso de tentativas            |
|  503 | `SERVICE_UNAVAILABLE`       | dependência indisponível                  |

Mensagens para o cliente devem ser genéricas e estáveis. Stack trace, SQL, telefone, token, IDs internos e detalhes do provider nunca devem sair no response.

Quando houver `429`, retornar `Retry-After` quando possível. Quando houver `5xx`, manter `X-Correlation-Id` para suporte.

### 17.17 Cabeçalhos e cache de respostas

Para `/api/v1/me/**`:

```text
Cache-Control: no-store
Pragma: no-cache
Vary: Cookie
Content-Type: application/json
X-Correlation-Id: <id>
```

O service worker não deve interceptar nem persistir respostas autenticadas financeiras no MVP 1. Assets estáticos podem usar cache versionado e imutável.

### 17.18 Regras de telefone

- aceitar telefone somente nos endpoints de convite/recovery necessários;
- normalizar com o value object/padrão já existente;
- persistir/consultar usando forma canônica;
- nunca usar telefone cru como chave de sessão;
- nunca retornar telefone completo em logs, analytics ou mensagens de erro;
- não revelar existência do telefone na recuperação;
- respeitar consentimento/política de contato do módulo de mensageria antes de enviar WhatsApp.

### 17.19 Checklist de implementação do backend

- [ ] Criar migrations de `CustomerChannel`, invite, sessão, push e outbox.
- [ ] Criar entidades/value objects sem token puro.
- [ ] Criar ports e casos de uso do módulo `customer-channel`.
- [ ] Criar autenticação de sessão de cliente separada do JWT de comerciante.
- [ ] Corrigir a estratégia de CSRF para rotas autenticadas por cookie.
- [ ] Criar ativação por link de uso único.
- [ ] Criar recovery link com resposta anti-enumeração.
- [ ] Criar convite/reinvite/status para o Android.
- [ ] Integrar convite somente via `WhatsAppBootstrapPort`.
- [ ] Criar fachada `/api/v1/me`.
- [ ] Criar consulta de atividade read-only com paginação por cursor.
- [ ] Mapear `BigDecimal`/ledger para minor units públicas.
- [ ] Criar configuração pública de VAPID.
- [ ] Criar registro/revogação de subscriptions.
- [ ] Criar eventos/outbox para compra e pagamento confirmado.
- [ ] Criar `WebPushPort` e retries com timeout.
- [ ] Remover subscriptions em `410 Gone`.
- [ ] Preservar correlation ID e envelope de erros.
- [ ] Adicionar `Cache-Control: no-store` às respostas financeiras.
- [ ] Cobrir IDOR, tenant isolation, sessão, CSRF, rate limit e idempotência.
- [ ] Criar fixtures de comerciante, cliente, canal e atividades.
- [ ] Publicar contrato OpenAPI ou documentação equivalente para o frontend.
- [ ] Executar E2E controlado convite → ativação → home → push.

### 17.20 Ordem exata para o agente começar

1. confirmar os padrões existentes de migration, RLS, IDs, erros e segurança;
2. criar `CustomerChannel` e seus invariantes;
3. criar sessão de cliente e filtro de autenticação;
4. implementar ativação segura;
5. implementar `/api/v1/me` com saldo read-only;
6. implementar atividade/extrato;
7. implementar convite/reinvite no fluxo administrativo;
8. integrar envio WhatsApp;
9. implementar push config e subscriptions;
10. implementar outbox e eventos de compra/pagamento;
11. implementar delivery Web Push e tratamento de 410/retry;
12. adicionar testes de segurança e E2E;
13. só então conectar o frontend às rotas estabilizadas.

O agente não deve começar pelas telas usando mocks permanentes. Primeiro deve deixar os contratos de sessão, `/me`, atividade e subscription testáveis no backend; mocks do frontend podem existir apenas durante o desenvolvimento da interface e devem ser removidos antes do E2E.
