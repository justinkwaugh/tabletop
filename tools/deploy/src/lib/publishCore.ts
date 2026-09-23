import { fetchBackendManifest, invalidateBackendManifestCache } from './backend.js'
import {
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
import { readManifest } from './manifest.js'
import type { BackendManifest, DeployConfig, SiteManifest } from './types.js'
import { syncManifestFromPackages } from './versions.js'

export { assertCleanWorkingTree } from './git.js'

export type PublishContext = {
    repoRoot: string
    manifestPath: string
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

export const runDeploysWithDirectoryPlaceholders = async (
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

export const loadManifestAssertingSynced = async (
    context: PublishContext,
    releaseCommand: string
): Promise<SiteManifest> => {
    const manifest = await readManifest(context.manifestPath)
    const { changed } = await syncManifestFromPackages(context.repoRoot, manifest)
    if (changed) {
        throw new Error(
            'site-manifest.json does not match the package versions; ' +
                `run ${releaseCommand} to bump, sync, and commit them together`
        )
    }
    return manifest
}

export const assertArtifactsPublishable = async (
    context: PublishContext,
    artifacts: PublishedArtifact[],
    releaseCommand: string
) => {
    const headTags = await tagsAtHead(context.repoRoot)
    for (const artifact of artifacts) {
        if (!headTags.includes(artifact.tag)) {
            throw new Error(
                `HEAD is not tagged ${artifact.tag}; run ${releaseCommand} to create the release first`
            )
        }
    }
    for (const artifact of artifacts) {
        if (await artifact.published()) {
            throw new Error(
                `${artifact.destination} is already published; deployed versions are immutable, ` +
                    'so release a new version instead'
            )
        }
    }
}

export const fetchServing = async (
    deployConfig: DeployConfig,
    select: (manifest: BackendManifest) => ServingVersions | null
): Promise<ServingLookup> => {
    const url = deployConfig.backendManifestUrl
    if (!url) return { error: 'backend manifest URL not configured' }
    const result = await fetchBackendManifest(url)
    if (!result.manifest) return { error: result.error ?? 'backend manifest unavailable' }
    return select(result.manifest) ?? { error: 'backend manifest has no matching entry' }
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

const assertServingMatches = (serving: ServingLookup, artifacts: PublishedArtifact[]) => {
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

export const runReportedDeploy = async (
    context: PublishContext,
    label: string,
    artifacts: PublishedArtifact[],
    fetchServingVersions: () => Promise<ServingLookup>,
    deploy: () => Promise<void>,
    options: { verifyServing: boolean } = { verifyServing: true }
) => {
    const servingBefore = await fetchServingVersions()
    context.log(`${label} serving before deploy: ${describeServing(servingBefore)}`)
    context.log(`${label} deploying: ${describeDeployment(servingBefore, artifacts)}`)

    try {
        await deploy()
    } catch (error) {
        const servingAfterFailure = await fetchServingVersions()
        context.log(`${label} deploy FAILED: ${error instanceof Error ? error.message : error}`)
        context.log(`${label} serving now: ${describeServing(servingAfterFailure)}`)
        throw error
    }

    const servingAfter = await fetchServingVersions()
    if (options.verifyServing) {
        assertServingMatches(servingAfter, artifacts)
    }
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
