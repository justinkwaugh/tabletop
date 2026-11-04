import games from './games.json' with { type: 'json' }

type GamePackage = [name: string, scope?: string]

export type GameCatalogueEntry = {
    gameId: string
    packageId: string
}

export type PublicationRecord = {
    logicVersion: string
    uiVersion: string
    deployedAt?: string
    commitSha?: string
    tags?: string[]
}

export type FrontendVersionRecord = {
    version: string
    deployedAt?: string
    commitSha?: string
    tag?: string
}

export type SiteManifestGame = GameCatalogueEntry & {
    logicVersion: string
    uiVersion: string
    priorLogicVersions?: string[]
    priorUiVersions?: string[]
    history?: PublicationRecord[]
}

export type SiteManifest = {
    frontend: {
        version: string
        priorVersions?: string[]
        history?: FrontendVersionRecord[]
    }
    games: SiteManifestGame[]
}

export function gamePublicationSignature(games: SiteManifestGame[]): string {
    return JSON.stringify(
        games
            .map(({ gameId, packageId, logicVersion, uiVersion }) => [
                gameId,
                packageId,
                logicVersion,
                uiVersion
            ])
            .sort(([left], [right]) => left.localeCompare(right))
    )
}

export function manifestPublicationSignature(manifest: SiteManifest): string {
    return JSON.stringify([manifest.frontend.version, gamePublicationSignature(manifest.games)])
}

const DEFAULT_SCOPE = '@tabletop'

export const GameCatalogue: GameCatalogueEntry[] = games

export const AvailableGames: GamePackage[] = GameCatalogue.map((game) => [
    game.packageId,
    DEFAULT_SCOPE
])
