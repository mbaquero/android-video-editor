// Signs Android release builds with the upload key described by the Gradle properties
// UPLOAD_STORE_FILE, UPLOAD_KEY_ALIAS, UPLOAD_STORE_PASSWORD and UPLOAD_KEY_PASSWORD
// (keep them in ~/.gradle/gradle.properties, never in the repo). Without them, release
// builds fall back to the debug key and Gradle prints a warning.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// @generated withReleaseSigning';

const RELEASE_SIGNING_CONFIG = `
        ${MARKER}
        if (project.hasProperty('UPLOAD_STORE_FILE')) {
            release {
                storeFile file(UPLOAD_STORE_FILE)
                storePassword UPLOAD_STORE_PASSWORD
                keyAlias UPLOAD_KEY_ALIAS
                keyPassword UPLOAD_KEY_PASSWORD
            }
        }`;

const RELEASE_SIGNING_SELECTION = `if (project.hasProperty('UPLOAD_STORE_FILE')) {
                signingConfig signingConfigs.release
            } else {
                logger.warn('UPLOAD_STORE_FILE not set: signing the release build with the debug key.')
                signingConfig signingConfigs.debug
            }`;

function addReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  const debugSigning = /(signingConfigs \{\s*debug \{[^}]*\})/;
  if (!debugSigning.test(gradle)) {
    throw new Error('withReleaseSigning: could not find signingConfigs.debug in app/build.gradle');
  }
  let result = gradle.replace(debugSigning, `$1${RELEASE_SIGNING_CONFIG}`);

  const releaseUsesDebug = /(release \{[^}]*?)signingConfig signingConfigs\.debug/;
  if (!releaseUsesDebug.test(result)) {
    throw new Error('withReleaseSigning: could not find the release buildType signingConfig');
  }
  result = result.replace(releaseUsesDebug, `$1${RELEASE_SIGNING_SELECTION}`);
  return result;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: only Groovy build.gradle files are supported');
    }
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
};
