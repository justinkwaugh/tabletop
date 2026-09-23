import path from 'node:path'
import { fetchBackendManifest, invalidateBackendManifestCache } from './backend.js'
import {
    buildGameLogicCommand,
    buildGameLogicPackageCommand,
    buildGameUiCommand,
    buildGameUiPackageCommand,
    dedupeCommandSpecs,
    deployGameLogicCommand,
    deployGameUiCommand,
    deployManifestCommand,
    directoryPlaceholderSpecs,
    runCommand
} from './commands.js'
import type { CommandSpec } from './commands.js'
import { gcsPathExists } from './gcs.js'
import {
    assertCleanWorkingTree,
    commitFiles,
    createAnnotatedTag,
    currentBranch,
    pushBranchAndTags,
    tagExists,
    tagsAtHead
} from './git.js'
import { readManifest, writeManifest } from './manifest.js'
import type { DeployConfig, GameManifestEntry, SiteManifest } from './types.js'
import {
    getGamePackagePaths,
    logicReleaseTag,
    planGameVersionBump,
    readGamePackageVersions,
    syncManifestFromPackages,
    uiReleaseTag,
    writeGameVersionBump,
    type BumpType,
    type GameVersionBump
} from './versions.js'

export type PublishContext = {
    repoRoot: string
    manifestPath: string
    deployConfig: DeployConfig
    log: (message: string) => void
}

export type GameArtifactSelection = {
    game: string
    includeLogic: boolean
}

export type GameReleaseOptions = GameArtifactSelection & {
    bump: BumpType
    deploy: boolean
}

export type ArtifactKind = 'logic' | 'ui'

type ReleasedArtifact = {
    kind: ArtifactKind
    version: string
    tag: string
}

const runStep = async (
    context: PublishContext,
    spec: { label: string; logPath: string },
    action: () => Promise<void>
) => {
    context.log(`${spec.label}: running (log: ${spec.logPath})`)
    await action()
    context.log(`${spec.label}: complete`)
}

const runSpec = (context: PublishContext, spec: CommandSpec) =>
    runStep(context, spec, () => runCommand(spec))

const runDeploysWithDirectoryPlaceholders = async (
    context: PublishContext,
    specs: CommandSpec[]
) => {
    const placeholderSpecs = dedupeCommandSpecs(
        specs.flatMap((spec) => directoryPlaceholderSpecs(context.repoRoot, spec))
    )
    for (const placeholder of placeholderSpecs) {
        await runSpec(context, placeholder)
    }
    for (const spec of specs) {
        await runSpec(context, spec)
    }
}

export const publishManifest = async (context: PublishContext) => {
    await runDeploysWithDirectoryPlaceholders(context, [
        deployManifestCommand(context.manifestPath, context.deployConfig)
    ])
    await runStep(
        context,
        { label: 'invalidate-manifest', logPath: '/tmp/manifest-invalidate.log' },
        () => invalidateBackendManifestCache(context.deployConfig)
    )
}

export const findGameEntry = (manifest: SiteManifest, game: string): GameManifestEntry => {
    const entry = manifest.games.find(
        (candidate) => candidate.gameId === game || candidate.packageId === game
    )
    if (!entry) {
        const known = manifest.games.map((candidate) => candidate.gameId).join(', ')
        throw new Error(`Unknown game "${game}". Known games: ${known}`)
    }
    return entry
}

export const assertGameDeployConfig = (deployConfig: DeployConfig): string => {
    if (!deployConfig.gcsBucket) {
        throw new Error('Missing gcsBucket (set TABLETOP_GCS_BUCKET or deploy config)')
    }
    if (!deployConfig.backendAdmin?.url && !deployConfig.backendManifestUrl) {
        throw new Error(
            'Missing backend admin URL for manifest invalidation ' +
                '(set TABLETOP_BACKEND_ADMIN_URL or deploy config)'
        )
    }
    return deployConfig.gcsBucket
}

const releaseTagFor = (packageId: string, kind: ArtifactKind, version: string) =>
    kind === 'logic' ? logicReleaseTag(packageId, version) : uiReleaseTag(packageId, version)

const selectedArtifacts = async (
    context: PublishContext,
    entry: GameManifestEntry,
    kinds: ArtifactKind[]
): Promise<ReleasedArtifact[]> => {
    const versions = await readGamePackageVersions(context.repoRoot, entry.packageId)
    return kinds.map((kind) => ({
        kind,
        version: versions[kind],
        tag: releaseTagFor(entry.packageId, kind, versions[kind])
    }))
}

