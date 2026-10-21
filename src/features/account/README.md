# Conta no app nativo

## Integração

1. Renderize `AccountAuthActions` na tela de login existente. O botão Google chama `signInWithGoogle`; o botão de recuperação solicita e-mail.
2. Monte `useAccountRedirect(onResult, onError)` uma vez no layout raiz. Se `onResult` receber `kind: 'recovery'`, mostre `RecoveryPasswordForm` para definir a nova senha. Se receber `kind: 'signed-in'`, recarregue a sessão e siga para a tela inicial.
3. Use `loadAccountProfile`, `saveAccountProfile`, `isUsernameAvailable`, `completeOnboarding` e `updatePreferences` para perfil, ajustes e guia inicial. A atualização preserva preferências existentes.

## Configuração externa necessária

- O app já declara `scheme: "caneto"` em `app.json`. O callback calculado por `makeRedirectUri({ scheme: 'caneto', path: 'auth/callback' })` precisa ser verificado na build instalada; espera-se `caneto://auth/callback`.
- No painel do Supabase, habilite o provedor Google e configure as credenciais OAuth do Google para o mesmo projeto usado pelo web. Adicione `caneto://auth/callback` em **Authentication → URL Configuration → Redirect URLs**. O callback do provedor Google aponta para o endpoint de Auth do Supabase informado no painel, não diretamente para o scheme do app.
- Instale uma **development build** para testar Google OAuth e o retorno do link de recuperação. O Expo Go não permite testar de modo confiável o redirecionamento OAuth com scheme customizado. A solicitação do e-mail de recuperação é possível no Expo Go, mas a abertura do link no app também deve ser validada na build.
- O cliente Supabase atual usa o fluxo padrão de sessão. O callback aceita tokens de sessão e código PKCE. Se `src/supabase.ts` passar a configurar `flowType: 'pkce'`, manter o armazenamento persistente do verificador entre a abertura do navegador e o retorno.

Referências: [Expo Authentication](https://docs.expo.dev/guides/authentication/), [Expo SDK 57 AuthSession](https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/), [Supabase Mobile Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking/).
