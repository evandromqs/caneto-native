# Plano de paridade do Caneto web com o Caneto Native

## Objetivo e referência

Reproduzir no Android a experiência funcional e visual do aplicativo **após o login** em `caneto_app_web/app/app/page.tsx`, respeitando as decisões já pedidas: quatro abas no dock (Listas, Locais, Social, Ajustes), sem título ou cabeçalho fixo nas páginas, e conteúdo dentro da área segura da barra de status. A lista selecionada é uma área de trabalho própria, acessada a partir de Listas. O comportamento deve ser nativo quando o mecanismo do navegador não existe no Android.

Fontes de verdade: `caneto_app_web/components/tabs`, `caneto_app_web/components`, `caneto_app_web/lib/types.ts`, `lib/db.ts`, `lib/supabase.ts`, rotas de `app/api` e `supabase/schema.sql` com migrações. Antes de implementar cada fluxo, conferir o componente web **e** a regra de persistência correspondente. `HomeTab.tsx`, `ColleaguesTab.tsx` e `SelectShareListModal.tsx` não aparecem como fluxos próprios na página principal; não devem virar telas extras sem confirmar uso.

## Inventário de interface e comportamento

| Área | Elementos e estados a copiar | Fluxos e regras que precisam funcionar | Situação no Native |
| --- | --- | --- | --- |
| Entrada e sessão | Login, cadastro, erros, carregamento, retorno de sessão, primeiro acesso | E-mail e senha, Google, confirmação de conta, recuperação/alteração de senha, onboarding e perfil inicial; abrir link compartilhado após login | E-mail e senha básicos; faltam Google, recuperação e onboarding |
| Navegação e visual | Dock de 4 abas, destaque da aba ativa, cartões, ícones, tipografia Poppins, azul `#0943F1`, estados vazios, animações, feedback | Voltar do Android, retorno à aba/lista anterior, teclado e modais, loading/erro, tema claro/escuro, tamanhos de fonte, alto contraste, área segura e acessibilidade | Dock, azul, Poppins e área segura parciais; arquitetura ainda concentrada em `App.tsx` |
| Listas | Abas Em aberto/Finalizadas, busca, filtro e ordenação, cartões com loja/data/progresso/valor/badge, menu contextual, estados vazios | Criar, selecionar, renomear, duplicar, excluir, reabrir, compartilhar; dono versus editor/visualizador; lista ativa; lista compartilhada; restaurar posição após navegação | CRUD e busca básicos; faltam filtros, metadados, menu e regras completas |
| Área de compras | Itens pendentes/comprados por categoria, busca, subtotal/orçamento, loja vinculada, sugestões, adição rápida, quantidade, preço, reordenação, modo mercado | Marcar/desmarcar, editar nome/unidade/categoria/EAN/marca/foto/notas, preço estimado/confirmado, aplicar preços indicados, limpar comprados, desmarcar todos, lixeira de itens com desfazer/restaurar/expiração | Adicionar, marcar e editar nome/quantidade/unidade/preço; demais ações pendentes |
| Compartilhamento | Código/link/QR, pedidos de acesso, notificações, permissões e presença | Aprovação do primeiro acesso, convite para amigo, aceitar/recusar convite, membros com permissão, atualização entre aparelhos e conflitos de edição | Código/link e aprovação básicos; faltam QR, convites, presença e sincronização em tempo real |
| Locais | Busca, lojas da comunidade, mapa, favoritos, categorias, localização/distância, cartões e detalhes, catálogo, ofertas e estatísticas | Permissão de localização, pesquisa, selecionar/vincular loja, criar lista nela, adicionar produto do catálogo, cadastrar fachada com foto e aprovação, cache e falhas de rede | Apenas nomes de locais presentes nas listas |
| Social | Amigos/Rankings, busca de usuários, resultados, solicitações, perfis, lista compartilhada, mural, curtidas e presença | Enviar/aceitar/recusar/remover amizade, compartilhar lista com amigo, aceitar/recusar lista, publicar/filtrar/excluir/curtir no mural, rankings por listas/produtos/preços | Apenas listas recebidas e entrada por código |
| Captura e IA | Scanner nos modos produto, etiqueta, lista, nota fiscal e código de barras; foto/galeria, flash/câmera, revisão de resultados e lote | Detectar EAN, buscar catálogo, OCR, extrair vários itens, corrigir antes de salvar, identificar loja e preços, quota de IA, cancelar e tratar permissões/erros | Não implementado |
| Fechamento de compra | Fluxo de 3 passos: forma de pagamento, nota/recibo, total pago; valor calculado e diferença, pendência fiscal | Pix/débito/crédito/dinheiro, leitura de QR fiscal ou foto, valor validado, loja/CNPJ, gravação coerente em lista + histórico, anexar recibo depois, reabrir | Modal simples de pagamento e histórico; faltam passos 2/3 e comprovantes |
| Histórico e métricas | Histórico, recriar lista, estatísticas por categoria e pagamento, totais, médias, viagens | Consultar registros, expandir detalhes, restaurar uma compra como nova lista, coerência entre histórico e listas finalizadas | Histórico e recriação básicos; estatísticas pendentes |
| Ajustes e conta | Conta/Geral, perfil, avatar/emoji, visibilidade, notificações, tema, fonte, contraste, checkbox, som, vibração, tela acesa, novidades, Pro | Persistir preferências na conta, trocar senha, excluir conta, quota, assinatura, sair e limpar dados da sessão | Perfil básico e sair; demais opções pendentes |