const loadManifestAssertingSynced = async (context: PublishContext): Promise<SiteManifest> => {
    const manifest = await readManifest(context.manifestPath)
    const { changed } = await syncManifestFromPackages(context.repoRoot, manifest)
    if (changed) {
        throw new Error(
            'site-manifest.json does not match the package versions; ' +
                'run release-game to bump, sync, and commit them together'
        )
    }
    return manifest
}

const assertArtifactsPublishable = async (
    context: PublishContext,
    bucket: string,
    packageId: string,
    artifacts: ReleasedArtifact[]
) => {
    const headTags = await tagsAtHead(context.repoRoot)
    for (const artifact of artifacts) {
        if (!headTags.includes(artifact.tag)) {
            throw new Error(
                `HEAD is not tagged ${artifact.tag}; run release-game to create the release first`
            )
        }
    }
    for (const artifact of artifacts) {
        const destination = `gs://${bucket}/games/${packageId}/${artifact.kind}/${artifact.version}`
        if (await gcsPathExists(destination)) {
            throw new Error(
                `${destination} is already published; deployed versions are immutable, ` +
                    'so release a new version instead'
            )
        }
    }
}

const describeVersions = (artifacts: ReleasedArtifact[]) =>
    artifacts.map((artifact) => `${artifact.kind} ${artifact.version}`).join(' / ')

export type ServingVersions = { logic: string; ui: string }

export const fetchServingVersions = async (
    deployConfig: DeployConfig,
    packageId: string
): Promise<ServingVersions | { error: string }> => {
    const url = deployConfig.backendManifestUrl
    if (!url) return { error: 'backend manifest URL not configured' }
    const result = await fetchBackendManifest(url)
    if (!result.manifest) return { error: result.error ?? 'backend manifest unavailable' }
    const entry = result.manifest.games.find((game) => game.packageId === packageId)
    if (!entry) return { error: `backend manifest has no entry for ${packageId}` }
    return { logic: entry.logicVersion, ui: entry.uiVersion }
}

const describeServing = (serving: ServingVersions | { error: string }) =>
    'error' in serving ? `unknown (${serving.error})` : `logic ${serving.logic} / ui ${serving.ui}`

const describeDeployment = (
    serving: ServingVersions | { error: string },
    artifacts: ReleasedArtifact[]
) => {
    const deploying = describeVersions(artifacts)
    const logicDeployed = artifacts.some((artifact) => artifact.kind === 'logic')
    if (logicDeployed || 'error' in serving) return deploying
    return `${deploying} (logic stays ${serving.logic})`
}

const assertServingMatches = (
    serving: ServingVersions | { error: string },
    artifacts: ReleasedArtifact[]
) => {
    if ('error' in serving) {
        throw new Error(
            `Deploy finished but the serving versions could not be read: ${serving.error}`
        )
    }
    const stale = artifacts.filter((artifact) => serving[artifact.kind] !== artifact.version)
    if (stale.length > 0) {
        throw new Error(
            `Deploy finished but the backend still serves ${describeServing(serving)}; ` +
                'check /tmp/manifest-deploy.log and /tmp/manifest-invalidate.log'
        )
    }
}

export type PublishableGame = {
    entry: GameManifestEntry
    manifest: SiteManifest
    artifacts: ReleasedArtifact[]
}

export const assertGamePublishable = async (
    context: PublishContext,
    game: string,
    kinds: ArtifactKind[]
): Promise<PublishableGame> => {
    const bucket = assertGameDeployConfig(context.deployConfig)
    const entry = findGameEntry(await readManifest(context.manifestPath), game)
    await assertCleanWorkingTree(context.repoRoot)
    const manifest = await loadManifestAssertingSynced(context)
    const artifacts = await selectedArtifacts(context, entry, kinds)
    await assertArtifactsPublishable(context, bucket, entry.packageId, artifacts)
    return { entry, manifest, artifacts }
}

const buildAndUpload = async (
    context: PublishContext,
    packageId: string,
    manifest: SiteManifest,
    includeLogic: boolean
) => {
    if (includeLogic) {
        await runSpec(context, buildGameLogicPackageCommand(context.repoRoot, packageId))
        await runSpec(context, buildGameLogicCommand(context.repoRoot, packageId))
    }
    await runSpec(context, buildGameUiPackageCommand(context.repoRoot, packageId))
    await runSpec(context, buildGameUiCommand(context.repoRoot, packageId))

    const deploySpecs = [
        ...(includeLogic
            ? [deployGameLogicCommand(context.repoRoot, manifest, packageId, context.deployConfig)]
            : []),
        deployGameUiCommand(context.repoRoot, manifest, packageId, context.deployConfig)
    ]
    await runDeploysWithDirectoryPlaceholders(context, deploySpecs)
    await publishManifest(context)
}

