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
