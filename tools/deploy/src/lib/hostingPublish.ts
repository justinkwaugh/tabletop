import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { downloadFrontendCommand, firebaseCommand } from './commands.js'
import { readGcsText } from './gcs.js'
import { isObject } from './json.js'
import { runSpec, type PublishContext } from './publishCore.js'
import { fetchBucketManifest } from './remoteManifest.js'

const FRONTEND_HOSTING_CONFIG = path.join('apps', 'frontend', 'firebase.json')
const STAGING_CHANNEL = 'frontend-staging'
const BUILD_ID_PATH = '_app/version.json'
const SERVED_BUILD_SETTLE = { timeoutMs: 2 * 60_000, intervalMs: 5_000 }

export type HostingTarget = {
    project: string
    configPath: string
    site: string
    channel: string
    hostingConfig: Record<string, unknown>
}

export type StagedFrontend = {
    version: string
    buildId: string
}

const readHostingConfig = async (configPath: string): Promise<Record<string, unknown>> => {
    const config: unknown = JSON.parse(await fs.readFile(configPath, 'utf8'))
    if (!isObject(config) || !isObject(config.hosting)) {
        throw new Error(`${FRONTEND_HOSTING_CONFIG} has no hosting section`)
    }
    return config.hosting
}

export const resolveHostingTarget = async (
    context: PublishContext
): Promise<HostingTarget | null> => {
    const channel = context.deployConfig.hosting?.channel
    if (!channel) return null
    const project = context.deployConfig.backend?.project
    if (!project) {
        throw new Error(
            'Firebase Hosting needs backend.project (or GCLOUD_PROJECT) for its project'
        )
    }
    const configPath = path.join(context.repoRoot, FRONTEND_HOSTING_CONFIG)
    const hostingConfig = await readHostingConfig(configPath)
    if (typeof hostingConfig.site !== 'string') {
        throw new Error(`${FRONTEND_HOSTING_CONFIG} must name its Hosting site`)
    }
    return { project, configPath, site: hostingConfig.site, channel, hostingConfig }
}

const requireHostingTarget = async (context: PublishContext): Promise<HostingTarget> => {
    const target = await resolveHostingTarget(context)
    if (!target) {
        throw new Error(
            'Firebase Hosting is not enabled; set hosting.channel in the deploy config ' +
                '(or TABLETOP_HOSTING_CHANNEL)'
        )
    }
    return target
}

const parseBuildId = (versionJson: string, source: string): string => {
    const parsed: unknown = JSON.parse(versionJson)
    if (!isObject(parsed) || typeof parsed.version !== 'string') {
        throw new Error(`${source} has no build version`)
    }
    return parsed.version
}

// The bucket copy is what the backend serves, so Hosting gets exactly those bytes; the
// repository's firebase.json supplies the routing and headers.
const stageFrontendOnHosting = async (
    context: PublishContext,
    target: HostingTarget,
    version: string
): Promise<StagedFrontend> => {
    const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tabletop-hosting-'))
    try {
        const siteDir = path.join(stagingDir, 'site')
        await fs.mkdir(siteDir)
        await runSpec(
            context,
            downloadFrontendCommand(context.repoRoot, version, context.deployConfig, siteDir)
        )
        const configPath = path.join(stagingDir, 'firebase.json')
        await fs.writeFile(
            configPath,
            JSON.stringify({ hosting: { ...target.hostingConfig, public: 'site' } }, null, 4)
        )
        await runSpec(
            context,
            firebaseCommand(
                context.repoRoot,
                'hosting-stage',
                { project: target.project, configPath },
                [
                    'hosting:channel:deploy',
                    STAGING_CHANNEL,
                    '--expires',
                    '7d',
                    '--no-authorized-domains'
                ]
            )
        )
        const buildId = parseBuildId(
            await fs.readFile(path.join(siteDir, BUILD_ID_PATH), 'utf8'),
            `frontend ${version}`
        )
        context.log(`hosting: staged frontend ${version} on channel ${STAGING_CHANNEL}`)
        return { version, buildId }
    } finally {
        await fs.rm(stagingDir, { recursive: true, force: true })
    }
}

const execFileAsync = promisify(execFile)

