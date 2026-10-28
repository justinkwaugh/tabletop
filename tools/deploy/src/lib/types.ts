import type { SiteManifest } from '@tabletop/games-config'
export type {
    GameCatalogueEntry,
    PublicationRecord,
    FrontendVersionRecord,
    SiteManifest,
    SiteManifestGame as GameManifestEntry
} from '@tabletop/games-config'

export type BackendManifest = SiteManifest & {
    backend?: {
        version?: string | null
        buildSha?: string | null
        buildTime?: string
        revision?: string
    }
}

export type UnsupportedBackendAdminSetting = 'backendAdmin.token' | 'TABLETOP_BACKEND_ADMIN_TOKEN'

export type BackendAdminConfig = {
    url?: string
    username?: string
    password?: string
    cookie?: string
    unsupportedSettings?: UnsupportedBackendAdminSetting[]
}

export type HostingConfig = {
    channel?: string
}

export type RealtimeConfig = {
    instance?: string
    zone?: string
    healthUrl?: string
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
    hosting?: HostingConfig
    realtime?: RealtimeConfig
}
