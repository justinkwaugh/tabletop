import fs from 'node:fs/promises'
import { DeployConfig } from './types.js'

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const coerceDeployConfig = (config: unknown): DeployConfig => {
    if (!isObject(config)) return {}
    const backend = config.backend
    return {
        gcsBucket: typeof config.gcsBucket === 'string' ? config.gcsBucket : undefined,
        backendManifestUrl:
            typeof config.backendManifestUrl === 'string' ? config.backendManifestUrl : undefined,
        backend: isObject(backend)
            ? {
                  service: typeof backend.service === 'string' ? backend.service : undefined,
                  region: typeof backend.region === 'string' ? backend.region : undefined,
                  project: typeof backend.project === 'string' ? backend.project : undefined,
                  deployCommand: Array.isArray(backend.deployCommand)
                      ? backend.deployCommand.filter((value) => typeof value === 'string')
                      : undefined
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
        service: process.env.TABLETOP_BACKEND_SERVICE ?? config.backend?.service,
        region: process.env.TABLETOP_BACKEND_REGION ?? config.backend?.region,
        project: process.env.GCLOUD_PROJECT ?? config.backend?.project
    }

    return {
        ...config,
        gcsBucket: process.env.TABLETOP_GCS_BUCKET ?? config.gcsBucket,
        backendManifestUrl:
            process.env.TABLETOP_BACKEND_MANIFEST_URL ??
            process.env.TABLETOP_MANIFEST_URL ??
            config.backendManifestUrl,
        backend
    }
}