const channelUrl = async (context: PublishContext, target: HostingTarget): Promise<string> => {
    if (target.channel === 'live') return `https://${target.site}.web.app`
    const spec = firebaseCommand(context.repoRoot, 'hosting-channels', target, [
        'hosting:channel:list',
        '--site',
        target.site,
        '--json'
    ])
    const { stdout } = await execFileAsync(spec.command, spec.args, {
        cwd: spec.cwd,
        env: { ...process.env, ...spec.env },
        maxBuffer: 16 * 1024 * 1024
    })
    const listed: unknown = JSON.parse(stdout)
    const channels =
        isObject(listed) && isObject(listed.result) && Array.isArray(listed.result.channels)
            ? listed.result.channels
            : []
    for (const channel of channels) {
        if (
            isObject(channel) &&
            typeof channel.name === 'string' &&
            channel.name.endsWith(`/channels/${target.channel}`) &&
            typeof channel.url === 'string'
        ) {
            return channel.url
        }
    }
    throw new Error(`Hosting channel ${target.channel} not found on site ${target.site}`)
}

// A missing or unparseable build file means the channel does not serve this build yet.
const fetchServedBuildId = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(`${url}/${BUILD_ID_PATH}?served=${Date.now()}`)
        return response.ok ? parseBuildId(await response.text(), url) : null
    } catch {
        return null
    }
}

const awaitServedBuild = async (url: string, buildId: string): Promise<boolean> => {
    const deadline = Date.now() + SERVED_BUILD_SETTLE.timeoutMs
    while (Date.now() < deadline) {
        if ((await fetchServedBuildId(url)) === buildId) return true
        await new Promise((resolve) => setTimeout(resolve, SERVED_BUILD_SETTLE.intervalMs))
    }
    return false
}

const promoteFrontendOnHosting = async (
    context: PublishContext,
    target: HostingTarget,
    staged: StagedFrontend
) => {
    await runSpec(
        context,
        firebaseCommand(context.repoRoot, 'hosting-promote', target, [
            'hosting:clone',
            `${target.site}:${STAGING_CHANNEL}`,
            `${target.site}:${target.channel}`
        ])
    )
    const url = await channelUrl(context, target)
    if (!(await awaitServedBuild(url, staged.buildId))) {
        throw new Error(
            `Hosting ${target.channel} (${url}) does not serve frontend ${staged.version} ` +
                `(build ${staged.buildId}); see /tmp/hosting-promote.log`
        )
    }
    context.log(`hosting: ${target.channel} serves frontend ${staged.version} at ${url}`)
}

export type FrontendSelection = {
    deploy: () => Promise<StagedFrontend | null>
    afterServing: (staged: StagedFrontend | null) => Promise<void>
}

// Hosting is staged before the manifest changes and promoted only once the backend serves the
// new version, so the site files and the version the backend reports switch together.
export const frontendSelection = async (
    context: PublishContext,
    version: string,
    publishManifestChange: () => Promise<void>
): Promise<FrontendSelection> => {
    const target = await resolveHostingTarget(context)
    return {
        deploy: async () => {
            const staged = target ? await stageFrontendOnHosting(context, target, version) : null
            await publishManifestChange()
            return staged
        },
        afterServing: async (staged) => {
            if (target && staged) await promoteFrontendOnHosting(context, target, staged)
        }
    }
}

export const syncHostingToManifest = async (context: PublishContext) => {
    const target = await requireHostingTarget(context)
    const manifest = await fetchBucketManifest(context.deployConfig)
    const staged = await stageFrontendOnHosting(context, target, manifest.frontend.version)
    await promoteFrontendOnHosting(context, target, staged)
}

export type HostingCheck =
    | { enabled: false }
    | {
          enabled: true
          channel: string
          url: string
          version: string
          matches: boolean
      }

export const checkHostingMatchesManifest = async (
    context: PublishContext
): Promise<HostingCheck> => {
    const target = await resolveHostingTarget(context)
    if (!target) return { enabled: false }
    const url = await channelUrl(context, target)
    const { version } = (await fetchBucketManifest(context.deployConfig)).frontend
    const expected = parseBuildId(
        await readGcsText(
            `gs://${context.deployConfig.gcsBucket}/frontend/${version}/${BUILD_ID_PATH}`
        ),
        `frontend ${version}`
    )
    const served = await fetchServedBuildId(url)
    return { enabled: true, channel: target.channel, url, version, matches: served === expected }
}
