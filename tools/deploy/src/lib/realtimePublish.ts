import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runCommand, type CommandSpec } from './commands.js'
import { isObject } from './json.js'
import {
    assertCleanWorkingTree,
    checkArtifactsPublishable,
    commitTagAndPush,
    describeServing,
    prepareRelease,
    runReportedDeploy,
    runSpec,
    runStep,
    type PublishContext,
    type PublishedArtifact,
    type ServingLookup
} from './publishCore.js'
import type { DeployConfig } from './types.js'
import {
    bumpVersion,
    getRealtimePackagePath,
    readPackageVersion,
    realtimeReleaseTag,
    writePackageVersion,
    type BumpType
} from './versions.js'

export const REALTIME_PACKAGE = '@tabletop/realtime'

export type RealtimeTarget = {
    project: string
    zone: string
    instance: string
    healthUrl: string
}

export type RealtimeReleaseOptions = {
    bump: BumpType
    deploy: boolean
}

export const resolveRealtimeTarget = (deployConfig: DeployConfig): RealtimeTarget => {
    const realtime = deployConfig.realtime
    const project = deployConfig.backend?.project
    if (!realtime?.instance || !realtime.zone || !realtime.healthUrl || !project) {
        throw new Error(
            'Missing realtime deploy config: realtime.instance, realtime.zone, ' +
                'realtime.healthUrl, and backend.project are required'
        )
    }
    return {
        project,
        zone: realtime.zone,
        instance: realtime.instance,
        healthUrl: realtime.healthUrl
    }
}

// OS Login names the remote user after the active account, which a credential file override
// leaves unset, so SSH needs the key's own account named explicitly.
export const cloudSdkAccountEnv = async (): Promise<Record<string, string>> => {
    const credentialFile = process.env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE
    if (!credentialFile) return {}
    const key: unknown = JSON.parse(await fs.readFile(credentialFile, 'utf8'))
    return isObject(key) && typeof key.client_email === 'string'
        ? { CLOUDSDK_CORE_ACCOUNT: key.client_email }
        : {}
}

const gcloudTargetArgs = (target: RealtimeTarget) => [
    '--project',
    target.project,
    '--zone',
    target.zone,
    '--tunnel-through-iap',
    '--quiet'
]

export const realtimeSshCommand = (
    repoRoot: string,
    target: RealtimeTarget,
    label: string,
    remoteCommand: string,
    env: Record<string, string>
): CommandSpec => ({
    label,
    command: 'gcloud',
    args: [
        'compute',
        'ssh',
        target.instance,
        ...gcloudTargetArgs(target),
        `--command=${remoteCommand}`
    ],
    cwd: repoRoot,
    logPath: `/tmp/${label}.log`,
    env
})

export const realtimeCopyCommand = (
    repoRoot: string,
    target: RealtimeTarget,
    bundleDir: string,
    remoteDir: string,
    env: Record<string, string>
): CommandSpec => ({
    label: 'copy-realtime',
    command: 'gcloud',
    args: [
        'compute',
        'scp',
        '--recurse',
        ...gcloudTargetArgs(target),
        bundleDir,
        `${target.instance}:${remoteDir}`
    ],
    cwd: repoRoot,
    logPath: '/tmp/copy-realtime.log',
    env
})

export const buildRealtimeCommand = (
    repoRoot: string,
    version: string,
    output: string
): CommandSpec => ({
    label: 'build-realtime',
    command: 'go',
    args: [
        'build',
        '-trimpath',
        `-ldflags=-s -X main.version=${version}`,
        '-o',
        output,
        './cmd/realtime'
    ],
    cwd: path.join(repoRoot, 'apps', 'realtime'),
    logPath: '/tmp/realtime-build.log',
    env: { CGO_ENABLED: '0', GOOS: 'linux', GOARCH: 'amd64' }
})

export const parseRealtimeStats = (output: string): ServingLookup => {
    let stats: unknown
    try {
        stats = JSON.parse(output)
    } catch {
        return { error: 'the relay stats are not JSON' }
    }
    return isObject(stats) && typeof stats.version === 'string'
        ? { realtime: stats.version }
        : { error: 'the relay stats name no version' }
}

