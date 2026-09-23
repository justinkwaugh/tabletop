import fs from 'node:fs/promises'
import path from 'node:path'

type PackageJson = {
    version?: string
}

export type BumpType = 'major' | 'minor' | 'patch'

export const updatePriorVersions = (current: string, next: string, prior?: string[]) => {
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

export const getBackendPackagePath = (repoRoot: string) =>
    path.join(repoRoot, 'apps', 'backend', 'package.json')

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

export type VersionChange = { previous: string; next: string }

export type GameVersionBump = {
    logic?: VersionChange
    ui: VersionChange
}

export type GamePackageVersions = { logic: string; ui: string }

export const readGamePackageVersions = async (
    repoRoot: string,
    packageId: string
): Promise<GamePackageVersions> => {
    const paths = getGamePackagePaths(repoRoot, packageId)
    const [logic, ui] = await Promise.all([
        readPackageVersion(paths.logic),
        readPackageVersion(paths.ui)
    ])
    return { logic, ui }
}

export const planGameVersionBump = async (
    repoRoot: string,
    packageId: string,
    bump: BumpType,
    options: { includeLogic: boolean }
): Promise<GameVersionBump> => {
    const current = await readGamePackageVersions(repoRoot, packageId)
    const change = (previous: string): VersionChange => ({
        previous,
        next: bumpVersion(previous, bump)
    })
    return {
        logic: options.includeLogic ? change(current.logic) : undefined,
        ui: change(current.ui)
    }
}

export const writeGameVersionBump = async (
    repoRoot: string,
    packageId: string,
    planned: GameVersionBump
): Promise<void> => {
    const paths = getGamePackagePaths(repoRoot, packageId)
    if (planned.logic) {
        await writePackageVersion(paths.logic, planned.logic.next)
    }
    await writePackageVersion(paths.ui, planned.ui.next)
}

export const bumpGameVersions = async (
    repoRoot: string,
    packageId: string,
    bump: BumpType,
    options: { includeLogic: boolean }
): Promise<GameVersionBump> => {
    const planned = await planGameVersionBump(repoRoot, packageId, bump, options)
    await writeGameVersionBump(repoRoot, packageId, planned)
    return planned
}

export const logicReleaseTag = (packageId: string, version: string) => `${packageId}-v${version}`

export const uiReleaseTag = (packageId: string, version: string) => `${packageId}-ui-v${version}`

export const frontendReleaseTag = (version: string) => `frontend-v${version}`

export const backendReleaseTag = (version: string) => `backend-v${version}`