### Inventário de diálogos e superfícies

- **Listas e itens:** `ListManagerModal`, `ItemEditModal`, `BatchImportModal`, `TrashModal`, `UndoDeleteToast`, `LabelPhotoPreviewModal`, `ShareModal`, `JoinListModal`.
- **Locais:** `StorePickerModal`, `StoreDetailsModal`, `NewStoreModal`, `StoreConfirmationModal`.
- **Social:** `FriendDetailsModal`; listas de amigos/acessos também abrem sobreposições dentro de `SocialTab`.
- **Scanner:** `RealtimeScannerModal`, `PhotoScanModal`; `HomeCameraModal` pertence à página pública de entrada, não à tela após login.
- **Compras:** `PaymentModal`/`PaymentMethodModal` (mesmo fluxo), `HistoryModal`, `StatsDetailsModal`.
- **Conta:** `UserProfileModal`, `OnboardingModal`, `ChangelogModal`, `UpgradeProModal`, `LoginModal` (na entrada).
- **Específicos do navegador:** `InstallShortcutModal` é PWA, portanto não vira modal Android; `ListPrintSheet` deve ter equivalente nativo de compartilhar/imprimir. `DialogSurface` vira o componente base nativo de diálogos, com acessibilidade e botão Voltar.

## Lacunas estruturais a resolver antes das telas

1. `caneto-native/App.tsx` contém sessão, navegação, telas, modais e estilos no mesmo arquivo. Extrair rotas, componentes e estado por domínio. Seguir `caneto-native/AGENTS.md`: Expo Router em `src/app/`; não editar `android/` ou `ios/` gerados.
2. `src/data.ts` expõe só parte de `ShoppingList`/`ShoppingItem`. Congelar um contrato compartilhado com todos os campos usados no web, conversores entre `snake_case` do Supabase e modelos nativos, permissões e regras de domínio. Evitar que cada agente invente um tipo diferente.
3. O web usa cache local, reconciliação e sincronização com Supabase (`lib/db.ts`); o Native hoje lê/escreve diretamente. Definir cache local, fila de alterações, exclusões, resolução de conflitos, feedback offline e atualização em tempo real antes de migrar fluxos colaborativos.
4. Centralizar cliente Supabase, chamadas às rotas protegidas do web, upload, autenticação e tratamento de erro. O app não deve conter chave de servidor. Confirmar as migrações efetivamente aplicadas antes de depender de tabela/RPC.
5. Criar tokens para cores, fontes, espaçamento, raios, sombras e ícones; variantes de tema, tamanho de fonte e alto contraste; componentes de modal, campos, botões, cartões, vazio, loading e erro. Capturar telas de referência web em largura de celular para comparação.

## Divisão de trabalho entre agentes

O coordenador integra e mantém os contratos; **até três agentes de implementação em paralelo**, cada um em sua própria worktree. Cada agente altera apenas `src/features/<domínio>/` e testes/artefatos desse domínio. Mudanças em `src/app`, `src/core`, `src/ui`, `package.json`, `app.json` ou no esquema Supabase são propostas ao coordenador e integradas por ele. Nenhum agente deve editar `App.tsx` simultaneamente. Registrar uma matriz de paridade por fluxo: referência web, captura de tela, evento, estado, persistência, permissão, erro e resultado no Native.

