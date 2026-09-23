import { fetchServingVersions, findGameEntry, type ServingVersions } from './gamePublish.js'
import {
    changedFilesSince,
    commitsSince,
    commitThatSetVersion,
    isWorkingTreeClean,
    resolveCommit,
    tagExists,
    type CommitSummary
} from './git.js'
import { readManifest } from './manifest.js'
import type { DeployConfig } from './types.js'
import {
    getGamePackagePaths,
    logicReleaseTag,
    readGamePackageVersions,
    syncManifestFromPackages,
    uiReleaseTag
} from './versions.js'
import { workspaceSourceDirs } from './workspace.js'

// Every game depends on these, so a change to them is a platform change rather than a change to
// any one game's logic or UI. Family libraries such as @tabletop/18xx are deliberately counted.
export const PLATFORM_PACKAGES = ['@tabletop/common', '@tabletop/frontend-components'] as const

export type ReleaseBaseline = {
    kind: 'tag' | 'version-commit'
    ref: string
    sha: string
}

export type ArtifactPreflight = {
    kind: 'logic' | 'ui'
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

export type ReleaseNeeded = 'logic and ui' | 'ui' | 'none'

export type PreflightReport = {
    gameId: string
    packageId: string
    workingTreeClean: boolean
    manifestInSync: boolean
    serving: { source: string; error?: string } | null
    logic: ArtifactPreflight
    ui: ArtifactPreflight
    releaseNeeded: ReleaseNeeded
}

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

const artifactPreflight = async (
    repoRoot: string,
    kind: 'logic' | 'ui',
    packageName: string,
    packageJsonPath: string,
    tag: string,
    localVersion: string,
    servingVersion: string | null
): Promise<ArtifactPreflight> => {
    const baseline = await resolveBaseline(repoRoot, tag, packageJsonPath, localVersion)
    const sourceDirs = await workspaceSourceDirs(repoRoot, packageName, {
        exclude: PLATFORM_PACKAGES
    })
    const allDirs = await workspaceSourceDirs(repoRoot, packageName, { exclude: [] })
    const platformDirs = allDirs.filter((dir) => !sourceDirs.includes(dir))
    const changedFiles = await changedFilesSince(repoRoot, baseline.sha, sourceDirs)
    const commits = await commitsSince(repoRoot, baseline.sha, sourceDirs)
    const platformChangedFiles =
        platformDirs.length > 0 ? await changedFilesSince(repoRoot, baseline.sha, platformDirs) : []
    return {
        kind,
        localVersion,
        servingVersion,
        baseline,
        sourceDirs,
        changedFiles,
        commits,
        changed: changedFiles.length > 0,
        platformDirs,
        platformChangedFiles
    }
}

const servingEntry = async (
    deployConfig: DeployConfig,
    packageId: string
): Promise<{ source: PreflightReport['serving']; versions: ServingVersions | null }> => {
    const url = deployConfig.backendManifestUrl
    if (!url) return { source: null, versions: null }
    const serving = await fetchServingVersions(deployConfig, packageId)
    if ('error' in serving) {
        return { source: { source: url, error: serving.error }, versions: null }
    }
    return { source: { source: url }, versions: serving }
}

export const runReleasePreflight = async (
    repoRoot: string,
    manifestPath: string,
    deployConfig: DeployConfig,
    game: string
): Promise<PreflightReport> => {
    const manifest = await readManifest(manifestPath)
    const entry = findGameEntry(manifest, game)
    const packageId = entry.packageId
    const versions = await readGamePackageVersions(repoRoot, packageId)
    const paths = getGamePackagePaths(repoRoot, packageId)
    const { changed: manifestChanged } = await syncManifestFromPackages(repoRoot, manifest)
    const serving = await servingEntry(deployConfig, packageId)

    const logic = await artifactPreflight(
        repoRoot,
        'logic',
        `@tabletop/${packageId}`,
        paths.logic,
        logicReleaseTag(packageId, versions.logic),
        versions.logic,
        serving.versions?.logic ?? null
    )
    const ui = await artifactPreflight(
        repoRoot,
        'ui',
        `@tabletop/${packageId}-ui`,
        paths.ui,
        uiReleaseTag(packageId, versions.ui),
        versions.ui,
        serving.versions?.ui ?? null
    )

    const releaseNeeded: ReleaseNeeded = logic.changed ? 'logic and ui' : ui.changed ? 'ui' : 'none'

    return {
        gameId: entry.gameId,
        packageId,
        workingTreeClean: await isWorkingTreeClean(repoRoot),
        manifestInSync: !manifestChanged,
        serving: serving.source,
        logic,
        ui,
        releaseNeeded
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
    lines.push(
        `  platform changes: ${artifact.platformChangedFiles.length} files in ${artifact.platformDirs.join(', ') || 'none'} (reported, not counted)`
    )
    for (const file of artifact.platformChangedFiles) {
        lines.push(`    ${file}`)
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
        `${report.gameId} (package ${report.packageId})`,
        `working tree clean: ${report.workingTreeClean ? 'yes' : 'no'}`,
        `manifest in sync:   ${report.manifestInSync ? 'yes' : 'no'}`,
        `serving manifest:   ${servingLine}`,
        `platform packages:  ${PLATFORM_PACKAGES.join(', ')} (changes not counted)`,
        ...formatArtifact(report.logic),
        ...formatArtifact(report.ui),
        `release needed:     ${report.releaseNeeded}`
    ].join('\n')
}
