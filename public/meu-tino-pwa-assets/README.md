# Meu TINO — imagens e ícones para o PWA

Recursos separados a partir do painel do Meu TINO selecionado na conversa. Cada ilustração e ícone possui seu próprio arquivo. Os textos, valores e botões continuam sendo elementos da interface.

## Instalação dos arquivos

1. Copie a pasta `public/tino` para `public/tino` do projeto.
2. Incorpore os links de `integration/head.html` ao `<head>` existente.
3. Use `public/manifest.webmanifest` como exemplo. Em um PWA existente, incorpore os ícones ao manifest atual, preservando o `id`, `start_url`, `scope` e demais configurações do projeto.
4. Se o app estiver em uma subpasta, ajuste os caminhos absolutos do exemplo.

## Imagens principais

| Arquivo em `public/tino`                 | Aplicação                                 | Formato / tamanho                      |
| ---------------------------------------- | ----------------------------------------- | -------------------------------------- |
| `brand/tino-mark.webp`                   | Símbolo oficial em fundo claro            | WebP lossless, transparente, 428 × 446 |
| `brand/tino-mark-white.webp`             | Símbolo branco em fundo escuro            | WebP lossless, transparente, 428 × 446 |
| `brand/meu-tino-logo.webp`               | Assinatura horizontal MEU TINO            | WebP lossless, transparente, 340 × 64  |
| `brand/tino-logo.webp`                   | Assinatura compacta TINO                  | WebP lossless, transparente, 129 × 38  |
| `illustrations/boas-vindas-320.webp`     | Ilustração de entrada em telas menores    | 320 × 240, transparente                |
| `illustrations/boas-vindas-640.webp`     | Ilustração de entrada padrão              | 640 × 480, transparente                |
| `illustrations/boas-vindas-960.webp`     | Ilustração de entrada em maior densidade  | 960 × 720, transparente                |
| `illustrations/cliente-celular-320.webp` | Cliente usando o celular, versão menor    | 320 × 320, transparente                |
| `illustrations/cliente-celular-640.webp` | Cliente usando o celular, versão padrão   | 640 × 640, transparente                |
| `illustrations/cliente-celular-960.webp` | Cliente usando o celular, maior densidade | 960 × 960, transparente                |

Também há versões PNG das marcas e das duas ilustrações em 640 px. As assinaturas horizontais preservam os pixels da referência; use `meu-tino-logo` até 170 px de largura para exibição em densidade 2×. Para uma marca maior, use o símbolo original junto à tipografia do projeto.

As duas ilustrações foram preparadas individualmente com ImageGen a partir da imagem selecionada. O fundo técnico foi convertido em canal alfa na exportação. A marca vem dos arquivos oficiais enviados pelo usuário, sem redesenho. Os ícones de interface são SVGs próprios, construídos para acompanhar a linguagem visual do painel.

## Ícones coloridos de ação e estado

Cada item abaixo existe como `.svg`, `.png` e `.webp` na pasta `badges/`. Os rasters têm 128 × 128 px; prefira SVG para a interface.

| Nome                   | Uso                               | Cor semântica                  |
| ---------------------- | --------------------------------- | ------------------------------ |
| `pagar-pix`            | Ação de pagamento por Pix         | Verde                          |
| `ver-extrato`          | Extrato da caderneta              | Verde                          |
| `ver-acordos`          | Acordos de pagamento              | Azul                           |
| `compra-fiada`         | Compra lançada na caderneta       | Laranja                        |
| `pagamento-recebido`   | Pagamento confirmado pelo sistema | Verde                          |
| `lembrete-pagamento`   | Lembrete que exige atenção        | Vermelho                       |
| `notificacoes`         | Atualizações da caderneta         | Verde                          |
| `mercadinho`           | Identificação do estabelecimento  | Verde                          |
| `conexao-indisponivel` | Indisponibilidade de conexão      | Verde escuro com sinal laranja |
| `atualizar`            | Nova tentativa / atualização      | Verde                          |

Os arquivos representam estados visuais. O backend e as regras existentes continuam determinando quando cada estado se aplica. Combine a cor com o texto e o ícone; a cor sozinha não deve transmitir o estado.

## Ícones simples