export const fetchRealtimeServingVersion = async (
    context: PublishContext
): Promise<ServingLookup> => {
    const target = resolveRealtimeTarget(context.deployConfig)
    const spec = realtimeSshCommand(
        context.repoRoot,
        target,
        'realtime-stats',
        'curl -fsS 127.0.0.1:8091',
        await cloudSdkAccountEnv()
    )
    let output = ''
    try {
        await runCommand(spec, { onStdout: (chunk) => (output += chunk) })
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return { error: `the relay stats could not be read (${reason}; see ${spec.logPath})` }
    }
    return parseRealtimeStats(output)
}

const HEALTH_LOG = '/tmp/realtime-health.log'

const checkPublicHealth = (context: PublishContext, target: RealtimeTarget) =>
    runStep(context, { label: 'realtime-health', logPath: HEALTH_LOG }, async () => {
        const response = await fetch(target.healthUrl)
        await fs.writeFile(HEALTH_LOG, `${target.healthUrl} answered ${response.status}\n`)
        if (response.status !== 200) {
            throw new Error(`${target.healthUrl} answered ${response.status}`)
        }
    })

const installRelease = async (context: PublishContext, target: RealtimeTarget, version: string) => {
    const env = await cloudSdkAccountEnv()
    const bundle = await fs.mkdtemp(path.join(os.tmpdir(), 'realtime-release-'))
    const remoteDir = `realtime-release-${version}`
    try {
        await runSpec(
            context,
            buildRealtimeCommand(context.repoRoot, version, path.join(bundle, 'realtime'))
        )
        await fs.cp(path.join(context.repoRoot, 'apps', 'realtime', 'deploy'), bundle, {
            recursive: true
        })
        await runSpec(
            context,
            realtimeSshCommand(
                context.repoRoot,
                target,
                'clear-realtime-upload',
                `rm -rf ~/${remoteDir}`,
                env
            )
        )
        await runSpec(
            context,
            realtimeCopyCommand(context.repoRoot, target, bundle, remoteDir, env)
        )
        await runSpec(
            context,
            realtimeSshCommand(
                context.repoRoot,
                target,
                'install-realtime',
                `sudo bash ~/${remoteDir}/install-release.sh ${version}; status=$?; rm -rf ~/${remoteDir}; exit $status`,
                env
            )
        )
    } finally {
        await fs.rm(bundle, { recursive: true, force: true })
    }
    await checkPublicHealth(context, target)
}

export const deployRealtime = async (context: PublishContext) => {
    const target = resolveRealtimeTarget(context.deployConfig)
    await assertCleanWorkingTree(context.repoRoot)
    const version = await readPackageVersion(getRealtimePackagePath(context.repoRoot))
    const artifact: PublishedArtifact = {
        kind: 'realtime',
        version,
        tag: realtimeReleaseTag(version),
        destination: `${target.instance} (${target.zone})`,
        published: async () => false
    }
    await checkArtifactsPublishable(context, [artifact], 'release-realtime')
    await runReportedDeploy(
        context,
        'realtime',
        [artifact],
        () => fetchRealtimeServingVersion(context),
        () => installRelease(context, target, version),
        { verifyServing: true, settle: { timeoutMs: 30_000, intervalMs: 5_000 } }
    )
}

export const releaseRealtime = async (context: PublishContext, options: RealtimeReleaseOptions) => {
    if (options.deploy) resolveRealtimeTarget(context.deployConfig)
    const packagePath = getRealtimePackagePath(context.repoRoot)
    const previous = await readPackageVersion(packagePath)
    const next = bumpVersion(previous, options.bump)
    const tag = realtimeReleaseTag(next)
    const branch = await prepareRelease(context, [tag])

    await writePackageVersion(packagePath, next)
    context.log(`realtime: ${previous} -> ${next}`)

    await commitTagAndPush(context, branch, {
        files: [path.relative(context.repoRoot, packagePath)],
        message: `Release realtime ${next}`,
        tags: [tag]
    })

    if (options.deploy) await deployRealtime(context)
}

export const rollbackRealtime = async (context: PublishContext) => {
    const target = resolveRealtimeTarget(context.deployConfig)
    const before = await fetchRealtimeServingVersion(context)
    context.log(`realtime serving before rollback: ${describeServing(before)}`)
    await runSpec(
        context,
        realtimeSshCommand(
            context.repoRoot,
            target,
            'rollback-realtime',
            'sudo bash /usr/local/lib/realtime/rollback-release.sh',
            await cloudSdkAccountEnv()
        )
    )
    await checkPublicHealth(context, target)
    context.log(
        `realtime serving now: ${describeServing(await fetchRealtimeServingVersion(context))}`
    )
}
