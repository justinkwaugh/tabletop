import path from 'node:path'
import { buildFrontendCommand, deployFrontendCommand } from './commands.js'
import { readManifest, writeManifest } from './manifest.js'
import {
    checkArtifactsPublishable,
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
import type { SiteManifest } from './types.js'
import {
    bumpVersion,
    frontendReleaseTag,
    getFrontendPackagePath,
    readPackageVersion,
    syncManifestFromPackages,
    writePackageVersion,
    type BumpType
} from './versions.js'

export const FRONTEND_PACKAGE = '@tabletop/frontend'

export type FrontendReleaseOptions = {
    bump: BumpType
    deploy: boolean
}

const frontendArtifact = (bucket: string, version: string): PublishedArtifact =>
    gcsArtifact(
        'frontend',
        version,
        frontendReleaseTag(version),
        `gs://${bucket}/frontend/${version}`
    )

export const fetchFrontendServingVersion = (context: PublishContext): Promise<ServingLookup> =>
    fetchServing(context.deployConfig, (manifest) => ({ frontend: manifest.frontend.version }))

type PublishableFrontend = {
    manifest: SiteManifest
    artifacts: PublishedArtifact[]
    pending: PublishedArtifact[]
}

const assertFrontendPublishable = async (context: PublishContext): Promise<PublishableFrontend> => {
    const bucket = assertDeployConfig(context.deployConfig)
    await assertCleanWorkingTree(context.repoRoot)
    const manifest = await loadManifestAssertingSynced(context, 'release-frontend')
    const version = await readPackageVersion(getFrontendPackagePath(context.repoRoot))
    const artifacts = [frontendArtifact(bucket, version)]
    const { pending } = await checkArtifactsPublishable(context, artifacts, 'release-frontend')
    return { manifest, artifacts, pending }
}

const buildAndUpload = async (
    context: PublishContext,
    manifest: SiteManifest,
    pending: PublishedArtifact[]
) => {
    if (pending.length > 0) {
        await runSpec(context, buildFrontendCommand(context.repoRoot))
        await runDeploysWithDirectoryPlaceholders(context, [
            deployFrontendCommand(context.repoRoot, manifest, context.deployConfig)
        ])
    }
    await publishManifest(context)
}

export const deployFrontend = async (context: PublishContext) => {
    const { manifest, artifacts, pending } = await assertFrontendPublishable(context)
    await runReportedDeploy(
        context,
        'frontend',
        artifacts,
        () => fetchFrontendServingVersion(context),
        () => buildAndUpload(context, manifest, pending)
    )
}

export const releaseFrontend = async (context: PublishContext, options: FrontendReleaseOptions) => {
    if (options.deploy) {
        assertDeployConfig(context.deployConfig)
    }
    const packagePath = getFrontendPackagePath(context.repoRoot)
    const previous = await readPackageVersion(packagePath)
    const next = bumpVersion(previous, options.bump)
    const tag = frontendReleaseTag(next)
    const branch = await prepareRelease(context, [tag])

    await writePackageVersion(packagePath, next)
    context.log(`frontend: ${previous} -> ${next}`)

    const manifest = await readManifest(context.manifestPath)
    const { manifest: syncedManifest } = await syncManifestFromPackages(context.repoRoot, manifest)
    await writeManifest(context.manifestPath, syncedManifest)

    await commitTagAndPush(context, branch, {
        files: [packagePath, context.manifestPath].map((file) =>
            path.relative(context.repoRoot, file)
        ),
        message: `Release frontend ${next}`,
        tags: [tag]
    })

    if (options.deploy) {
        await deployFrontend(context)
    }
}
