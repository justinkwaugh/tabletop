import { BACKEND_PACKAGE, fetchBackendServingVersion } from './backendPublish.js'
import { fetchFrontendServingVersion, FRONTEND_PACKAGE } from './frontendPublish.js'
import { fetchServingVersions, findGameEntry, gameReleaseTag } from './gamePublish.js'
import {
    changedFilesSince,
    commitsSince,
    commitThatSetVersion,
    isWorkingTreeClean,
    resolveCommit,
    tagExists,
    type CommitSummary
} from './git.js'
import type { PublishContext, ServingLookup } from './publishCore.js'
import {
    backendReleaseTag,
    frontendReleaseTag,
    getBackendPackagePath,
    getFrontendPackagePath,
    getGamePackagePaths,
    readGamePackageVersions,
    readPackageVersion
} from './versions.js'
import { workspaceSourceDirs } from './workspace.js'

// Every game depends on these, so a change to them is a platform change rather than a change to
// any one game's logic or UI. Family libraries such as @tabletop/18xx are deliberately counted.
// The frontend bundles them, so its preflight counts them.
export const PLATFORM_PACKAGES = ['@tabletop/common', '@tabletop/frontend-components'] as const

export type ReleaseBaseline = {
    kind: 'tag' | 'version-commit'
    ref: string
    sha: string
}

export type ArtifactPreflight = {
    kind: string
    localVersion: string
    servingVersion: string | null
    baseline: ReleaseBaseline
    sourceDirs: string[]
    changedFiles: string[]
    commits: CommitSummary[]
    changed: boolean
    platformDirs: string[]
    platformChangedFiles: string[]
}

type PreflightBase = {
    target: string
    workingTreeClean: boolean
    serving: { source: string; error?: string } | null
    artifacts: ArtifactPreflight[]
    releaseNeeded: string
}

export type GamePreflightReport = PreflightBase & {
    gameId: string
    packageId: string
    logic: ArtifactPreflight
    ui: ArtifactPreflight
    releaseNeeded: 'logic and ui' | 'ui' | 'none'
}

export type FrontendPreflightReport = PreflightBase & {
    frontend: ArtifactPreflight
    releaseNeeded: 'frontend' | 'none'
}

export type BackendPreflightReport = PreflightBase & {
    backend: ArtifactPreflight
    releaseNeeded: 'backend' | 'none'
}

export type PreflightReport = GamePreflightReport | FrontendPreflightReport | BackendPreflightReport

const resolveBaseline = async (
    repoRoot: string,
    tag: string,
    packageJsonPath: string,
    version: string
): Promise<ReleaseBaseline> => {
    if (await tagExists(repoRoot, tag)) {
        return { kind: 'tag', ref: tag, sha: await resolveCommit(repoRoot, tag) }
    }
    const sha = await commitThatSetVersion(repoRoot, packageJsonPath, version)
    if (!sha) {
        throw new Error(
            `No release tag ${tag} and no commit sets version ${version} in ${packageJsonPath}`
        )
    }
    return { kind: 'version-commit', ref: sha.slice(0, 7), sha }
}

type ArtifactSource = {
    kind: string
    packageName: string
    packageJsonPath: string
    tag: string
    localVersion: string
    servingVersion: string | null
    excludePackages: readonly string[]
}

const artifactPreflight = async (
    repoRoot: string,
    source: ArtifactSource
): Promise<ArtifactPreflight> => {
    const baseline = await resolveBaseline(
        repoRoot,
        source.tag,
        source.packageJsonPath,
        source.localVersion
    )
    const sourceDirs = await workspaceSourceDirs(repoRoot, source.packageName, {
        exclude: source.excludePackages
    })
    const allDirs = await workspaceSourceDirs(repoRoot, source.packageName, { exclude: [] })
    const platformDirs = allDirs.filter((dir) => !sourceDirs.includes(dir))
    const changedFiles = await changedFilesSince(repoRoot, baseline.sha, sourceDirs)
    const commits = await commitsSince(repoRoot, baseline.sha, sourceDirs)
    const platformChangedFiles =
        platformDirs.length > 0 ? await changedFilesSince(repoRoot, baseline.sha, platformDirs) : []
    return {
        kind: source.kind,
        localVersion: source.localVersion,
        servingVersion: source.servingVersion,
        baseline,
        sourceDirs,
        changedFiles,
        commits,
        changed: changedFiles.length > 0,
        platformDirs,
        platformChangedFiles
    }
}

const servingSource = (
    context: PublishContext,
    serving: ServingLookup
): PreflightBase['serving'] => {
    const url = context.deployConfig.backendManifestUrl
    if (!url) return null
    return 'error' in serving ? { source: url, error: serving.error } : { source: url }
}

const servingVersion = (serving: ServingLookup, kind: string): string | null =>
    'error' in serving ? null : (serving[kind] ?? null)

const preflightBase = async (
    context: PublishContext,
    serving: ServingLookup
): Promise<Pick<PreflightBase, 'workingTreeClean' | 'serving'>> => ({
    workingTreeClean: await isWorkingTreeClean(context.repoRoot),
    serving: servingSource(context, serving)
})

