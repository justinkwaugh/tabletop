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

const DEFAULT_SCOPE = '@tabletop'

export const GameCatalogue: GameCatalogueEntry[] = games

export const AvailableGames: GamePackage[] = GameCatalogue.map((game) => [
    game.packageId,
    DEFAULT_SCOPE
])
