import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const getRepoRoot = () =>
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

export const getCataloguePath = (repoRoot: string) =>
    path.join(repoRoot, 'config/config-games/src/games.json')

export const getDeployConfigPath = (repoRoot: string) =>
    path.join(repoRoot, 'tools/deploy/deploy.config.json')
