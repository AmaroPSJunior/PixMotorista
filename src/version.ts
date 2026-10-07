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
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'v0.0.0';
export const GITHUB_RELEASE_VERSION = APP_VERSION;
export const DEPLOY_SHA = import.meta.env.VITE_DEPLOY_SHA || 'local';
export const DEPLOY_BUILD = import.meta.env.VITE_DEPLOY_BUILD || 'local';
export const DEPLOYED_AT = import.meta.env.VITE_DEPLOYED_AT || '';

export const RELEASE_LABEL =
  DEPLOY_SHA && DEPLOY_SHA !== 'local'
    ? `${APP_VERSION} · ${DEPLOY_SHA}`
    : APP_VERSION;