export const deployGame = async (context: PublishContext, options: GameArtifactSelection) => {
    const kinds: ArtifactKind[] = options.includeLogic ? ['logic', 'ui'] : ['ui']
    const { entry, manifest, artifacts } = await assertGamePublishable(context, options.game, kinds)
    const packageId = entry.packageId

    const servingBefore = await fetchServingVersions(context.deployConfig, packageId)
    context.log(`${entry.gameId} serving before deploy: ${describeServing(servingBefore)}`)
    context.log(`${entry.gameId} deploying: ${describeDeployment(servingBefore, artifacts)}`)

    try {
        await buildAndUpload(context, packageId, manifest, options.includeLogic)
    } catch (error) {
        const servingAfterFailure = await fetchServingVersions(context.deployConfig, packageId)
        context.log(
            `${entry.gameId} deploy FAILED: ${error instanceof Error ? error.message : error}`
        )
        context.log(`${entry.gameId} serving now: ${describeServing(servingAfterFailure)}`)
        throw error
    }

    const servingAfter = await fetchServingVersions(context.deployConfig, packageId)
    assertServingMatches(servingAfter, artifacts)
    context.log(`${entry.gameId} deploy SUCCEEDED: ${describeVersions(artifacts)}`)
    context.log(`${entry.gameId} serving now: ${describeServing(servingAfter)}`)
}

const releaseCommitMessage = (gameId: string, planned: GameVersionBump) =>
    planned.logic
        ? `Release ${gameId} logic ${planned.logic.next} and ui ${planned.ui.next}`
        : `Release ${gameId} ui ${planned.ui.next}`

const plannedTags = (packageId: string, planned: GameVersionBump): ReleasedArtifact[] => [
    ...(planned.logic
        ? [
              {
                  kind: 'logic' as const,
                  version: planned.logic.next,
                  tag: logicReleaseTag(packageId, planned.logic.next)
              }
          ]
        : []),
    { kind: 'ui' as const, version: planned.ui.next, tag: uiReleaseTag(packageId, planned.ui.next) }
]

export const releaseGame = async (context: PublishContext, options: GameReleaseOptions) => {
    if (options.deploy) {
        assertGameDeployConfig(context.deployConfig)
    }
    const entry = findGameEntry(await readManifest(context.manifestPath), options.game)
    const packageId = entry.packageId

    await assertCleanWorkingTree(context.repoRoot)
    const branch = await currentBranch(context.repoRoot)
    const planned = await planGameVersionBump(context.repoRoot, packageId, options.bump, {
        includeLogic: options.includeLogic
    })
    const artifacts = plannedTags(packageId, planned)
    for (const artifact of artifacts) {
        if (await tagExists(context.repoRoot, artifact.tag)) {
            throw new Error(`Tag ${artifact.tag} already exists`)
        }
    }

    await writeGameVersionBump(context.repoRoot, packageId, planned)
    if (planned.logic) {
        context.log(`${entry.gameId} logic: ${planned.logic.previous} -> ${planned.logic.next}`)
    }
    context.log(`${entry.gameId} ui: ${planned.ui.previous} -> ${planned.ui.next}`)

    const manifest = await readManifest(context.manifestPath)
    const { manifest: syncedManifest } = await syncManifestFromPackages(context.repoRoot, manifest)
    await writeManifest(context.manifestPath, syncedManifest)

    const packagePaths = getGamePackagePaths(context.repoRoot, packageId)
    const files = [
        ...(planned.logic ? [packagePaths.logic] : []),
        packagePaths.ui,
        context.manifestPath
    ].map((file) => path.relative(context.repoRoot, file))
    const message = releaseCommitMessage(entry.gameId, planned)
    await commitFiles(context.repoRoot, files, message)
    context.log(`Committed: ${message}`)

    for (const artifact of artifacts) {
        await createAnnotatedTag(context.repoRoot, artifact.tag, message)
        context.log(`Tagged ${artifact.tag}`)
    }
    await pushBranchAndTags(
        context.repoRoot,
        branch,
        artifacts.map((artifact) => artifact.tag)
    )
    context.log(`Pushed ${branch} and ${artifacts.length} tag(s) to origin`)

    if (options.deploy) {
        await deployGame(context, { game: options.game, includeLogic: options.includeLogic })
    }
}
