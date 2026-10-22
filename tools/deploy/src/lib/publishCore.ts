import {
    fetchBackendManifest,
    invalidateBackendManifestCache,
    type BackendReplacement
} from './backend.js'
import {
    backupManifestCommand,
    dedupeCommandSpecs,
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
import { writeManifest } from './manifest.js'
import { fetchBucketManifest, manifestBackupUrl, writeTemporaryManifest } from './remoteManifest.js'
import type { BackendManifest, DeployConfig, GameCatalogueEntry, SiteManifest } from './types.js'

export { assertCleanWorkingTree } from './git.js'

export type PublishContext = {
    repoRoot: string
    catalogue: GameCatalogueEntry[]
    deployConfig: DeployConfig
    log: (message: string) => void
}

export type PublishedArtifact = {
    kind: string
    version: string
    tag: string
    destination: string
    published: () => Promise<boolean>
}

export const gcsArtifact = (
    kind: string,
    version: string,
    tag: string,
    destination: string
): PublishedArtifact => ({
    kind,
    version,
    tag,
    destination,
    published: () => gcsPathExists(destination)
})

export type ServingVersions = Record<string, string>

export type ServingLookup = ServingVersions | { error: string }

export const runStep = async (
    context: PublishContext,
    spec: { label: string; logPath: string },
    action: () => Promise<void>
) => {
    context.log(`${spec.label}: running (log: ${spec.logPath})`)
    await action()
    context.log(`${spec.label}: complete`)
}

export const runSpec = (context: PublishContext, spec: CommandSpec) =>
    runStep(context, spec, () => runCommand(spec))

const runDirectoryPlaceholders = async (context: PublishContext, specs: CommandSpec[]) => {
    const placeholderSpecs = dedupeCommandSpecs(
        specs.flatMap((spec) => directoryPlaceholderSpecs(context.repoRoot, spec))
    )
    for (const placeholder of placeholderSpecs) {
        await runSpec(context, placeholder)
    }
}

export const runDeploysWithDirectoryPlaceholders = async (
    context: PublishContext,
    specs: CommandSpec[]
) => {
    await runDirectoryPlaceholders(context, specs)
    for (const spec of specs) {
        await runSpec(context, spec)
    }
}

export type PreparedManifestPublication = {
    before: SiteManifest
    write: (change: (manifest: SiteManifest) => SiteManifest) => Promise<void>
    invalidateBackend: () => Promise<void>
}

export const invalidateBackendManifest = (context: PublishContext) =>
    runStep(
        context,
        { label: 'invalidate-manifest', logPath: '/tmp/manifest-invalidate.log' },
        async () =>
            context.log(
                `invalidate-manifest: ${describeReplacement(
                    await invalidateBackendManifestCache(context.deployConfig)
                )}`
            )
    )

const describeReplacement = (replacement: BackendReplacement | undefined) => {
    switch (replacement) {
        case 'activated':
            return 'the backend activated the selected title logic'
        case 'none':
            return 'no backend replacement was needed'
        case 'superseded':
            return 'the backend finished replacing its process'
        case 'replacement-failed':
            return 'WARNING the backend replacement failed; it keeps serving and retries in 30 s'
        case undefined:
            return 'the backend did not report a replacement (it predates backend 1.25.0)'
    }
}

// The bucket manifest is the only record of what production serves. Every change backs up the
// current copy, then rereads it, writes the changed copy, and invalidates the backend cache.
// Preparing does the backup and bucket folders first, so a caller can switch something else
// and the manifest only seconds apart.
export const prepareManifestPublication = async (
    context: PublishContext,
    operation: string
): Promise<PreparedManifestPublication> => {
    const before = await fetchBucketManifest(context.deployConfig)
    const manifestPath = await writeTemporaryManifest(before)
    const backup = backupManifestCommand(
        context.repoRoot,
        context.deployConfig,
        manifestBackupUrl(context.deployConfig, operation, new Date())
    )
    const deploy = deployManifestCommand(manifestPath, context.deployConfig)
    await runDirectoryPlaceholders(context, [backup, deploy])
    await runSpec(context, backup)
    return {
        before,
        write: async (change) => {
            await writeManifest(
                manifestPath,
                change(await fetchBucketManifest(context.deployConfig))
            )
            await runSpec(context, deploy)
        },
        invalidateBackend: () => invalidateBackendManifest(context)
    }
}

export const publishManifest = async (
    context: PublishContext,
    operation: string,
    change: (manifest: SiteManifest) => SiteManifest
) => {
    const publication = await prepareManifestPublication(context, operation)
    await publication.write(change)
    await publication.invalidateBackend()
}

export const assertDeployConfig = (deployConfig: DeployConfig): string => {
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

// A version's artifact is immutable, but a deploy can fail after uploading it. Because the
// release tag pins the source, an existing artifact for the tagged version is reused so the
// remaining steps can be retried without spending another version.
export const checkArtifactsPublishable = async (
    context: PublishContext,
    artifacts: PublishedArtifact[],
    releaseCommand: string
): Promise<{ pending: PublishedArtifact[]; reused: PublishedArtifact[] }> => {
    const headTags = await tagsAtHead(context.repoRoot)
    for (const artifact of artifacts) {
        if (!headTags.includes(artifact.tag)) {
            throw new Error(
                `HEAD is not tagged ${artifact.tag}; run ${releaseCommand} to create the release first`
            )
        }
    }
    const pending: PublishedArtifact[] = []
    const reused: PublishedArtifact[] = []
    for (const artifact of artifacts) {
        if (await artifact.published()) {
            context.log(
                `${artifact.destination} already exists for ${artifact.tag}; reusing it and skipping its build and upload`
            )
            reused.push(artifact)
        } else {
            pending.push(artifact)
        }
    }
    return { pending, reused }
}

export const fetchServing = async (
    deployConfig: DeployConfig,
    select: (manifest: BackendManifest, servedFrontendVersion?: string) => ServingVersions | null
): Promise<ServingLookup> => {
    const url = deployConfig.backendManifestUrl
    if (!url) return { error: 'backend manifest URL not configured' }
    const result = await fetchBackendManifest(url)
    if (!result.manifest) return { error: result.error ?? 'backend manifest unavailable' }
    return (
        select(result.manifest, result.servedFrontendVersion) ?? {
            error: 'backend manifest has no matching entry'
        }
    )
}

export const describeVersions = (artifacts: PublishedArtifact[]) =>
    artifacts.map((artifact) => `${artifact.kind} ${artifact.version}`).join(' / ')

export const describeServing = (serving: ServingLookup) =>
    'error' in serving
        ? `unknown (${serving.error})`
        : Object.entries(serving)
              .map(([kind, version]) => `${kind} ${version}`)
              .join(' / ')

const describeDeployment = (serving: ServingLookup, artifacts: PublishedArtifact[]) => {
    const deploying = describeVersions(artifacts)
    if ('error' in serving) return deploying
    const unchanged = Object.entries(serving)
        .filter(([kind]) => !artifacts.some((artifact) => artifact.kind === kind))
        .map(([kind, version]) => `${kind} stays ${version}`)
    return unchanged.length > 0 ? `${deploying} (${unchanged.join(', ')})` : deploying
}

const servesArtifacts = (serving: ServingLookup, artifacts: PublishedArtifact[]) =>
    !('error' in serving) &&
    artifacts.every((artifact) => serving[artifact.kind] === artifact.version)

export type ServingSettle = { timeoutMs: number; intervalMs: number }

// The backend activates new logic inside its worker on the next request each instance sees;
// instances that have not yet taken a request report the previous logic until they do.
const DEFAULT_SERVING_SETTLE: ServingSettle = { timeoutMs: 5 * 60_000, intervalMs: 5_000 }

export const pollUntil = async <Value>(
    read: () => Promise<Value>,
    done: (value: Value) => boolean,
    settle: ServingSettle,
    onWait: () => void = () => {}
): Promise<Value> => {
    const deadline = Date.now() + settle.timeoutMs
    let value = await read()
    if (!done(value)) onWait()
    while (!done(value) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, settle.intervalMs))
        value = await read()
    }
    return value
}

