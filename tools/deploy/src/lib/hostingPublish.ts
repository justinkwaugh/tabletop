import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
    downloadFrontendCommand,
    firebaseCommand,
    frontendArtifactUrl,
    runCommand,
    type FirebaseTarget
} from './commands.js'
import { readGcsText } from './gcs.js'
import { isObject } from './json.js'
import { pollUntil, runSpec, type PublishContext, type ServingSettle } from './publishCore.js'
import { fetchBucketManifest } from './remoteManifest.js'

const FRONTEND_HOSTING_CONFIG = path.join('apps', 'frontend', 'firebase.json')
const BUILD_ID_PATH = '_app/version.json'
const SERVED_BUILD_SETTLE: ServingSettle = { timeoutMs: 2 * 60_000, intervalMs: 5_000 }
const BUILD_ID_FETCH_TIMEOUT_MS = 15_000

export type HostingTarget = FirebaseTarget & {
    site: string
    channel: string
    hostingConfig: Record<string, unknown>
}

type StagedFrontend = {
    version: string
    channel: string
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

const stagingChannel = (version: string) =>
    `frontend-${version.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

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
        const buildId = parseBuildId(
            await fs.readFile(path.join(siteDir, BUILD_ID_PATH), 'utf8'),
            `frontend ${version}`
        )
        const configPath = path.join(stagingDir, 'firebase.json')
        await fs.writeFile(
            configPath,
            JSON.stringify({ hosting: { ...target.hostingConfig, public: 'site' } }, null, 4)
        )
        const channel = stagingChannel(version)
        await runSpec(
            context,
            firebaseCommand(
                context.repoRoot,
                'hosting-stage',
                { project: target.project, configPath },
                ['hosting:channel:deploy', channel, '--expires', '1d', '--no-authorized-domains']
            )
        )
        context.log(`hosting: staged frontend ${version} on channel ${channel}`)
        return { version, channel, buildId }
    } finally {
        await fs.rm(stagingDir, { recursive: true, force: true })
    }
}

const channelUrl = async (context: PublishContext, target: HostingTarget): Promise<string> => {
    if (target.channel === 'live') return `https://${target.site}.web.app`
    let stdout = ''
    await runCommand(
        firebaseCommand(context.repoRoot, 'hosting-channels', target, [
            'hosting:channel:list',
            '--site',
            target.site,
            '--json'
        ]),
        { onStdout: (chunk) => (stdout += chunk) }
    )
    const listed: unknown = JSON.parse(stdout)
    if (!isObject(listed) || !isObject(listed.result) || !Array.isArray(listed.result.channels)) {
        throw new Error('Unexpected hosting:channel:list output; see /tmp/hosting-channels.log')
    }
    for (const channel of listed.result.channels) {
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

const fetchServedBuildId = async (url: string): Promise<string | null> => {
    const response = await fetch(`${url}/${BUILD_ID_PATH}?served=${Date.now()}`, {
        signal: AbortSignal.timeout(BUILD_ID_FETCH_TIMEOUT_MS)
    })
    if (!response.ok) return null
    const body = await response.text()
    // Hosting answers a path it has no file for with index.html, so a body that is not the
    // build file means the channel serves some other release.
    try {
        return parseBuildId(body, url)
    } catch {
        return null
    }
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
            `${target.site}:${staged.channel}`,
            `${target.site}:${target.channel}`
        ])
    )
    const url = await channelUrl(context, target)
    const served = await pollUntil(
        () => fetchServedBuildId(url),
        (buildId) => buildId === staged.buildId,
        SERVED_BUILD_SETTLE
    )
    if (served !== staged.buildId) {
        throw new Error(
            `Hosting ${target.channel} (${url}) does not serve frontend ${staged.version} ` +
                `(build ${staged.buildId}); see /tmp/hosting-promote.log`
        )
    }
    context.log(`hosting: ${target.channel} serves frontend ${staged.version} at ${url}`)
}

// The backend reports the manifest's frontend version as soon as the manifest changes, and a
// client whose code is newer than that version reloads, so Hosting switches first and the
// manifest follows within seconds.
export const publishFrontendVersion = async (
    context: PublishContext,
    version: string,
    publishManifestChange: () => Promise<void>
) => {
    const target = await resolveHostingTarget(context)
    if (target) {
        const staged = await stageFrontendOnHosting(context, target, version)
        await promoteFrontendOnHosting(context, target, staged)
    }
    try {
        await publishManifestChange()
    } catch (error) {
        if (target) {
            context.log(
                `hosting: ${target.channel} already serves frontend ${version} but the manifest ` +
                    'was not published; rerun to publish it, or run sync-hosting to put Hosting ' +
                    "back on the manifest's version"
            )
        }
        throw error
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
    | { enabled: true; channel: string; error: string }
    | { enabled: true; channel: string; url: string; version: string; matches: boolean }

const compareHostingWithManifest = async (
    context: PublishContext,
    target: HostingTarget
): Promise<HostingCheck> => {
    const url = await channelUrl(context, target)
    const { version } = (await fetchBucketManifest(context.deployConfig)).frontend
    const expected = parseBuildId(
        await readGcsText(`${frontendArtifactUrl(context.deployConfig, version)}/${BUILD_ID_PATH}`),
        `frontend ${version}`
    )
    const served = await fetchServedBuildId(url)
    return { enabled: true, channel: target.channel, url, version, matches: served === expected }
}

export const checkHostingMatchesManifest = async (
    context: PublishContext
): Promise<HostingCheck> => {
    const target = await resolveHostingTarget(context)
    if (!target) return { enabled: false }
    try {
        return await compareHostingWithManifest(context, target)
    } catch (error) {
        return {
            enabled: true,
            channel: target.channel,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}
