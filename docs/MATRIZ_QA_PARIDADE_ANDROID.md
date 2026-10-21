# Matriz de QA: Caneto web → Android

Estado em 20/10/2026. Esta é uma **análise de código**, não um resultado de teste em aparelho. `Parcial` significa que há uma ação correspondente no Native, mas faltam estados ou regras do web. `Ausente` significa que não há fluxo acessível no Native. Atualizar a coluna de resultado com evidência de execução antes de declarar paridade.

## Referências e uso

- Web: `../../caneto_app_web/app/app/page.tsx` conecta abas, diálogos, eventos e persistência; componentes em `../../caneto_app_web/components/tabs/` e `../../caneto_app_web/components/` detalham a interface.
- Native: `App.tsx`, `src/data.ts`, `src/features/*`, `src/ui/ModalSheet.tsx`.
- Backend: `../../caneto_app_web/lib/db.ts`, `../../caneto_app_web/lib/types.ts`, `../../caneto_app_web/supabase/schema.sql` e migrações. Confirmar no projeto Supabase **quais migrações estão aplicadas**; a existência do arquivo SQL não prova que a produção já o executou.
- Cada caso deve ganhar: aparelho/Android, build/commit, conta usada, estado inicial, passos, resultado esperado/obtido, captura ou vídeo, requisição ou linha de banco quando aplicável, e defeito vinculado.

### Prioridade e regra de aceite

- **P0:** perda de dados, autorização, sessão, compra, sincronização entre usuários, crash ou navegação bloqueada. Impede a onda de ser aceita.
- **P1:** fluxo principal ou modal com comportamento incompleto, erro não tratado, acessibilidade básica. Impede declarar paridade da área.
- **P2:** refinamento visual, feedback, animação, estados secundários. Impede declarar paridade visual.
- Um caso passa somente após verificar ação feliz, cancelamento, falha, persistência após reinício e reflexo no web quando houver gravação. Para ações compartilhadas, verificar também em uma segunda conta.

## Ambiente e dados de teste

| ID | Preparação verificável | Motivo |
| --- | --- | --- |
| D1 | Duas contas de teste independentes: A dona; B convidada; terceira conta C sem acesso. Registrar IDs sem colocar credenciais no documento. | RLS, convites, pedidos, permissões e isolamento. |
| D2 | A possui lista vazia, lista com 3+ itens de categorias e preços distintos, lista finalizada, lista compartilhada com B como editor e outra como visualizador. | Listas, carrinho, totais, filtros e histórico. |
| D3 | Lista com código e pedido pendente de B; amizade A↔B, solicitação pendente, postagem de mural e notificação. | Compartilhamento e Social. |
| D4 | Loja aprovada com localização, foto, catálogo/preços; outra loja pendente; favoritos. | Locais, seleção, mapa e moderação. |
| D5 | Compra com Pix e recibo/foto; outra sem recibo; QR fiscal válido e inválido em fixtures sem dados pessoais reais. | Fechamento, scanner e histórico. |
| D6 | Android físico com câmera/localização, segundo Android ou sessão web simultânea; rede normal, desligada e instável; fonte do sistema padrão e ampliada. | Permissões, colaboração, offline, layout e desempenho. |
| D7 | Build Expo Go compatível e build de desenvolvimento quando uma dependência nativa exigir; registrar qual foi usada. | Evita aceitar algo que só funciona em um ambiente. |

## Navegação, sessão e interface base