A pasta `icons/` contém SVGs separados de 24 × 24 unidades: `pix`, `cart`, `check`, `check-circle`, `bell`, `file-text`, `handshake`, `store`, `home`, `refresh`, `arrow-down`, `arrow-up`, `link`, `plus`, `chevron-right`, `chevron-left`, `download`, `info`, `more-horizontal`, `wifi-off`, `shield-check` e `agreement`.

Use entre 20 e 28 px na interface. Para alterar a cor pelo CSS, use o sprite incluído ou incorpore o SVG ao componente. O `currentColor` da página não atravessa um `<img>` externo; nesse caso, o arquivo usa sua cor padrão.

```tsx
<button type="button" onClick={onRetry}>
  <svg
    className="tino-icon"
    aria-hidden="true"
    style={{ color: "currentColor" }}
  >
    <use href="/tino/icons/sprite.svg#tino-refresh" />
  </svg>
  Tentar novamente
</button>
```

O sprite possui os mesmos ícones individuais, com prefixo `tino-` em seus IDs. Ele é opcional: use uma das formas de carregamento para cada contexto.

## Ilustrações responsivas em React

```tsx
<picture>
  <source
    type="image/webp"
    srcSet={[
      "/tino/illustrations/boas-vindas-320.webp 320w",
      "/tino/illustrations/boas-vindas-640.webp 640w",
      "/tino/illustrations/boas-vindas-960.webp 960w",
    ].join(", ")}
    sizes="(max-width: 480px) calc(100vw - 48px), 360px"
  />
  <img
    src="/tino/illustrations/boas-vindas.png"
    width={640}
    height={480}
    alt=""
    decoding="async"
    className="tino-illustration"
  />
</picture>
```

O `alt` vazio serve quando a imagem é decorativa e o texto ao lado já comunica a mensagem. Dê uma descrição quando a ilustração transmitir informação própria. Preserve a proporção e use `object-fit: contain`. Nas imagens abaixo da área inicialmente visível, acrescente `loading="lazy"`.

## Ícones do aplicativo

| Arquivo em `pwa/`                                    | Tamanho        | Uso                                 |
| ---------------------------------------------------- | -------------- | ----------------------------------- |
| `icon-192.png`                                       | 192 × 192      | Manifest, `purpose: any`            |
| `icon-512.png`                                       | 512 × 512      | Manifest, `purpose: any`            |
| `icon-maskable-192.png`                              | 192 × 192      | Manifest, `purpose: maskable`       |
| `icon-maskable-512.png`                              | 512 × 512      | Manifest, `purpose: maskable`       |
| `apple-touch-icon.png`                               | 180 × 180      | Ícone Apple                         |
| `favicon-16.png`, `favicon-32.png`, `favicon-48.png` | 16, 32 e 48 px | Ícones do navegador                 |
| `notification-icon.png`                              | 96 × 96        | Ícone de notificação                |
| `notification-badge.png`                             | 72 × 72        | Marca branca monocromática com alfa |
| `icon-monochrome-192.png`                            | 192 × 192      | Variante monocromática opcional     |

Os maskable possuem fundo opaco e margem própria. A marca fica dentro da área circular segura de raio igual a 40% do lado, conforme [web.dev](https://web.dev/articles/maskable-icon). Os arquivos `any` e `maskable` são referenciados separadamente, seguindo a orientação de [ícones de PWA da MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons).

A exibição de `icon` e `badge` em notificações depende do navegador e do sistema operacional. O pacote entrega os recursos visuais; instalação, comportamento offline e push continuam sob a implementação do PWA.

## Organização e desempenho

- `asset-index.json` lista dimensões, bytes, caminhos e origem dos arquivos.
- `integration/tino-assets.css` contém as cores e classes básicas de imagem/ícone.
- Use WebP nas ilustrações, SVG nos ícones de interface e PNG nos ícones de instalação.
- Carregue somente a resolução escolhida pelo navegador; PNG e WebP são alternativas.
- A imagem do painel completo não faz parte dos recursos carregados pelo PWA.

O pacote conserva a separação visual da referência: compras em laranja, pagamentos em verde, acordos em azul e lembretes em vermelho. A marca TINO permanece em suas cores oficiais.
