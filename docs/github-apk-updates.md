# Atualizações Android pelo GitHub

O APK publicado pelo fluxo `Build & Release Android APK` exige quatro segredos do repositório: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`. O build falha se algum estiver ausente. Use uma chave permanente e guarde uma cópia privada do arquivo e das senhas fora do repositório.

A chave criada para este projeto está em `.signing/caneto-release.jks`, e os dados de recuperação estão em `.signing/credentials.txt`. Ambos são ignorados pelo Git. Faça uma cópia segura dos dois arquivos; perder a chave ou a senha impede publicar futuras atualizações com a mesma assinatura.

O fluxo usa o número da execução como `versionCode` e último componente da versão. O nome da release e a versão gravada no APK passam a corresponder. O app consulta a release pública mais recente; em caso de erro de rede, mostra um erro na verificação manual. O botão de atualização abre o navegador para baixar o APK, que o usuário abre e instala pelo Android.

**Atenção à migração:** os APKs anteriores (`v1.0.4` e `v1.0.5`) foram gerados com a configuração de assinatura de debug do Gradle. Um APK assinado com a nova chave permanente não pode ser instalado por cima deles. Antes de desinstalar a versão antiga, confirme que os dados necessários foram sincronizados com a conta. A primeira instalação da nova assinatura exigirá a remoção do app antigo; depois, novas versões com a mesma chave poderão atualizar normalmente.

Para configurar o repositório, autentique o GitHub CLI com acesso de administrador, crie ou recupere uma chave Android permanente, codifique o arquivo em Base64 e cadastre os quatro segredos em **Settings → Secrets and variables → Actions**. Não use uma chave temporária por execução. Se já existir uma chave de publicação ou de distribuição interna, use essa mesma chave quando apropriado. Nunca envie a chave ou as senhas ao Git.

O APK do GitHub é um canal de distribuição fora da Play Store. Instalações feitas pela Play Store seguem o esquema de assinatura e atualização da loja e podem ter certificado diferente.
