# Changelog e plano de correções — Caneto Native

Este arquivo combina o plano de correções da migração web → nativo com o histórico de versões.
Cada versão abaixo tem escopo fechado, critério de aceite e arquivos esperados.

## Política de versionamento

- **PATCH** (`1.1.x`): correção de integridade, perda de dados ou bug bloqueante.
- **MINOR** (`1.2+`): paridade funcional/visual com a web.
- `versionCode` do Android é sempre incrementado e nunca reutilizado.
- `app.json` e `package.json` devem ter a mesma versão; o workflow de APK valida isso.
- Toda release gera tag `vX.Y.Z`; o workflow `.github/workflows/build-apk.yml` publica o APK.

## Mapa de versões

| Versão | Tipo | Correção | Origem na auditoria | status |
| --- | --- | --- | --- | --- |
| 1.1.2 | PATCH | Limpar comprados move todos os itens para a lixeira | P0.1 | Publicado |
| 1.1.3 | PATCH | Remover amigo usa a tabela `friendships` | P0.4 | Pulado |
| 1.1.4 | PATCH | Reabrir limpa pendência fiscal; histórico não é sobrescrito | P0.5 | Pulado |
| 1.1.5 | PATCH | Fila de sync resiste a erro permanente (dead-letter) | P0.7 | Pulado |
| 1.1.6 | PATCH | Tamanho de fonte, alto contraste e notificações com efeito real | P0.6 | Pulado |
| 1.1.7 | PATCH | Fotos de produto/etiqueta/recibo no Supabase Storage | P0.2 | Pulado |
| 1.1.8 | PATCH | Publicação de `store_prices` ao finalizar compra | P0.3 | Pulado |
| 1.2.0 | MINOR | Compra completa: foto do cupom, anexar depois, loja/histórico completos, CTA de finalizar e nova lista ao concluir | P1 | Publicado |
| 1.2.1 | PATCH | Corrige encerramento instantâneo ao abrir: remove `expo-av` (sem versão para o SDK 57) e adia módulos nativos | Crash no start | Em validação |
| 1.2.2 | MINOR | Conta: onboarding com perfil/@/visibilidade/preferências, avatar, troca de senha, excluir conta e tela de upgrade | P1 | Planejado |
| 1.2.3 | MINOR | Captura: lanterna, trocar câmera, galeria, modo etiqueta, modo lista e auditoria de nota | P1 | Planejado |
| 1.3.0 | MINOR | Social: presença, ranking com amigos e push real | P1 | Planejado |
| 1.3.1 | MINOR | Itens: observações, etiqueta com IA, nutrição/OFF, preço promocional, voz e multi-add inline | P1 | Planejado |
| 1.4.0 | MINOR | Locais: favoritos, métricas/ofertas e catálogo vivo | P1 | Planejado |
| 1.4.1 | PATCH | QA final, matriz de paridade atualizada, docs e alinhamento de versões | P2 | Planejado |

---

## v1.1.2 — Integridade da exclusão em lote (2026-11-03)

**Status:** Publicado

### Correções

- **P0.1 — Limpar comprados apagava apenas o último item.**
  O fluxo anterior chamava `startDeleteItem` em loop, mas mantinha um único item pendente; os demais voltavam após o refresh e nunca eram removidos do Supabase.
  Agora todos os itens comprados são movidos para a lixeira local em uma única operação, removidos da lista local de uma vez e enfileirados individualmente para exclusão no servidor.

### Arquivos

- `src/features/cart/trashRepository.ts`: nova `movePurchasedItemsToTrash`.
- `App.tsx`: `onClearPurchased` usa a operação em lote e atualiza a lixeira.

### Critério de aceite

- Com 3 ou mais itens comprados, “Limpar” remove todos da lista.
- Após matar o app e reabrir, nenhum item removido reaparece.
- Todos os itens removidos aparecem na lixeira e podem ser restaurados.
- Itens não marcados permanecem intactos.

---

## v1.1.3 — Remoção de amigo (planejado)

- Corrigir `removeFriendship` para excluir de `friendships` (hoje usa `friends`, tabela inexistente).
- Aceite: remover amigo em qualquer direção some da lista imediatamente e após refresh.

## v1.1.4 — Reabertura e histórico (planejado)

- Limpar `pendingReceipt` ao reabrir lista concluída.
- Não sobrescrever o histórico da compra anterior ao finalizar uma lista reaberta.
- Aceite: reabrir → finalizar gera um novo registro; o anterior continua no histórico.

## v1.1.5 — Fila de sync resistente (planejado)

- Mover operações com erro permanente para dead-letter após N tentativas.
- Expor contagem de itens não sincronizados na UI.
- Aceite: uma operação inválida não bloqueia as seguintes.

## v1.1.6 — Preferências reais (planejado)

- Aplicar tamanho de fonte e alto contraste em todo o app.
- Exibir e persistir o toggle de notificações apenas com permissão real.
- Aceite: alterar preferência muda a UI imediatamente e após reabrir o app.

## v1.1.7 — Fotos na nuvem (planejado)

- Upload de produto, etiqueta e recibo para bucket do Supabase; salvar caminho/URL no item.
- Migrar URIs locais existentes.
- Aceite: foto aparece em outro dispositivo e no app web.

## v1.1.8 — Base colaborativa de preços (planejado)

