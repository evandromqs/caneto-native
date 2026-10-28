# Atualizações Android pelo GitHub

O APK publicado pelo fluxo `Build & Release Android APK` exige quatro segredos do repositório: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`. O build falha se algum estiver ausente. Use uma chave permanente e guarde uma cópia privada do arquivo e das senhas fora do repositório.

A chave criada para este projeto está em `.signing/caneto-release.jks`, e os dados de recuperação estão em `.signing/credentials.txt`. Ambos são ignorados pelo Git. Faça uma cópia segura dos dois arquivos; perder a chave ou a senha impede publicar futuras atualizações com a mesma assinatura.

`app.json`, `package.json` e `package-lock.json` são a fonte de verdade da versão. Antes de uma nova versão nativa, incremente `expo.version`, `android.versionCode` e os dois arquivos do npm no mesmo commit. O workflow só publica quando uma tag `vMAJOR.MINOR.PATCH` corresponde exatamente à versão do projeto, ou quando for iniciado manualmente. O app consulta primeiro o endpoint cacheado `https://caneto.online/api/app-version` e usa a API pública do GitHub apenas como contingência. O botão de atualização abre o navegador para baixar o APK, que o usuário abre e instala pelo Android.

**Atenção à migração:** os APKs anteriores (`v1.0.4` e `v1.0.5`) foram gerados com a configuração de assinatura de debug do Gradle. Um APK assinado com a nova chave permanente não pode ser instalado por cima deles. Antes de desinstalar a versão antiga, confirme que os dados necessários foram sincronizados com a conta. A primeira instalação da nova assinatura exigirá a remoção do app antigo; depois, novas versões com a mesma chave poderão atualizar normalmente.

Para configurar o repositório, autentique o GitHub CLI com acesso de administrador, crie ou recupere uma chave Android permanente, codifique o arquivo em Base64 e cadastre os quatro segredos em **Settings → Secrets and variables → Actions**. Não use uma chave temporária por execução. Se já existir uma chave de publicação ou de distribuição interna, use essa mesma chave quando apropriado. Nunca envie a chave ou as senhas ao Git.

O APK do GitHub é um canal de distribuição fora da Play Store. Instalações feitas pela Play Store seguem o esquema de assinatura e atualização da loja e podem ter certificado diferente.

O workflow executa lint, verificação de tipos e testes de sincronização antes do build. Uma fila de concorrência impede duas releases Android simultâneas, e cada release inclui um arquivo `.sha256` ao lado do APK.

Atualizações que alteram somente JavaScript ou assets devem usar o EAS Update descrito em `docs/eas-update.md`. Alterações de dependências nativas, plugins, permissões ou configuração nativa exigem uma nova versão e um novo APK.
