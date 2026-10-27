const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withGithubReleaseSigning(config) {
  if (process.env.CANETO_GITHUB_RELEASE_SIGNING !== '1') return config;

  return withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Assinatura GitHub requer build.gradle em Groovy.');
    let source = mod.modResults.contents;
    const configs = '    signingConfigs {\n        debug {';
    if (!source.includes(configs)) throw new Error('Bloco signingConfigs do Android mudou.');
    source = source.replace(configs, `    signingConfigs {
        release {
            storeFile file(System.getenv('CANETO_RELEASE_KEYSTORE_PATH'))
            storePassword System.getenv('CANETO_RELEASE_STORE_PASSWORD')
            keyAlias System.getenv('CANETO_RELEASE_KEY_ALIAS')
            keyPassword System.getenv('CANETO_RELEASE_KEY_PASSWORD')
        }
        debug {`);
    const release = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!release.test(source)) throw new Error('Configuração release do Android mudou.');
    source = source.replace(release, '$1signingConfig signingConfigs.release');
    mod.modResults.contents = source;
    return mod;
  });
};