const awaitServing = async (
    context: PublishContext,
    label: string,
    artifacts: PublishedArtifact[],
    fetchServingVersions: () => Promise<ServingLookup>,
    settle: ServingSettle
): Promise<ServingLookup> => {
    const serving = await pollUntil(
        fetchServingVersions,
        (lookup) => servesArtifacts(lookup, artifacts),
        settle,
        () =>
            context.log(`${label} waiting for the backend to serve ${describeVersions(artifacts)}`)
    )
    if ('error' in serving) {
        throw new Error(
            `Deploy finished but the serving versions could not be read: ${serving.error}`
        )
    }
    if (!servesArtifacts(serving, artifacts)) {
        throw new Error(
            `Deploy finished but the backend still serves ${describeServing(serving)}; ` +
                'check /tmp/manifest-deploy.log, /tmp/manifest-invalidate.log and the backend ' +
                'logs for a failed title activation or process replacement'
        )
    }
    return serving
}

export type ReportedDeployOptions = {
    verifyServing: boolean
    settle?: ServingSettle
}

const describeError = (error: unknown) => (error instanceof Error ? error.message : error)

export const runReportedDeploy = async (
    context: PublishContext,
    label: string,
    artifacts: PublishedArtifact[],
    fetchServingVersions: () => Promise<ServingLookup>,
    deploy: () => Promise<void>,
    options: ReportedDeployOptions = { verifyServing: true }
) => {
    const servingBefore = await fetchServingVersions()
    context.log(`${label} serving before deploy: ${describeServing(servingBefore)}`)
    context.log(`${label} deploying: ${describeDeployment(servingBefore, artifacts)}`)

    try {
        await deploy()
    } catch (error) {
        const servingAfterFailure = await fetchServingVersions()
        context.log(`${label} deploy FAILED: ${describeError(error)}`)
        context.log(`${label} serving now: ${describeServing(servingAfterFailure)}`)
        throw error
    }

    const servingAfter = options.verifyServing
        ? await awaitServing(
              context,
              label,
              artifacts,
              fetchServingVersions,
              options.settle ?? DEFAULT_SERVING_SETTLE
          )
        : await fetchServingVersions()
    const outcome = options.verifyServing ? '' : ' (staged without traffic)'
    context.log(`${label} deploy SUCCEEDED: ${describeVersions(artifacts)}${outcome}`)
    context.log(`${label} serving now: ${describeServing(servingAfter)}`)
}

export type ReleaseCommit = {
    files: string[]
    message: string
    tags: string[]
}

export const prepareRelease = async (context: PublishContext, tags: string[]) => {
    await assertCleanWorkingTree(context.repoRoot)
    const branch = await currentBranch(context.repoRoot)
    for (const tag of tags) {
        if (await tagExists(context.repoRoot, tag)) {
            throw new Error(`Tag ${tag} already exists`)
        }
    }
    return branch
}

export const commitTagAndPush = async (
    context: PublishContext,
    branch: string,
    release: ReleaseCommit
) => {
    await commitFiles(context.repoRoot, release.files, release.message)
    context.log(`Committed: ${release.message}`)
    for (const tag of release.tags) {
        await createAnnotatedTag(context.repoRoot, tag, release.message)
        context.log(`Tagged ${tag}`)
    }
    await pushBranchAndTags(context.repoRoot, branch, release.tags)
    context.log(`Pushed ${branch} and ${release.tags.length} tag(s) to origin`)
}
