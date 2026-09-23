import path from 'node:path'
import { buildFrontendCommand, deployFrontendCommand } from './commands.js'
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
import { withFrontendVersion } from './remoteManifest.js'
import {
    bumpVersion,
    frontendReleaseTag,
    getFrontendPackagePath,
    readPackageVersion,
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
    version: string
    artifacts: PublishedArtifact[]
    pending: PublishedArtifact[]
}

const assertFrontendPublishable = async (context: PublishContext): Promise<PublishableFrontend> => {
    const bucket = assertDeployConfig(context.deployConfig)
    await assertCleanWorkingTree(context.repoRoot)
    const version = await readPackageVersion(getFrontendPackagePath(context.repoRoot))
    const artifacts = [frontendArtifact(bucket, version)]
    const { pending } = await checkArtifactsPublishable(context, artifacts, 'release-frontend')
    return { version, artifacts, pending }
}

const buildAndUpload = async (
    context: PublishContext,
    version: string,
    pending: PublishedArtifact[]
) => {
    if (pending.length > 0) {
        await runSpec(context, buildFrontendCommand(context.repoRoot))
        await runDeploysWithDirectoryPlaceholders(context, [
            deployFrontendCommand(context.repoRoot, version, context.deployConfig)
        ])
    }
    const metadata = {
        deployedAt: new Date().toISOString(),
        commitSha: await headCommitSha(context.repoRoot),
        tags: [frontendReleaseTag(version)]
    }
    await publishManifest(context, `frontend-${version}`, (manifest) =>
        withFrontendVersion(manifest, version, metadata)
    )
}

export const deployFrontend = async (context: PublishContext) => {
    const { version, artifacts, pending } = await assertFrontendPublishable(context)
    await runReportedDeploy(
        context,
        'frontend',
        artifacts,
        () => fetchFrontendServingVersion(context),
        () => buildAndUpload(context, version, pending)
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

    await commitTagAndPush(context, branch, {
        files: [path.relative(context.repoRoot, packagePath)],
        message: `Release frontend ${next}`,
        tags: [tag]
    })

    if (options.deploy) {
        await deployFrontend(context)
    }
}
