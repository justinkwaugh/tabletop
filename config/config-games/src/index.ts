import siteManifest from './site-manifest.json' with { type: 'json' }

type GamePackage = [name: string, scope?: string]

export type SiteManifest = typeof siteManifest
export type SiteManifestGame = SiteManifest['games'][number]

const DEFAULT_SCOPE = '@tabletop'

export const SiteManifest = siteManifest
export const Games = siteManifest.games

export const AvailableGames: GamePackage[] = siteManifest.games.map((game) => [
    game.packageId,
    DEFAULT_SCOPE
])
