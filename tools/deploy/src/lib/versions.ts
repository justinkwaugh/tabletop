import fs from 'node:fs/promises'
import path from 'node:path'
import { SiteManifest } from './types.js'

type PackageJson = {
    version?: string
}

export type BumpType = 'major' | 'minor' | 'patch'

export type PackageVersions = {
    frontendVersion: string
    games: Record<string, { logicVersion: string; uiVersion: string }>
}

const updatePriorVersions = (current: string, next: string, prior?: string[]) => {
    if (current === next) {
        return prior ?? []
    }
    return [current, ...(prior ?? [])].slice(0, 5)
}

const readJson = async (filePath: string) => {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as PackageJson
}

const writeJson = async (filePath: string, data: PackageJson) => {
    const json = JSON.stringify(data, null, 4) + '\n'
    await fs.writeFile(filePath, json, 'utf8')
}

export const getFrontendPackagePath = (repoRoot: string) =>
    path.join(repoRoot, 'apps', 'frontend', 'package.json')

export const getGamePackagePaths = (repoRoot: string, packageId: string) => ({
    logic: path.join(repoRoot, 'games', packageId, 'package.json'),
    ui: path.join(repoRoot, 'games', `${packageId}-ui`, 'package.json')
})

export const readPackageVersion = async (filePath: string) => {
    const data = await readJson(filePath)
    if (typeof data.version !== 'string') {
        throw new Error(`Package at ${filePath} is missing a version`)
    }
    return data.version
}

const parseSemver = (version: string) => {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
    if (!match) {
        throw new Error(`Version "${version}" is not in x.y.z format`)
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3])
    }
}

export const bumpVersion = (version: string, bump: BumpType) => {
    const { major, minor, patch } = parseSemver(version)
    if (bump === 'major') return `${major + 1}.0.0`
    if (bump === 'minor') return `${major}.${minor + 1}.0`
    return `${major}.${minor}.${patch + 1}`
}

export const writePackageVersion = async (filePath: string, version: string) => {
    const data = await readJson(filePath)
    data.version = version
    await writeJson(filePath, data)
}

export const readPackageVersions = async (
    repoRoot: string,
    manifest: SiteManifest
): Promise<PackageVersions> => {
    const frontendVersion = await readPackageVersion(getFrontendPackagePath(repoRoot))
    const games: Record<string, { logicVersion: string; uiVersion: string }> = {}

    for (const entry of manifest.games) {
        const paths = getGamePackagePaths(repoRoot, entry.packageId)
        const [logicVersion, uiVersion] = await Promise.all([
            readPackageVersion(paths.logic),
            readPackageVersion(paths.ui)
        ])
        games[entry.packageId] = { logicVersion, uiVersion }
    }

    return { frontendVersion, games }
}

export const syncManifestFromPackages = async (
    repoRoot: string,
    manifest: SiteManifest
): Promise<{ manifest: SiteManifest; changed: boolean }> => {
    const versions = await readPackageVersions(repoRoot, manifest)
    const frontendPrior = updatePriorVersions(
        manifest.frontend.version,
        versions.frontendVersion,
        manifest.frontend.priorVersions
    )
    const nextManifest: SiteManifest = {
        frontend: {
            ...manifest.frontend,
            version: versions.frontendVersion,
            priorVersions: frontendPrior
        },
        games: []
    }

    for (const entry of manifest.games) {
        const gameVersions = versions.games[entry.packageId]
        const nextLogicVersion = gameVersions?.logicVersion ?? entry.logicVersion
        const nextUiVersion = gameVersions?.uiVersion ?? entry.uiVersion
        const priorLogicVersions = updatePriorVersions(
            entry.logicVersion,
            nextLogicVersion,
            entry.priorLogicVersions
        )
        const priorUiVersions = updatePriorVersions(
            entry.uiVersion,
            nextUiVersion,
            entry.priorUiVersions
        )
        nextManifest.games.push({
            ...entry,
            logicVersion: nextLogicVersion,
            uiVersion: nextUiVersion,
            priorLogicVersions,
            priorUiVersions
        })
    }

    const changed = JSON.stringify(manifest) !== JSON.stringify(nextManifest)
    return { manifest: nextManifest, changed }
}