| ID/P | Cenário e resultado esperado no Android | Referência web → Native | Estado no código |
| --- | --- | --- | --- |
| N01 P0 | Login com e-mail, cadastro, senha errada, conta não confirmada e retorno da sessão após fechar/reabrir; mensagens claras, sem dados de outra conta. | `app/login/page.tsx`, `app/app/page.tsx` (sessão) → `App.tsx` (autenticação) | Parcial |
| N02 P1 | Login Google e retorno ao app; recuperação/troca de senha; link de lista recebido abre destino após autenticação. | `app/login/page.tsx`, `components/LoginModal.tsx`, `app/app/page.tsx` → sem fluxo nativo equivalente | Ausente |
| N03 P1 | Primeiro acesso e onboarding; sair/cancelar e completar conservam perfil/preferências corretamente. | `components/OnboardingModal.tsx`, `app/app/page.tsx` → sem modal nativo | Ausente |
| N04 P0 | Quatro abas e retorno à lista: Voltar fecha modal primeiro, sai da lista selecionada depois e preserva aba/posição; sem sair inesperadamente. | `components/BottomNav.tsx`, `app/app/page.tsx` → `App.tsx`, `src/ui/ModalSheet.tsx` | Parcial |
| N05 P1 | Barra de status, recorte de câmera e gesto inferior não cobrem controles; teclado não esconde ação principal; sem cabeçalho fixo nem título nas páginas pós-login. | `app/app/page.tsx` e tabs → `App.tsx`, `ModalSheet.tsx` | Parcial; medir em aparelhos |
| N06 P1 | Modal fecha por X, Voltar e toque fora quando adequado; validação/erro preservam rascunho; cancelar ação destrutiva não grava. | `components/DialogSurface.tsx` e cada modal → `ModalSheet.tsx` | Parcial |
| N07 P1 | Sem conexão: erro visível, nova tentativa e nenhum falso sucesso; ao reconectar, estado coerente no web e Native. | `lib/db.ts`, `app/app/page.tsx` → `src/data.ts` (leitura direta) | Ausente para fila/cache |
| N08 P2 | Capturas de cada aba/modal na mesma largura: Poppins, `#0943F1`, superfícies, ícones, raios, espaçamentos, estados vazios, tema, fonte ampliada/contraste. | `app/layout.tsx`, tabs e modais → `src/ui/theme.ts`, `App.tsx` | Parcial; sem evidência visual |

## Listas, itens e compartilhamento

| ID/P | Cenário e resultado esperado no Android | Referência web → Native | Estado no código |
| --- | --- | --- | --- |
| L01 P1 | Em aberto/Finalizadas, busca por nome/loja/produto, limpar busca, filtro/ordenação e estados vazios; contagens consistentes. | `components/tabs/ListsTab.tsx` → `App.tsx` | Parcial: abas e nome; faltam filtro/ordem/busca ampla |
| L02 P0 | Criar, abrir, renomear, duplicar, finalizar, reabrir e excluir lista; cancelar exclusão; conferir itens e dono no banco/web após reinício. | `ListsTab.tsx`, `ListManagerModal.tsx`, `app/app/page.tsx` → `ListModals.tsx`, `lists/repository.ts` | Parcial |
| L03 P1 | Cartão mostra loja, atualização, progresso, total, dono/compartilhamento e comprovante/QR quando existir; toque no menu não abre lista. | `ListsTab.tsx` → `App.tsx` | Parcial |
| L04 P0 | Editor pode editar; visualizador não altera itens/lista; conta C sem acesso não lê nem grava por consulta direta. | `app/app/page.tsx`, `lib/db.ts`, RLS → `src/data.ts`, `lists/repository.ts` | Parcial; exigir ensaio RLS |
| L05 P0 | Adicionar item, marcar/desmarcar, editar quantidade/unidade/preço; valores e progresso atualizam no outro cliente e persistem. | `app/app/page.tsx`, `components/ShoppingListView.tsx`, `components/ItemRow.tsx` → `App.tsx`, `ListModals.tsx` | Parcial |
| L06 P1 | Editar categoria, EAN, marca, notas, foto da etiqueta, preço estimado/confirmado; validar campos e reabrir item. | `components/ItemEditModal.tsx` → `ListModals.tsx` | Parcial: apenas nome/quantidade/unidade/preço |
| L07 P1 | Busca de itens, categorias, sugestões, reordenação, orçamento, subtotal e modo mercado permanecem ao voltar à lista. | `app/app/page.tsx` (handlers de itens), área de lista web → `App.tsx` | Ausente ou parcial básico |
| L08 P0 | Excluir item mostra desfazer; após expiração vai à lixeira; restaurar item/todos e esvaziar respeitam autorização e sincronização. | `components/TrashModal.tsx`, `UndoDeleteToast`, `app/app/page.tsx` → `src/ui/UndoDeleteToast.tsx`, `src/features/cart/TrashModal.tsx`, `src/features/cart/trashRepository.ts`, `ShoppingListScreen.tsx` | Implementado (toast animado de 5s com desfazer, retenção de 6h, restauração individual e total no Supabase, esvaziar com confirmação) |
| L09 P1 | Limpar comprados e desmarcar todos pedem confirmação quando aplicável, atualizam totais e permitem recuperação conforme web. | `app/app/page.tsx` (handlers) → sem ações nativas | Ausente |
| L10 P0 | Compartilhar link/código/QR; B solicita acesso; A aprova/recusa; B recebe permissão correta; C não vê dados; reentrada mantém acesso. | `components/ShareModal.tsx`, `JoinListModal.tsx`, migrações de aprovação → `SharingModals.tsx`, `sharing/repository.ts` | Parcial: código/link/pedido/aprovação; faltam QR e permissões completas |
| L11 P0 | Duas contas editam a mesma lista e veem mudança, presença e conflito sem sobrescrever dado mais recente. | `app/app/page.tsx` (presence/sync), `lib/db.ts` → `App.tsx` (refresh manual) | Ausente |
| L12 P1 | Compartilhar/imprimir lista pelo recurso Android mantém itens, quantidades e totais legíveis. | `components/ListPrintSheet.tsx` → sem equivalente nativo | Ausente |
| L13 P1 | Importação em lote valida prévia e salva itens uma vez; cancelar não cria nada. | `components/BatchImportModal.tsx` → sem equivalente nativo | Ausente |