| Agente | Responsabilidade exclusiva | Entregáveis verificáveis | Dependência |
| --- | --- | --- | --- |
| 1 — Conta | Login Google/e-mail, cadastro, recuperação, onboarding, perfil, senha, preferências, push e sessão | Entrada/retorno de sessão, perfil e ajustes completos, testes em Android real | Contrato de sessão e UI base |
| 2 — Listas | Lista de listas, filtros, ordenação, cartões, gerenciamento, seleção, código/link/QR e aprovação | CRUD, permissões, compartilhamento e estados vazios equivalentes ao web | Modelos de listas e sincronização |
| 3 — Locais | Busca, mapa, localização, favoritos, categorias, picker, detalhes, catálogo, cadastro de loja | Selecionar/vincular loja, contribuir com foto, usar catálogo e lidar com permissão negada | Cliente de API e modelo de loja |
| 4 — Carrinho | Área de compras, categorias, adição rápida/voz, item detalhado, preços, orçamento, reordenação, lixeira | Todos os gestos/ações de item e desfazer; estado restaurado ao retornar | Agente 2 e modelo de item |
| 5 — Social | Amigos, convites, mural, rankings, notificações, presença | Dois usuários reais conseguem colaborar e ver mudanças/convites | Agente 2 e sincronização |
| 6 — Captura | Câmera, EAN, etiqueta, lista, nota fiscal, galeria, lote, quota de IA | Cinco modos com revisão antes de persistir, permissões e erros | Modelo de item, cliente de API e quota |
| 7 — Compras | Fechamento em 3 passos, recibo, histórico, estatísticas, Pro/checkout | Total e recibos consistentes; reabertura e recriação sem duplicar histórico | Agentes 4 e 6 |
| 8 — Qualidade | Cenários ponta a ponta, acessibilidade, desempenho, comparação visual e regressões | Matriz de paridade preenchida, falhas reproduzíveis, checklist Play Store | Trabalha por ondas; não altera domínio alheio |

### Ondas de execução

1. **Fundação — coordenador:** inventário de telas de referência, contratos, Expo Router, UI base, sessão, camada de dados/offline, ambientes e critérios de teste. Congelar interfaces antes da primeira onda. Gate: app abre, navega, restaura sessão e mostra dados da conta sem regressão.
2. **Onda A — agentes 1, 2 e 3:** Conta, Listas e Locais em paralelo. Integrar cada módulo ao final da onda. Gate: login, listas e seleção de locais funcionam em Android com a mesma conta do web.
3. **Onda B — agentes 4, 5 e 6:** Carrinho, Social e Captura. Reutilizar os modelos da fundação, sem alterar arquivos de outro agente. Gate: colaboração entre duas contas, compra manual completa e cinco modos de captura revisados.
4. **Onda C — agentes 7 e 8:** Compras/Pro e verificação ponta a ponta. Coordenador resolve dependências e integra. Gate: pagamento, recibo, histórico, estatísticas e regressões aprovados.
5. **Fechamento — coordenador:** comparação visual por tela/modal, erros, acessibilidade, desempenho, testes em Expo Go quando compatível e em build de desenvolvimento para módulos nativos, build Android e preparação da Play Store.

## Regras de integração e aceite

- **Paridade de comportamento:** para cada ação, testar estado inicial, resultado, cancelamento, falha de rede, permissão negada, conta sem acesso, reabertura do app e sincronização no web. Modais devem fechar pelo botão, toque fora quando apropriado e Voltar do Android, sem perder dados não salvos sem aviso.
- **Paridade visual:** comparar capturas na mesma largura, com critérios para Poppins, cores, espaçamentos, raios, ícones, contraste e teclado. Manter páginas sem título/cabeçalho fixo; modal pode ter título. Respeitar barra de status e gesto inferior.
- **Persistência:** toda mutação deve ter regra única de domínio; validar RLS com usuário dono, editor e visualizador. Testar duas contas e dois aparelhos para compartilhamento. Evitar escrita parcial entre lista, itens e histórico.
- **Qualidade:** lint e `tsc --noEmit`, testes de domínio para conversão/sincronização, testes dos fluxos críticos em Android real e bundle Android limpo. Não considerar “100%” só porque o modal existe: controles precisam executar o mesmo fluxo e atualizar os mesmos dados.
- **Entrega por agente:** PR/branch isolada, lista de telas/ações cobertas, evidência visual, testes executados, riscos e itens que ainda divergem do web. O coordenador marca o fluxo como concluído somente após integração e teste cruzado.

## Primeiro lote de tickets

1. Extrair `App.tsx` para rotas e layout sem alterar o fluxo atual.
2. Criar contrato `List`, `Item`, `Purchase`, `Profile`, `Store` e adaptadores Supabase; documentar campos e permissões.
3. Registrar capturas de referência de cada aba e de cada modal ativo.
4. Validar fluxo de login Google nativo e retorno de links de lista.
5. Corrigir exclusão de item para lixeira/desfazer (concluído) e fechamento de compra para os três passos do web.
6. Implementar Locais como fonte real de lojas, não apenas nomes extraídos das listas.
7. Implementar Social com amigos, notificações, mural e rankings.
8. Implementar scanner em cinco modos e a quota de IA com a API existente.

O Native atual oferece uma base útil, mas **não tem paridade total**. Este plano prioriza o contrato de dados e a integração entre módulos para que o trabalho paralelo não produza versões visualmente parecidas com comportamento incompatível.
