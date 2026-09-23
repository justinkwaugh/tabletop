import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { GameCatalogue, type SiteManifest } from '@tabletop/games-config'

const readPackageVersion = async (packageJsonPath: string): Promise<string> => {
    const raw = await readFile(packageJsonPath, 'utf8')
    const parsed: { version?: unknown } = JSON.parse(raw)
    if (typeof parsed.version !== 'string') {
        throw new Error(`${packageJsonPath} has no version`)
    }
    return parsed.version
}

export const createLocalManifest = async (workspaceRoot: string): Promise<SiteManifest> => {
    const frontendVersion = await readPackageVersion(
        path.join(workspaceRoot, 'apps', 'frontend', 'package.json')
    )
    const games = await Promise.all(
        GameCatalogue.map(async (game) => {
            const [logicVersion, uiVersion] = await Promise.all([
                readPackageVersion(
                    path.join(workspaceRoot, 'games', game.packageId, 'package.json')
                ),
                readPackageVersion(
                    path.join(workspaceRoot, 'games', `${game.packageId}-ui`, 'package.json')
                )
            ])
            return { ...game, logicVersion, uiVersion }
        })
    )
    return { frontend: { version: frontendVersion }, games }
}
