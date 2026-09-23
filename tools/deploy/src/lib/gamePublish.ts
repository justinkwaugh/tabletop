import path from 'node:path'
import {
    buildGameLogicCommand,
    buildGameLogicPackageCommand,
    buildGameUiCommand,
    buildGameUiPackageCommand,
    deployGameLogicCommand,
    deployGameUiCommand
} from './commands.js'
import { readManifest, writeManifest } from './manifest.js'
import {
    assertArtifactsPublishable,
    assertCleanWorkingTree,
    assertDeployConfig,
    commitTagAndPush,
    fetchServing,
    gcsArtifact,
    loadManifestAssertingSynced,
    prepareRelease,
    publishManifest,
    runDeploysWithDirectoryPlaceholders,
    runReportedDeploy,
    runSpec,
    type PublishContext,
    type PublishedArtifact,
    type ServingLookup
} from './publishCore.js'
import type { GameManifestEntry, SiteManifest } from './types.js'
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

export type GameArtifactSelection = {
    game: string
    includeLogic: boolean
}

export type GameReleaseOptions = GameArtifactSelection & {
    bump: BumpType
    deploy: boolean
}

export type ArtifactKind = 'logic' | 'ui'

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

export const gameReleaseTag = (packageId: string, kind: ArtifactKind, version: string) =>
    kind === 'logic' ? logicReleaseTag(packageId, version) : uiReleaseTag(packageId, version)

const gameArtifact = (
    bucket: string,
    packageId: string,
    kind: ArtifactKind,
    version: string
): PublishedArtifact =>
    gcsArtifact(
        kind,
        version,
        gameReleaseTag(packageId, kind, version),
        `gs://${bucket}/games/${packageId}/${kind}/${version}`
    )

export const fetchServingVersions = (
    context: PublishContext,
    packageId: string
): Promise<ServingLookup> =>
    fetchServing(context.deployConfig, (manifest) => {
        const entry = manifest.games.find((game) => game.packageId === packageId)
        return entry ? { logic: entry.logicVersion, ui: entry.uiVersion } : null
    })

export type PublishableGame = {
    entry: GameManifestEntry
    manifest: SiteManifest
    artifacts: PublishedArtifact[]
}

export const assertGamePublishable = async (
    context: PublishContext,
    game: string,
    kinds: ArtifactKind[]
): Promise<PublishableGame> => {
    const bucket = assertDeployConfig(context.deployConfig)
    const entry = findGameEntry(await readManifest(context.manifestPath), game)
    await assertCleanWorkingTree(context.repoRoot)
    const manifest = await loadManifestAssertingSynced(context, 'release-game')
    const versions = await readGamePackageVersions(context.repoRoot, entry.packageId)
    const artifacts = kinds.map((kind) =>
        gameArtifact(bucket, entry.packageId, kind, versions[kind])
    )
    await assertArtifactsPublishable(context, artifacts, 'release-game')
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
    await runReportedDeploy(
        context,
        entry.gameId,
        artifacts,
        () => fetchServingVersions(context, entry.packageId),
        () => buildAndUpload(context, entry.packageId, manifest, options.includeLogic)
    )
}

const releaseCommitMessage = (gameId: string, planned: GameVersionBump) =>
    planned.logic
        ? `Release ${gameId} logic ${planned.logic.next} and ui ${planned.ui.next}`
        : `Release ${gameId} ui ${planned.ui.next}`

const plannedTags = (packageId: string, planned: GameVersionBump): string[] => [
    ...(planned.logic ? [logicReleaseTag(packageId, planned.logic.next)] : []),
    uiReleaseTag(packageId, planned.ui.next)
]

export const releaseGame = async (context: PublishContext, options: GameReleaseOptions) => {
    if (options.deploy) {
        assertDeployConfig(context.deployConfig)
    }
    const entry = findGameEntry(await readManifest(context.manifestPath), options.game)
    const packageId = entry.packageId

    const planned = await planGameVersionBump(context.repoRoot, packageId, options.bump, {
        includeLogic: options.includeLogic
    })
    const tags = plannedTags(packageId, planned)
    const branch = await prepareRelease(context, tags)

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
    await commitTagAndPush(context, branch, {
        files,
        message: releaseCommitMessage(entry.gameId, planned),
        tags
    })

    if (options.deploy) {
        await deployGame(context, { game: options.game, includeLogic: options.includeLogic })
    }
}