## Locais, Social e captura

| ID/P | Cenário e resultado esperado no Android | Referência web → Native | Estado no código |
| --- | --- | --- | --- |
| P01 P1 | Buscar loja por nome/categoria, listar próximas, mapa, distância e favorito; permissão de localização aceita/negada e sem GPS. | `components/tabs/StoresTab.tsx`, mapa → `App.tsx` | Ausente: lista apenas nomes ligados a listas |
| P02 P1 | Detalhes de loja exibem foto, catálogo, preços/ofertas/métricas; selecionar loja existente ou criar lista nela; item de catálogo entra no carrinho correto. | `StoreDetailsModal.tsx`, `StorePickerModal.tsx`, `StoresTab.tsx` → sem equivalente nativo | Ausente |
| P03 P1 | Cadastrar loja com localização/foto; confirmação de envio e estado pendente/aprovado, sem aparecer como aprovada antes da moderação. | `NewStoreModal.tsx`, `StoreConfirmationModal.tsx`, migração de store submissions → sem equivalente | Ausente |
| S01 P0 | Buscar usuário, enviar/aceitar/recusar/cancelar solicitação, abrir detalhes, remover amizade; A e B veem mesmo estado. | `components/tabs/SocialTab.tsx`, `FriendDetailsModal.tsx` → `App.tsx` | Ausente |
| S02 P0 | Convite/lista compartilhada chega como notificação; aceitar/recusar; compartilhar com amigo; lista acessada abre com permissão e dono corretos. | `SocialTab.tsx`, `FriendDetailsModal.tsx` → `App.tsx`, `SharingModals.tsx` | Parcial: entrada por código e listas já acessíveis |
| S03 P1 | Mural: publicar por categoria, filtrar, curtir/descurtir, excluir própria postagem; rankings por categoria; presença de amigo. | `SocialTab.tsx` → sem equivalente nativo | Ausente |
| C01 P0 | Scanner produto/EAN, etiqueta, lista, nota fiscal e QR: pedir câmera, negar permissão, alternar câmera/flash, cancelar sem salvar, revisar resultado antes de gravar. | `RealtimeScannerModal.tsx`, `PhotoScanModal.tsx`, `app/app/page.tsx` → sem equivalente nativo | Ausente |
| C02 P0 | Galeria/foto e importação de vários itens evitam duplicação; valores/loja da nota conferidos; QR inválido/sem rede oferece erro recuperável. | `PhotoScanModal.tsx`, `BatchImportModal.tsx`, `lib/scanner/*` → sem equivalente nativo | Ausente |
| C03 P1 | Quota de IA e Pro: limite, mensagem, retry e bloqueio coerentes com conta e backend; não chamar serviço com chave privada no app. | `lib/quotas.ts`, `UpgradeProModal.tsx`, APIs do web → sem equivalente nativo | Ausente |

## Compra, histórico e ajustes