- Publicar preços confirmados/estimados em `store_prices` ao finalizar compra.
- Aceite: loja recém-utilizada aparece com catálogo na aba Locais em outro dispositivo.

## v1.2.0 — Compra completa (2026-11-03)

**Status:** Publicado

> Salto deliberado sobre 1.1.3–1.1.8. As correções pendentes dessas versões continuam válidas e serão retomadas após esta release, na ordem do mapa acima. O `versionCode` passou de 11 para 12.

### Correções e melhorias

- **Foto do comprovante no modo nota.** O passo 2 agora mostra a miniatura da foto capturada, permite remover e ler outra nota sem sair do fluxo, e exibe local/CNPJ identificados.
- **Anexar nota depois.** Lista finalizada com `pendingReceipt` ganhou o botão “Anexar nota ou escanear recibo”, que valida o comprovante e atualiza lista + histórico sem refazer a compra.
- **Dados completos da loja no histórico.** `loadHistory` passou a trazer endereço, CNPJ, forma de pagamento, pendência fiscal, comprovante e total detectado. O histórico mostra esses dados, prévia dos itens e o comprovante expansível.
- **CTA de finalizar na lista.** A área de compras exibe “Finalizar compra” com o total dos itens comprados (ou o estimado), abrindo o fluxo de 3 passos sem passar pelo menu.
- **Nova lista ao concluir.** Depois de finalizar, o app abre a próxima lista em aberto; se não existir, cria “Minha Lista de Compras” e já entra nela.
- **Recriar compra preserva categoria.** Listas recriadas a partir do histórico mantêm a categoria original dos itens.

### Arquivos

- `src/features/purchases/repository.ts`: `attachReceipt`, histórico completo, persistência de endereço/CNPJ da loja, categoria na recriação.
- `src/features/purchases/PurchaseModals.tsx`: preview/remoção do comprovante, histórico expandido.
- `src/features/cart/ShoppingListScreen.tsx`: CTA de finalizar, ação de anexar nota, endereço na lista concluída.
- `App.tsx`: wiring do anexo tardio e troca/criação de lista após finalizar.

### Critério de aceite

- Finalizar sem nota mantém a pendência visível e permite anexar o comprovante depois.
- Foto capturada no modo nota aparece no passo 2 e no histórico.
- Histórico exibe loja, endereço, CNPJ, pagamento e itens da compra.
- “Finalizar compra” aparece na lista e abre o fluxo de 3 passos.
- Ao concluir, o usuário cai na próxima lista aberta ou em uma lista nova criada automaticamente.

---

## v1.2.1 — Correção do encerramento instantâneo (2026-11-03)

**Status:** Em validação

### Correções

- **`expo-av` incompatível com o SDK 57.** A dependência não existe na lista de módulos do SDK 57 (`bundledNativeModules`) e era registrada no binário nativo mesmo sem uso. O módulo nativo derrubava o processo antes de qualquer tela aparecer. A dependência foi removida; os efeitos sonoros (que já eram um stub sem áudio) não dependem mais dela.
- **Módulos nativos carregados sob demanda.** `expo-notifications` passou a ser requerido apenas quando solicitado, evitando falha de inicialização em ambientes sem o módulo.
- **Tela de erro em vez de fechamento.** `src/app/index.tsx` agora envolve o app em um `ErrorBoundary`; uma falha de renderização mostra a mensagem e um botão “Tentar novamente” em vez de encerrar.
- **`versionCode` 12 → 13.** Como o `runtimeVersion` usa `appVersion`, o novo APK ignora qualquer atualização EAS publicada para a 1.2.0.

### Arquivos

- `package.json` / `package-lock.json`: remoção de `expo-av`.
- `src/core/device/sounds.ts`: sem carregamento de `expo-av`.
- `src/core/device/notifications.ts`: carregamento sob demanda.
- `src/app/index.tsx`: `ErrorBoundary` de inicialização.
- `app.json`: versão 1.2.1 e `versionCode` 13.

### Critério de aceite

- Instalar o APK 1.2.1 e abrir: o app permanece aberto e chega à tela de login/lista.
- Nenhum crash nativo no `adb logcat -b crash` durante a abertura.
- Listas, sincronização e o fluxo de compra da 1.2.0 continuam funcionando.

---

## v1.2.2 — Conta e plano (planejado)

- Onboarding com perfil, @, visibilidade e preferências; avatar/emoji; disponibilidade de @; visibilidade discreta; troca de senha; exclusão de conta; tela de upgrade com cota.

## v1.2.3 — Captura completa (planejado)

- Lanterna, troca de câmera, galeria, modo etiqueta (`/api/label`), modo lista e auditoria de nota.

## v1.3.0 — Social e notificações (planejado)

- Presença em listas, ranking com amigos e push com token no perfil.

## v1.3.1 — Itens avançados (planejado)

- Observações, etiqueta com IA, nutrição/Open Food Facts, preço promocional, ditado por voz e multi-add inline.

## v1.4.0 — Locais avançados (planejado)

- Favoritos, métricas/ofertas e catálogo vivo.

## v1.4.1 — Qualidade (planejado)

- Atualizar `docs/MATRIZ_QA_PARIDADE_ANDROID.md`, testes ponta a ponta e alinhamento de versões web/nativo.
