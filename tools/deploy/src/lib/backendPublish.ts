import fs from 'node:fs'
import path from 'node:path'
import {
    buildBackendCommand,
    buildBackendImageContextCommand,
    deployBackendCommand,
    promoteBackendCommand,
    revisionSuffixForVersion,
    routeTrafficToRevisionCommand,
    submitBackendImageCommand
} from './commands.js'
import { artifactImageExists, cloudRunRevisionExists } from './gcs.js'
import { headCommitSha } from './git.js'
import {
    checkArtifactsPublishable,
    assertCleanWorkingTree,
    commitTagAndPush,
    describeServing,
    fetchServing,
    prepareRelease,
    runReportedDeploy,
    runSpec,
    type PublishContext,
    type PublishedArtifact,
    type ServingLookup
} from './publishCore.js'
import type { DeployConfig } from './types.js'
import {
    backendReleaseTag,
    bumpVersion,
    getBackendPackagePath,
    readPackageVersion,
    writePackageVersion,
    type BumpType
} from './versions.js'

export const BACKEND_PACKAGE = '@tabletop/backend'

export type BackendService = 'backend' | 'tasks'

// The backend hands work to the tasks service, so tasks must be running the new version before
// backend is. Every deploy and promotion orders the services this way regardless of input.
const SERVICE_ROLLOUT_ORDER: BackendService[] = ['tasks', 'backend']

export const orderServices = (services: BackendService[]): BackendService[] =>
    SERVICE_ROLLOUT_ORDER.filter((service) => services.includes(service))

export type BackendDeployOptions = {
    services: BackendService[]
    serveTraffic: boolean
}

export type BackendReleaseOptions = BackendDeployOptions & {
    bump: BumpType
    deploy: boolean
}

type BackendTarget = { image: string; project: string; region: string; services: string[] }

export const resolveBackendTarget = (
    deployConfig: DeployConfig,
    services: BackendService[]
): BackendTarget => {
    const backend = deployConfig.backend
    if (!backend?.image || !backend.project || !backend.region || !backend.service) {
        throw new Error(
            'Missing backend deploy config: backend.image, backend.project, backend.region, ' +
                'and backend.service are required'
        )
    }
    if (backend.image.includes(':')) {
        throw new Error('backend.image must not include a tag; the release version is the tag')
    }
    if (!deployConfig.backendManifestUrl) {
        throw new Error('Missing backendManifestUrl (needed to verify the serving backend)')
    }
    const serviceNames = orderServices(services).map((service) =>
        service === 'backend' ? backend.service : (backend.tasksService ?? 'tasks')
    )
    return {
        image: backend.image,
        project: backend.project,
        region: backend.region,
        services: serviceNames.filter((name): name is string => typeof name === 'string')
    }
}

const backendArtifact = (target: BackendTarget, version: string): PublishedArtifact => {
    const image = `${target.image}:${version}`
    return {
        kind: 'backend',
        version,
        tag: backendReleaseTag(version),
        destination: image,
        published: () => artifactImageExists(image, target.project)
    }
}

export const fetchBackendServingVersion = (context: PublishContext): Promise<ServingLookup> =>
    fetchServing(context.deployConfig, (manifest) => {
        const backend = manifest.backend
        if (!backend) return null
        const version =
            backend.version ??
            (backend.buildSha ? `sha ${backend.buildSha.slice(0, 7)}` : null) ??
            (backend.revision ? `revision ${backend.revision}` : null)
        return version ? { backend: version } : null
    })

const assertProductionEnvPresent = (repoRoot: string) => {
    const envFile = path.join(repoRoot, 'apps', 'backend', '.env.prod')
    if (!fs.existsSync(envFile)) {
        throw new Error(`Missing ${envFile}; the backend image bakes it in`)
    }
}

const buildAndDeploy = async (
    context: PublishContext,
    target: BackendTarget,
    artifact: PublishedArtifact,
    pending: PublishedArtifact[],
    serveTraffic: boolean
) => {
    const sha = await headCommitSha(context.repoRoot)
    if (pending.length > 0) {
        await runSpec(context, buildBackendCommand(context.repoRoot, { force: true }))
        await runSpec(context, buildBackendImageContextCommand(context.repoRoot))
        await runSpec(
            context,
            submitBackendImageCommand(context.repoRoot, artifact.destination, target.project)
        )
    }
    const revisionSuffix = revisionSuffixForVersion(artifact.version)
    for (const service of target.services) {
        const revision = `${service}-${revisionSuffix}`
        if (await cloudRunRevisionExists(revision, target.project, target.region)) {
            context.log(`${revision} already exists; reusing it`)
            if (serveTraffic) {
                await runSpec(
                    context,
                    routeTrafficToRevisionCommand(
                        context.repoRoot,
                        service,
                        revision,
                        context.deployConfig
                    )
                )
            }
            continue
        }
        await runSpec(
            context,
            deployBackendCommand(context.repoRoot, context.deployConfig, {
                service,
                image: artifact.destination,
                allowTraffic: serveTraffic,
                revisionSuffix,
                envVars: {
                    BACKEND_VERSION: artifact.version,
                    GIT_SHA: sha,
                    BUILD_TIME: new Date().toISOString()
                }
            })
        )
    }
}

export const deployBackend = async (context: PublishContext, options: BackendDeployOptions) => {
    const target = resolveBackendTarget(context.deployConfig, options.services)
    assertProductionEnvPresent(context.repoRoot)
    await assertCleanWorkingTree(context.repoRoot)
    const version = await readPackageVersion(getBackendPackagePath(context.repoRoot))
    const artifact = backendArtifact(target, version)
    const { pending } = await checkArtifactsPublishable(context, [artifact], 'release-backend')

    await runReportedDeploy(
        context,
        `backend (${target.services.join(', ')})`,
        [artifact],
        () => fetchBackendServingVersion(context),
        () => buildAndDeploy(context, target, artifact, pending, options.serveTraffic),
        { verifyServing: options.serveTraffic }
    )
}

export const releaseBackend = async (context: PublishContext, options: BackendReleaseOptions) => {
    if (options.deploy) {
        resolveBackendTarget(context.deployConfig, options.services)
        assertProductionEnvPresent(context.repoRoot)
    }
    const packagePath = getBackendPackagePath(context.repoRoot)
    const previous = await readPackageVersion(packagePath)
    const next = bumpVersion(previous, options.bump)
    const tag = backendReleaseTag(next)
    const branch = await prepareRelease(context, [tag])

    await writePackageVersion(packagePath, next)
    context.log(`backend: ${previous} -> ${next}`)

    await commitTagAndPush(context, branch, {
        files: [path.relative(context.repoRoot, packagePath)],
        message: `Release backend ${next}`,
        tags: [tag]
    })

    if (options.deploy) {
        await deployBackend(context, {
            services: options.services,
            serveTraffic: options.serveTraffic
        })
    }
}

export const promoteBackend = async (context: PublishContext, services: BackendService[]) => {
    const target = resolveBackendTarget(context.deployConfig, services)
    const servingBefore = await fetchBackendServingVersion(context)
    context.log(`backend serving before promote: ${describeServing(servingBefore)}`)
    for (const service of target.services) {
        await runSpec(
            context,
            promoteBackendCommand(context.repoRoot, service, context.deployConfig)
        )
    }
    const servingAfter = await fetchBackendServingVersion(context)
    context.log(`backend (${target.services.join(', ')}) promoted to latest revision`)
    context.log(`backend serving now: ${describeServing(servingAfter)}`)
}
