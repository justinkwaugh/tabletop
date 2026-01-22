import fs from 'node:fs/promises'
import { DeployConfig } from './types.js'

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const coerceDeployConfig = (config: unknown): DeployConfig => {
    if (!isObject(config)) return {}
    const backend = config.backend
    const backendAdmin = config.backendAdmin
    return {
        gcsBucket: typeof config.gcsBucket === 'string' ? config.gcsBucket : undefined,
        backendManifestUrl:
            typeof config.backendManifestUrl === 'string' ? config.backendManifestUrl : undefined,
        backend: isObject(backend)
            ? {
                  image: typeof backend.image === 'string' ? backend.image : undefined,
                  service: typeof backend.service === 'string' ? backend.service : undefined,
                  tasksService:
                      typeof backend.tasksService === 'string'
                          ? backend.tasksService
                          : undefined,
                  region: typeof backend.region === 'string' ? backend.region : undefined,
                  project: typeof backend.project === 'string' ? backend.project : undefined,
                  deployCommand: Array.isArray(backend.deployCommand)
                      ? backend.deployCommand.filter((value) => typeof value === 'string')
                      : undefined
              }
            : undefined,
        backendAdmin: isObject(backendAdmin)
            ? {
                  url: typeof backendAdmin.url === 'string' ? backendAdmin.url : undefined,
                  token: typeof backendAdmin.token === 'string' ? backendAdmin.token : undefined,
                  username:
                      typeof backendAdmin.username === 'string' ? backendAdmin.username : undefined,
                  password:
                      typeof backendAdmin.password === 'string' ? backendAdmin.password : undefined,
                  cookie: typeof backendAdmin.cookie === 'string' ? backendAdmin.cookie : undefined
              }
            : undefined
    }
}

export const readDeployConfig = async (configPath: string): Promise<DeployConfig> => {
    try {
        const raw = await fs.readFile(configPath, 'utf8')
        return coerceDeployConfig(JSON.parse(raw))
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {}
        }
        throw error
    }
}

export const mergeEnvConfig = (config: DeployConfig): DeployConfig => {
    const backend = {
        image: process.env.TABLETOP_BACKEND_IMAGE ?? config.backend?.image,
        service: process.env.TABLETOP_BACKEND_SERVICE ?? config.backend?.service,
        tasksService: process.env.TABLETOP_TASKS_SERVICE ?? config.backend?.tasksService,
        region: process.env.TABLETOP_BACKEND_REGION ?? config.backend?.region,
        project: process.env.GCLOUD_PROJECT ?? config.backend?.project,
        deployCommand: config.backend?.deployCommand
    }
    const backendAdmin = {
        url: process.env.TABLETOP_BACKEND_ADMIN_URL ?? config.backendAdmin?.url,
        token: process.env.TABLETOP_BACKEND_ADMIN_TOKEN ?? config.backendAdmin?.token,
        username: process.env.TABLETOP_BACKEND_ADMIN_USER ?? config.backendAdmin?.username,
        password: process.env.TABLETOP_BACKEND_ADMIN_PASSWORD ?? config.backendAdmin?.password,
        cookie: process.env.TABLETOP_BACKEND_ADMIN_COOKIE ?? config.backendAdmin?.cookie
    }

    return {
        ...config,
        gcsBucket: process.env.TABLETOP_GCS_BUCKET ?? config.gcsBucket,
        backendManifestUrl:
            process.env.TABLETOP_BACKEND_MANIFEST_URL ??
            process.env.TABLETOP_MANIFEST_URL ??
            config.backendManifestUrl,
        backend,
        backendAdmin
    }
}
