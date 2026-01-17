import siteManifest from './site-manifest.json' with { type: 'json' }

type GamePackage = [name: string, scope?: string]

export type SiteManifest = typeof siteManifest
export type SiteManifestGame = SiteManifest['games'][keyof SiteManifest['games']]

const DEFAULT_SCOPE = '@tabletop'

export const SiteManifest = siteManifest
export const Games = Object.entries(siteManifest.games).map(([id, entry]) => ({
    id,
    ...entry
}))

export const AvailableGames: GamePackage[] = Object.keys(siteManifest.games).map(
    (name) => [name, DEFAULT_SCOPE]
)
