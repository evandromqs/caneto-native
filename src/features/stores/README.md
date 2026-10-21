# Locais: primeira entrega da Onda A

## Integração pelo coordenador

- Renderizar `<StoreExplorer />` na aba Locais. Recebe `coordinates?: { lat, lng }` quando o app já tiver permissão de localização; sem coordenadas oferece busca textual e categorias. `onSelectStore` é opcional para um fluxo de exploração.
- Renderizar `<StorePickerModal visible listId onClose onLinked selectedStoreId />` para vincular/desvincular uma lista. `onLinked` deve atualizar o cache/lista após a escrita Supabase.
- `StoreDetailsModal` e `searchStores` também são exportados para fluxos de seleção futuros.
- A API de locais usa `EXPO_PUBLIC_CANETO_API_URL` ou, por padrão, `https://caneto.online`. É apenas a URL do servidor web; a chave Google Places continua no servidor. Confirmar domínio de produção e disponibilidade de `GET /api/places` antes do release.

## Dados e limites

- Busca Google Places através da rota pública do web, lojas aprovadas em `store_submissions` (RLS), catálogo em `store_prices` (RLS). Erro da API não impede mostrar lojas aprovadas. Não usa chave de servidor no app.
- `linkStoreToList` grava `store_id`, `store_name`, `store_address`, `updated_at` da lista. A política de escrita é aplicada pelo Supabase; testar dono/editor/visualizador.
- Mapa e GPS exigem decisão do coordenador sobre dependências Expo compatíveis com SDK 57 e autorização de permissão Android. Até lá o módulo aceita coordenadas do app e abre Google Maps por link externo.
- Cadastro com foto e aprovação de loja, favoritos, ofertas calculadas a partir do histórico, adicionar catálogo diretamente à lista e cache offline ainda não estão nesta primeira entrega.

## Paridade visual ainda pendente

- `StoresTab` no web mostra mapa interativo entre a busca e os cartões. O Native mostra busca, filtros e cartões; a área de mapa aguarda componente e permissão de localização nativos.
- Os cartões web exibem favorito, frescor e destaque do menor preço do produto buscado. A primeira versão Native mostra nome, categoria, distância, avaliação e endereço; faltam esses três adornos porque dependem dos dados de histórico/catálogo e de favoritos.
- `StoreDetailsModal` web também tem aba Gráficos, ações de catálogo para adicionar itens e outros estados por modo. O Native apresenta Catálogo/Informações e ação de seleção; gráficos e ações de catálogo aguardam contrato com carrinho.
- Comparação em capturas de Android real e web na mesma largura ainda não foi executada. A interface atual segue hierarquia, cores e tipografia do código web, mas não deve ser marcada como paridade visual completa.