export const runGamePreflight = async (
    context: PublishContext,
    game: string
): Promise<GamePreflightReport> => {
    const entry = findGameEntry(context.catalogue, game)
    const packageId = entry.packageId
    const versions = await readGamePackageVersions(context.repoRoot, packageId)
    const paths = getGamePackagePaths(context.repoRoot, packageId)
    const serving = await fetchServingVersions(context, packageId)
    const base = await preflightBase(context, serving)

    const logic = await artifactPreflight(context.repoRoot, {
        kind: 'logic',
        packageName: `@tabletop/${packageId}`,
        packageJsonPath: paths.logic,
        tag: gameReleaseTag(packageId, 'logic', versions.logic),
        localVersion: versions.logic,
        servingVersion: servingVersion(serving, 'logic'),
        excludePackages: PLATFORM_PACKAGES
    })
    const ui = await artifactPreflight(context.repoRoot, {
        kind: 'ui',
        packageName: `@tabletop/${packageId}-ui`,
        packageJsonPath: paths.ui,
        tag: gameReleaseTag(packageId, 'ui', versions.ui),
        localVersion: versions.ui,
        servingVersion: servingVersion(serving, 'ui'),
        excludePackages: PLATFORM_PACKAGES
    })
    const releaseNeeded = logic.changed ? 'logic and ui' : ui.changed ? 'ui' : 'none'

    return {
        ...base,
        target: `${entry.gameId} (package ${packageId})`,
        gameId: entry.gameId,
        packageId,
        artifacts: [logic, ui],
        logic,
        ui,
        releaseNeeded
    }
}

export const runFrontendPreflight = async (
    context: PublishContext
): Promise<FrontendPreflightReport> => {
    const packageJsonPath = getFrontendPackagePath(context.repoRoot)
    const localVersion = await readPackageVersion(packageJsonPath)
    const serving = await fetchFrontendServingVersion(context)
    const base = await preflightBase(context, serving)
    const frontend = await artifactPreflight(context.repoRoot, {
        kind: 'frontend',
        packageName: FRONTEND_PACKAGE,
        packageJsonPath,
        tag: frontendReleaseTag(localVersion),
        localVersion,
        servingVersion: servingVersion(serving, 'frontend'),
        excludePackages: []
    })
    return {
        ...base,
        target: 'frontend',
        artifacts: [frontend],
        frontend,
        releaseNeeded: frontend.changed ? 'frontend' : 'none'
    }
}

export const runBackendPreflight = async (
    context: PublishContext
): Promise<BackendPreflightReport> => {
    const packageJsonPath = getBackendPackagePath(context.repoRoot)
    const localVersion = await readPackageVersion(packageJsonPath)
    const serving = await fetchBackendServingVersion(context)
    const base = await preflightBase(context, serving)
    const backend = await artifactPreflight(context.repoRoot, {
        kind: 'backend',
        packageName: BACKEND_PACKAGE,
        packageJsonPath,
        tag: backendReleaseTag(localVersion),
        localVersion,
        servingVersion: servingVersion(serving, 'backend'),
        excludePackages: []
    })
    return {
        ...base,
        target: 'backend',
        artifacts: [backend],
        backend,
        releaseNeeded: backend.changed ? 'backend' : 'none'
    }
}

const describeBaseline = (baseline: ReleaseBaseline) =>
    baseline.kind === 'tag'
        ? `tag ${baseline.ref}`
        : `commit ${baseline.ref} (no release tag; the commit that set this version)`

const formatArtifact = (artifact: ArtifactPreflight): string[] => {
    const lines = [
        `${artifact.kind}:`,
        `  local version:   ${artifact.localVersion}`,
        `  serving version: ${artifact.servingVersion ?? 'unknown'}`,
        `  baseline:        ${describeBaseline(artifact.baseline)}`,
        `  counted dirs:    ${artifact.sourceDirs.join(', ')}`,
        `  changed:         ${artifact.changed ? 'yes' : 'no'} (${artifact.changedFiles.length} files)`
    ]
    for (const file of artifact.changedFiles) {
        lines.push(`    ${file}`)
    }
    if (artifact.commits.length > 0) {
        lines.push('  commits since baseline:')
        for (const commit of artifact.commits) {
            lines.push(`    ${commit.sha} ${commit.subject}`)
        }
    }
    if (artifact.platformDirs.length > 0) {
        lines.push(
            `  platform changes: ${artifact.platformChangedFiles.length} files in ${artifact.platformDirs.join(', ')} (reported, not counted)`
        )
        for (const file of artifact.platformChangedFiles) {
            lines.push(`    ${file}`)
        }
    }
    return lines
}

export const formatPreflightReport = (report: PreflightReport): string => {
    const servingLine = report.serving
        ? report.serving.error
            ? `unavailable (${report.serving.error}) from ${report.serving.source}`
            : `from ${report.serving.source}`
        : 'not configured (set TABLETOP_BACKEND_MANIFEST_URL or deploy config)'
    return [
        report.target,
        `working tree clean: ${report.workingTreeClean ? 'yes' : 'no'}`,
        `serving manifest:   ${servingLine}`,
        ...report.artifacts.flatMap(formatArtifact),
        `release needed:     ${report.releaseNeeded}`
    ].join('\n')
}