| ID/P | Cenário e resultado esperado no Android | Referência web → Native | Estado no código |
| --- | --- | --- | --- |
| B01 P0 | Fechar compra nos três passos: método, recibo/nota ou pendência, total pago; conferir divergência do calculado, validação e cancelamento em cada etapa. | `components/PaymentMethodModal.tsx`, `app/app/page.tsx` → `PurchaseModals.tsx` | Parcial: somente método e total calculado |
| B02 P0 | Gravação de lista finalizada e histórico é coerente mesmo com falha de rede entre operações; reabrir não duplica histórico; recibo pode ser anexado depois. | `app/app/page.tsx`, `lib/db.ts`, `purchase_history` → `purchases/repository.ts` (duas escritas) | Parcial; risco de escrita parcial a testar |
| B03 P1 | Histórico mostra detalhes, loja, forma, valores, recibo; recriar como nova lista sem modificar a compra antiga. | `HistoryModal.tsx` → `PurchaseModals.tsx` | Parcial: lista e recriação básicas |
| B04 P1 | Estatísticas por período/categoria/pagamento batem com histórico e respeitam mudanças de conta. | `StatsDetailsModal.tsx` → sem equivalente nativo | Ausente |
| A01 P1 | Perfil: nome, usuário, avatar/emoji, visibilidade, foto; validação, salvar e recarregar entre web e Android. | `UserProfileModal.tsx` → `ProfileModal.tsx` | Parcial: conferir campos implementados |
| A02 P1 | Ajustes: tema claro/escuro/sistema, fonte, alto contraste, estilo de checkbox, tela ativa, som, vibração, push; persistem após reinício e refletem na interface. | `components/tabs/SettingsTab.tsx` → `App.tsx` | Ausente |
| A03 P1 | Novidades, rever onboarding, quota/Pro, trocar senha/excluir conta e sair; confirmar ações destrutivas e apagar dados locais da sessão. | `SettingsTab.tsx`, `ChangelogModal.tsx`, `UpgradeProModal.tsx`, `UserProfileModal.tsx` → `App.tsx`, `ProfileModal.tsx` | Parcial: perfil e sair |

## Inventário de modais por gatilho

`Ativo` abaixo significa que há gatilho no fluxo pós-login web (`app/app/page.tsx` ou aba renderizada); não implica que todo gatilho já foi exercitado manualmente. Para cada linha: abrir pelo gatilho, conferir conteúdo/controle, cancelar, confirmar, erro, Voltar, teclado, área segura e persistência.

| Grupo | Superfícies web ativas | Native atual |
| --- | --- | --- |
| Listas/itens | `ListManagerModal`, edição/criação/filtro de `ListsTab`, `ItemEditModal`, `BatchImportModal`, `TrashModal`, `UndoDeleteToast`, `ShareModal`, `JoinListModal`, `ListPrintSheet` | `NewListModal`, `ListEditModal`, `ItemEditModal`, `ShareListModal`, `JoinListModal`, `TrashModal`, `UndoDeleteToast`; demais ausentes |
| Locais | `StorePickerModal`, `StoreDetailsModal`, `NewStoreModal`, `StoreConfirmationModal` | Ausentes |
| Social | `FriendDetailsModal`, sobreposições de amigos/listas e solicitações em `SocialTab` | Ausentes; código de lista em Social |
| Captura | `RealtimeScannerModal`, `PhotoScanModal`, `BatchImportModal` | Ausentes |
| Compra | `PaymentMethodModal`, `HistoryModal`, `StatsDetailsModal` | `PaymentModal`, `HistoryModal` parciais; estatísticas ausentes |
| Conta | `UserProfileModal`, `OnboardingModal`, `ChangelogModal`, `UpgradeProModal` | `ProfileModal` parcial; demais ausentes |

`InstallShortcutModal` é específico de PWA e não precisa de cópia Android. `HomeCameraModal` está na entrada pública, fora do escopo pós-login deste plano. `DialogSurface` serve como referência de semântica para todos os modais nativos.

## Execução por onda e evidência mínima

1. **Fundação:** N01, N04–N08 e D1–D7. Registrar screenshots das quatro abas web e Native, mais os modais nativos existentes. Conferir login, sessão, status bar, Voltar e erro offline antes de paralelizar. Gate: sem P0 aberto nessas áreas.
2. **Onda A:** N02–N03, L01–L04, L10 e P01–P03. Evidência de duas contas, pedido/aprovação e seleção de loja vista no web. Gate: conta, listas e locais persistem corretamente.
3. **Onda B:** L05–L09, L11–L13, S01–S03 e C01–C03. Evidência de duas sessões simultâneas, foto/QR de fixture e negativa de permissão. Gate: carrinho, colaboração e captura sem perda/duplicação.
4. **Onda C:** B01–B04 e A01–A03. Evidência de valores antes/depois no histórico, fechamento com/sem recibo, configurações após reinício. Gate: compra e conta coerentes em web/Android.
5. **Fechamento:** repetir todos os P0 em build Android de release; capturar comparação visual na mesma densidade/largura; verificar leitor de tela, áreas de toque, fonte ampliada, teclado, performance com 100+ itens e lista compartilhada em rede instável. Registrar aprovação por fluxo, não por tela.

### Modelo de resultado por caso

`ID | build/commit | aparelho/Android | conta/dados | passos | esperado | observado | status (passou/falhou/bloqueado) | evidência | defeito`

Um caso `bloqueado` precisa indicar o pré-requisito faltante (migração, conta, fixture, permissão ou build), sem ser contado como aprovado.
