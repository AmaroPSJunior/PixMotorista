declare const __APP_VERSION__: string;
declare const __DEPLOY_SHA__: string;
declare const __DEPLOY_BUILD__: string;
declare const __DEPLOYED_AT__: string;

/**
 * Versão oficial da aplicação.
 *
 * SemVer:
 * - MAJOR: quebra de compatibilidade / mudança estrutural.
 * - MINOR: nova funcionalidade compatível.
 * - PATCH: correção, hotfix ou pequena melhoria.
 *
 * O número SemVer vem do package.json.
 * A identificação do deploy vem da Vercel e muda a cada build.
 */
export const APP_VERSION = __APP_VERSION__ || 'v0.0.0';
export const GITHUB_RELEASE_VERSION = APP_VERSION;
export const DEPLOY_SHA = __DEPLOY_SHA__ || 'local';
export const DEPLOY_BUILD = __DEPLOY_BUILD__ || 'local';
export const DEPLOYED_AT = __DEPLOYED_AT__ || '';

export const RELEASE_LABEL =
  DEPLOY_SHA && DEPLOY_SHA !== 'local'
    ? `${APP_VERSION} · ${DEPLOY_SHA}`
    : APP_VERSION;
