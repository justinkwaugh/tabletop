import type { SiteManifestGame } from '@tabletop/games-config'

export function gameUiEntryUrl(
    game: Pick<SiteManifestGame, 'packageId' | 'uiVersion'>,
    gameUiBaseUrl: string,
    siteUrl: string
): string {
    const entryPath = `/games/${game.packageId}/ui/${game.uiVersion}/index.js`
    return new URL(gameUiBaseUrl.replace(/\/+$/, '') + entryPath, siteUrl).href
}
