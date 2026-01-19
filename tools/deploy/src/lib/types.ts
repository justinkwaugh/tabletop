export type GameManifestEntry = {
    gameId: string
    packageId: string
    logicVersion: string
    uiVersion: string
    priorLogicVersions?: string[]
    priorUiVersions?: string[]
}

export type SiteManifest = {
    frontend: {
        version: string
        priorVersions?: string[]
    }
    games: GameManifestEntry[]
}

export type BackendManifest = SiteManifest & {
    backend?: {
        buildSha?: string
        buildTime?: string
        revision?: string
    }
}

export type DeployConfig = {
    gcsBucket?: string
    backend?: {
        image?: string
        service?: string
        region?: string
        project?: string
        deployCommand?: string[]
    }
    backendManifestUrl?: string
}
