export type GameManifestEntry = {
    logicVersion: string
    uiVersion: string
}

export type SiteManifest = {
    frontend: {
        version: string
    }
    games: Record<string, GameManifestEntry>
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
