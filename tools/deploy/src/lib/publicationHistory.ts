import { fetchFrontendServingVersion } from './frontendPublish.js'
import { fetchServingVersions, findGameEntry } from './gamePublish.js'
import { gcsPathExists } from './gcs.js'
import {
    assertDeployConfig,
    publishManifest,
    runReportedDeploy,
    type PublishContext,
    type PublishedArtifact
} from './publishCore.js'
import {
    fetchBucketManifest,
    frontendHistory,
    gameHistory,
    previousFrontendVersion,
    previousGamePublication,
    withFrontendVersion,
    withGameVersions
} from './remoteManifest.js'
import type {
    FrontendVersionRecord,
    GameCatalogueEntry,
    GameManifestEntry,
    PublicationRecord,
    SiteManifest
} from './types.js'

export type HistoryTarget = { game: string } | { frontend: true }

export type GameSwitch = { logicVersion?: string; uiVersion?: string }

const gameEntry = (manifest: SiteManifest, game: GameCatalogueEntry): GameManifestEntry => {
    const entry = manifest.games.find((candidate) => candidate.packageId === game.packageId)
    if (!entry) {
        throw new Error(`${game.gameId} has never been published; there is no history to use`)
    }
    return entry
}

const describeRecord = (record: PublicationRecord | FrontendVersionRecord, current: boolean) => {
    const version =
        'logicVersion' in record
            ? `logic ${record.logicVersion} / ui ${record.uiVersion}`
            : `frontend ${record.version}`
    const details = [
        record.deployedAt ?? 'deployed before history was kept',
        record.commitSha ? `commit ${record.commitSha.slice(0, 7)}` : undefined
    ].filter(Boolean)
    return `${current ? '* ' : '  '}${version}  (${details.join(', ')})`
}

export const listHistory = async (context: PublishContext, target: HistoryTarget) => {
    const manifest = await fetchBucketManifest(context.deployConfig)
    if ('frontend' in target) {
        context.log('frontend publications, newest first (* = current):')
        for (const record of frontendHistory(manifest)) {
            context.log(describeRecord(record, record.version === manifest.frontend.version))
        }
        return
    }
    const game = findGameEntry(context.catalogue, target.game)
    const entry = gameEntry(manifest, game)
    context.log(`${game.gameId} publications, newest first (* = current):`)
    for (const record of gameHistory(entry)) {
        const current =
            record.logicVersion === entry.logicVersion && record.uiVersion === entry.uiVersion
        context.log(describeRecord(record, current))
    }
}

const existingArtifact = (
    kind: string,
    version: string,
    destination: string,
    marker: string
): PublishedArtifact => ({
    kind,
    version,
    tag: '',
    destination,
    published: () => gcsPathExists(`${destination}/${marker}`)
})

const assertArtifactsExist = async (artifacts: PublishedArtifact[]) => {
    for (const artifact of artifacts) {
        if (!(await artifact.published())) {
            throw new Error(`${artifact.destination} is not in the bucket; cannot select it`)
        }
    }
}

const LOGIC_ROLLBACK_CAUTION =
    'selecting older logic: games whose state was written by newer logic need explicit ' +
    'reverse compatibility (docs/contexts/game-distribution/CONTEXT.md, Logic Rollback)'

const applyGamePublication = async (
    context: PublishContext,
    game: GameCatalogueEntry,
    entry: GameManifestEntry,
    target: { logicVersion: string; uiVersion: string },
    operation: string
) => {
    const bucket = assertDeployConfig(context.deployConfig)
    if (target.logicVersion === entry.logicVersion && target.uiVersion === entry.uiVersion) {
        throw new Error(
            `${game.gameId} already serves logic ${target.logicVersion} / ui ${target.uiVersion}`
        )
    }
    const base = `gs://${bucket}/games/${game.packageId}`
    const artifacts = [
        existingArtifact(
            'logic',
            target.logicVersion,
            `${base}/logic/${target.logicVersion}`,
            'index.js'
        ),
        existingArtifact('ui', target.uiVersion, `${base}/ui/${target.uiVersion}`, 'index.js')
    ]
    await assertArtifactsExist(artifacts)
    if (target.logicVersion !== entry.logicVersion) {
        context.log(`${game.gameId} ${LOGIC_ROLLBACK_CAUTION}`)
    }
    await runReportedDeploy(
        context,
        game.gameId,
        artifacts,
        () => fetchServingVersions(context, game.packageId),
        () =>
            publishManifest(context, `${game.gameId}-${operation}`, (manifest) =>
                withGameVersions(manifest, game, target, { deployedAt: new Date().toISOString() })
            )
    )
}

const applyFrontendVersion = async (
    context: PublishContext,
    manifest: SiteManifest,
    version: string,
    operation: string
) => {
    const bucket = assertDeployConfig(context.deployConfig)
    if (version === manifest.frontend.version) {
        throw new Error(`frontend already serves ${version}`)
    }
    const artifact = existingArtifact(
        'frontend',
        version,
        `gs://${bucket}/frontend/${version}`,
        'index.html'
    )
    await assertArtifactsExist([artifact])
    await runReportedDeploy(
        context,
        'frontend',
        [artifact],
        () => fetchFrontendServingVersion(context),
        () =>
            publishManifest(context, `frontend-${operation}`, (current) =>
                withFrontendVersion(current, version, { deployedAt: new Date().toISOString() })
            )
    )
}

export const rollback = async (context: PublishContext, target: HistoryTarget) => {
    const manifest = await fetchBucketManifest(context.deployConfig)
    if ('frontend' in target) {
        const previous = previousFrontendVersion(manifest)
        if (!previous) throw new Error('frontend has no earlier publication to roll back to')
        await applyFrontendVersion(
            context,
            manifest,
            previous.version,
            `rollback-${previous.version}`
        )
        return
    }
    const game = findGameEntry(context.catalogue, target.game)
    const entry = gameEntry(manifest, game)
    const previous = previousGamePublication(entry)
    if (!previous) throw new Error(`${game.gameId} has no earlier publication to roll back to`)
    await applyGamePublication(
        context,
        game,
        entry,
        previous,
        `rollback-${previous.logicVersion}-${previous.uiVersion}`
    )
}

export const switchGame = async (context: PublishContext, game: string, selection: GameSwitch) => {
    if (!selection.logicVersion && !selection.uiVersion) {
        throw new Error('switch needs --ui-version and/or --logic-version')
    }
    if (selection.logicVersion && !selection.uiVersion) {
        throw new Error(
            'logic cannot be selected without the UI that embeds it; pass --ui-version too'
        )
    }
    const manifest = await fetchBucketManifest(context.deployConfig)
    const catalogueEntry = findGameEntry(context.catalogue, game)
    const entry = gameEntry(manifest, catalogueEntry)
    const target = {
        logicVersion: selection.logicVersion ?? entry.logicVersion,
        uiVersion: selection.uiVersion ?? entry.uiVersion
    }
    await applyGamePublication(
        context,
        catalogueEntry,
        entry,
        target,
        `switch-${target.logicVersion}-${target.uiVersion}`
    )
}

export const switchFrontend = async (context: PublishContext, version: string) => {
    const manifest = await fetchBucketManifest(context.deployConfig)
    await applyFrontendVersion(context, manifest, version, `switch-${version}`)
}
