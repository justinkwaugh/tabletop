import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const getRepoRoot = () =>
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

export const getManifestPath = (repoRoot: string) =>
    path.join(repoRoot, 'config/config-games/src/site-manifest.json')

export const getDeployConfigPath = (repoRoot: string) =>
    path.join(repoRoot, 'tools/deploy/deploy.config.json')

export const getGcsRoot = () => process.env.GCS_MOUNT_ROOT ?? '/mnt/gcs'
