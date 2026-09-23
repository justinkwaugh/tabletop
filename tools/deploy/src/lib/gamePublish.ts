import path from 'node:path'
import {
    buildGameLogicCommand,
    buildGameLogicPackageCommand,
    buildGameUiCommand,
    buildGameUiPackageCommand,
    deployGameLogicCommand,
    deployGameUiCommand
} from './commands.js'
import {
    assertCleanWorkingTree,
    assertDeployConfig,
    checkArtifactsPublishable,
    commitTagAndPush,
    fetchServing,
    gcsArtifact,
    prepareRelease,
    publishManifest,
    runDeploysWithDirectoryPlaceholders,
    runReportedDeploy,
    runSpec,
    type PublishContext,
    type PublishedArtifact,
    type ServingLookup
} from './publishCore.js'
import { headCommitSha } from './git.js'
import { withGameVersions } from './remoteManifest.js'
import type { GameCatalogueEntry } from './types.js'
import {
    getGamePackagePaths,
    logicReleaseTag,
    planGameVersionBump,
    readGamePackageVersions,
    uiReleaseTag,
    writeGameVersionBump,
    type BumpType,
    type GamePackageVersions,
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

export const findGameEntry = (
    catalogue: GameCatalogueEntry[],
    game: string
): GameCatalogueEntry => {
    const entry = catalogue.find(
        (candidate) => candidate.gameId === game || candidate.packageId === game
    )
    if (!entry) {
        const known = catalogue.map((candidate) => candidate.gameId).join(', ')
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
    entry: GameCatalogueEntry
    versions: GamePackageVersions
    artifacts: PublishedArtifact[]
    pending: PublishedArtifact[]
}

export const assertGamePublishable = async (
    context: PublishContext,
    game: string,
    kinds: ArtifactKind[]
): Promise<PublishableGame> => {
    const bucket = assertDeployConfig(context.deployConfig)
    const entry = findGameEntry(context.catalogue, game)
    await assertCleanWorkingTree(context.repoRoot)
    const versions = await readGamePackageVersions(context.repoRoot, entry.packageId)
    const artifacts = kinds.map((kind) =>
        gameArtifact(bucket, entry.packageId, kind, versions[kind])
    )
    const { pending } = await checkArtifactsPublishable(context, artifacts, 'release-game')
    return { entry, versions, artifacts, pending }
}

const buildAndUpload = async (
    context: PublishContext,
    entry: GameCatalogueEntry,
    versions: GamePackageVersions,
    artifacts: PublishedArtifact[],
    pending: PublishedArtifact[]
) => {
    const packageId = entry.packageId
    const pendingKinds = pending.map((artifact) => artifact.kind)
    if (pendingKinds.includes('logic')) {
        await runSpec(context, buildGameLogicPackageCommand(context.repoRoot, packageId))
        await runSpec(context, buildGameLogicCommand(context.repoRoot, packageId))
    }
    if (pendingKinds.includes('ui')) {
        await runSpec(context, buildGameUiPackageCommand(context.repoRoot, packageId))
        await runSpec(context, buildGameUiCommand(context.repoRoot, packageId))
    }

    const deploySpecs = [
        ...(pendingKinds.includes('logic')
            ? [
                  deployGameLogicCommand(
                      context.repoRoot,
                      packageId,
                      versions.logic,
                      context.deployConfig
                  )
              ]
            : []),
        ...(pendingKinds.includes('ui')
            ? [deployGameUiCommand(context.repoRoot, packageId, versions.ui, context.deployConfig)]
            : [])
    ]
    await runDeploysWithDirectoryPlaceholders(context, deploySpecs)

    const deployedKinds = artifacts.map((artifact) => artifact.kind)
    const operation = `${entry.gameId}-${artifacts.map((a) => `${a.kind}-${a.version}`).join('-')}`
    const metadata = {
        deployedAt: new Date().toISOString(),
        commitSha: await headCommitSha(context.repoRoot),
        tags: artifacts.map((artifact) => artifact.tag)
    }
    await publishManifest(context, operation, (manifest) =>
        withGameVersions(
            manifest,
            entry,
            {
                logicVersion: deployedKinds.includes('logic') ? versions.logic : undefined,
                uiVersion: deployedKinds.includes('ui') ? versions.ui : undefined
            },
            metadata
        )
    )
}

export const deployGameArtifacts = async (
    context: PublishContext,
    game: string,
    kinds: ArtifactKind[]
) => {
    const { entry, versions, artifacts, pending } = await assertGamePublishable(
        context,
        game,
        kinds
    )
    await runReportedDeploy(
        context,
        entry.gameId,
        artifacts,
        () => fetchServingVersions(context, entry.packageId),
        () => buildAndUpload(context, entry, versions, artifacts, pending)
    )
}

export const deployGame = (context: PublishContext, options: GameArtifactSelection) =>
    deployGameArtifacts(context, options.game, options.includeLogic ? ['logic', 'ui'] : ['ui'])

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
    const entry = findGameEntry(context.catalogue, options.game)
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

    const packagePaths = getGamePackagePaths(context.repoRoot, packageId)
    const files = [...(planned.logic ? [packagePaths.logic] : []), packagePaths.ui].map((file) =>
        path.relative(context.repoRoot, file)
    )
    await commitTagAndPush(context, branch, {
        files,
        message: releaseCommitMessage(entry.gameId, planned),
        tags
    })

    if (options.deploy) {
        await deployGame(context, { game: options.game, includeLogic: options.includeLogic })
    }
}
