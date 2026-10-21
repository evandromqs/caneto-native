# Caneto Native

Aplicativo Expo/React Native do Caneto. Usa o mesmo projeto Supabase do Caneto web.

## Iniciar

1. Copie `.env.example` para `.env.local` e preencha a URL e a chave **pública** do Supabase. `EXPO_PUBLIC_CANETO_API_URL` aponta para a API web de locais. Neste workspace o `.env.local` já foi preparado a partir da configuração pública do projeto web. Nunca use a service role key no app.
2. Execute `npm install` e `npx expo start --clear`. O projeto usa Expo SDK 57, compatível com o Expo Go distribuído na Play Store nesta fase de transição do SDK 58.
3. Abra com Expo Go no Android ou use um emulador.

Esta versão inclui login por e-mail, solicitação de recuperação de senha, tela de redefinição por link e integração inicial com Google OAuth. O Google e o retorno do link exigem uma build de desenvolvimento para teste confiável; consulte `src/features/account/README.md` para a configuração de redirecionamento no Supabase. A tela após o login tem Listas, Locais, Social e Ajustes. Listas agora inclui busca, ordenação, cartões com progresso e gerenciador; Locais inclui busca, categorias, detalhes, preços da comunidade e vínculo com a lista. Os fluxos já existentes de itens, histórico, compartilhamento e perfil continuam disponíveis. Os contratos completos ficam em `src/core`, a interface compartilhada em `src/ui` e os módulos em `src/features`.

O aplicativo usa Poppins, a paleta azul do Caneto e área segura para que a interface não invada a barra de status do Android. As páginas após o login não têm títulos ou cabeçalhos fixos.

O Caneto web guarda alterações offline no armazenamento do navegador e depois as sincroniza com o Supabase; dados que ainda existem só naquele navegador não aparecem no app nativo. Abra o web conectado e aguarde a sincronização antes de comparar. Ainda falta migrar partes do projeto web para atingir paridade total: GPS e mapa nativo, cadastro de locais, amizades e rankings, leitor de câmera, importação, comprovantes no histórico, lixeira, estatísticas e assinatura Pro. A navegação ainda usa uma tela ponte em `src/app/index.tsx`; a separação completa das rotas e o cache offline fazem parte da fundação pendente. O plano e a matriz de verificação estão em `docs/PLANO_PARIDADE_COM_AGENTES.md` e `docs/MATRIZ_QA_PARIDADE_ANDROID.md`.
