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

export type GameManifestEntry = GameCatalogueEntry & {
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
    games: GameManifestEntry[]
}

export type BackendManifest = SiteManifest & {
    backend?: {
        version?: string | null
        buildSha?: string | null
        buildTime?: string
        revision?: string
    }
}

export type BackendAdminConfig = {
    url?: string
    token?: string
    username?: string
    password?: string
    cookie?: string
}

export type DeployConfig = {
    gcsBucket?: string
    gcloudCredentialFile?: string
    backend?: {
        image?: string
        service?: string
        tasksService?: string
        region?: string
        project?: string
        deployCommand?: string[]
    }
    backendManifestUrl?: string
    backendAdmin?: BackendAdminConfig
}
