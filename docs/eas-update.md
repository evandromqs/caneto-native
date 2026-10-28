# EAS Update no Caneto

O Caneto usa dois mecanismos complementares de atualização:

- **EAS Update:** entrega JavaScript e assets compatíveis para um aplicativo já instalado.
- **GitHub APK:** entrega uma nova camada nativa, incluindo bibliotecas, permissões, plugins e versões do Expo/React Native.

## Como a seleção funciona

Cada APK contém três identificadores gravados no build:

1. plataforma (`android` ou `ios`);
2. canal (`preview`, `staging` ou `production`);
3. `runtimeVersion`, derivada de `expo.version` pela política `appVersion`.

Uma atualização EAS só é oferecida quando os três valores coincidem. O APK publicado pelo GitHub é criado fora do EAS Build, por isso `app.json` grava explicitamente o canal `production` em `updates.requestHeaders`. Builds feitos pelos perfis do `eas.json` recebem o canal correspondente ao perfil.

Com `fallbackToCacheTimeout: 0`, o app abre imediatamente com a versão embarcada ou com a atualização já baixada. Em paralelo, verifica e baixa uma atualização compatível. A atualização baixada passa a rodar na próxima abertura do aplicativo.

## Regra para decidir o tipo de entrega

Use EAS Update quando a mudança afetar somente:

- componentes, telas, regras em TypeScript/JavaScript;
- textos, estilos, imagens e outros assets;
- chamadas de API que continuam compatíveis com o runtime instalado.

Crie um novo APK quando houver:

- instalação, remoção ou atualização de pacote com código nativo;
- alteração em `app.json` que mude permissões, plugins ou configuração nativa;
- atualização do Expo SDK ou React Native;
- mudança de schema local que não seja retrocompatível com os APKs instalados.

Ao criar um APK, incremente `expo.version`, `android.versionCode`, `package.json` e `package-lock.json` no mesmo commit. Como a política é `appVersion`, esse incremento cria um novo runtime e impede que atualizações destinadas ao APK novo sejam carregadas por APKs antigos.

## Publicação controlada

O workflow `Publish EAS Update` é manual e oferece os canais `preview`, `staging` e `production`. Antes de enviar, ele executa lint, TypeScript e os testes de sincronização.

Configure no repositório GitHub:

- `EXPO_TOKEN` de uma conta com acesso ao projeto Expo.

No painel do Expo, cadastre `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` e `EXPO_PUBLIC_CANETO_API_URL` nos ambientes `preview` e `production`. O SDK 57 usa apenas as variáveis do ambiente EAS selecionado durante `eas update`; variáveis do GitHub Actions não substituem essa configuração. O canal `staging` reutiliza o ambiente `preview`, evitando depender de ambientes personalizados que exigem planos específicos.

Fluxo recomendado:

1. publicar em `preview` e testar em um build preview;
2. promover o mesmo commit para `staging`;
3. publicar em `production` somente após a validação;
4. acompanhar adoção e falhas no painel de Deployments do Expo;
5. em caso de regressão, executar rollback ou republicar a atualização estável anterior.

## Primeira ativação

O APK v1.0.7 e anteriores não contêm o módulo nativo `expo-updates`. A primeira versão capaz de receber EAS Update será a v1.0.8. Portanto, a v1.0.8 precisa ser publicada e instalada como APK antes que qualquer atualização EAS de runtime `1.0.8` possa chegar aos aparelhos.
