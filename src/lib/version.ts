// Source of truth de la versión — sincronizado con package.json
// Actualizar junto con package.json y CHANGELOG.md en cada release.
import pkg from '../../package.json';

export const APP_VERSION = pkg.version;
export const APP_NAME = 'ZOE Net Gestión';
export const BUILD_DATE = new Date().toISOString().split('T')[0];
