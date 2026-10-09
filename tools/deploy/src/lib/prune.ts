import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { withCloudSdkPythonEnv } from './cloudSdkPython.js'
import { runCommand } from './commands.js'
import { findGameEntry } from './gamePublish.js'
import { type PublishContext } from './publishCore.js'
import { fetchBucketManifest, frontendHistory, gameHistory } from './remoteManifest.js'
import type { SiteManifest } from './types.js'

export type PruneScope = { game: string } | { frontend: true } | { all: true }

export type PruneOptions = { apply: boolean; graceDays: number }

export const DEFAULT_GRACE_DAYS = 7

// One artifact kind's version directories, e.g. games/<packageId>/ui, with the versions the
// manifest still references: the current selection and every Publication rollback can reach.
export type PruneTarget = {
    label: string
    prefix: string
    current: string
    history: string[]
}

export type StoredObject = { name: string; size: number; createdAt: string }

export type VersionPlan = {
    version: string
    bytes: number
    uploadedAt: string
    keep?: 'current' | 'history' | 'recent'
}

export type TargetPlan = { target: PruneTarget; versions: VersionPlan[] }

const VERSION_DIRECTORY = /^\d+\.\d+\.\d+([-+][0-9A-Za-z.+-]*)?$/

export const pruneTargets = (manifest: SiteManifest, packageIds?: string[]): PruneTarget[] => {
    const games = packageIds
        ? manifest.games.filter((entry) => packageIds.includes(entry.packageId))
        : manifest.games
    return games.flatMap((entry) => {
        const history = gameHistory(entry)
        return [
            {
                label: `${entry.gameId} logic`,
                prefix: `games/${entry.packageId}/logic`,
                current: entry.logicVersion,
                history: history.map((record) => record.logicVersion)
            },
            {
                label: `${entry.gameId} ui`,
                prefix: `games/${entry.packageId}/ui`,
                current: entry.uiVersion,
                history: history.map((record) => record.uiVersion)
            }
        ]
    })
}

export const frontendPruneTarget = (manifest: SiteManifest): PruneTarget => ({
    label: 'frontend',
    prefix: 'frontend',
    current: manifest.frontend.version,
    history: frontendHistory(manifest).map((record) => record.version)
})

// Version directories are grouped from the object listing, so a directory's size and newest
// upload cover its files and its directory placeholders. Names that are not versions are left
// alone. A version uploaded within the grace period is kept even when nothing references it,
// because a browser that loaded it before a newer deploy can still request its lazy chunks.
export const planTarget = (
    target: PruneTarget,
    objects: StoredObject[],
    now: Date,
    graceDays: number
): TargetPlan => {
    const graceStart = now.getTime() - graceDays * 24 * 60 * 60 * 1000
    const versions = new Map<string, VersionPlan>()
    for (const object of objects) {
        if (!object.name.startsWith(`${target.prefix}/`)) continue
        const relative = object.name.slice(target.prefix.length + 1)
        const slash = relative.indexOf('/')
        if (slash < 0) continue
        const version = relative.slice(0, slash)
        if (!VERSION_DIRECTORY.test(version)) continue
        const plan = versions.get(version) ?? { version, bytes: 0, uploadedAt: object.createdAt }
        plan.bytes += object.size
        if (Date.parse(object.createdAt) > Date.parse(plan.uploadedAt)) {
            plan.uploadedAt = object.createdAt
        }
        versions.set(version, plan)
    }
    if (!versions.has(target.current)) {
        throw new Error(
            `${target.label}: current version ${target.current} is not under ${target.prefix}/; refusing to prune`
        )
    }
    for (const plan of versions.values()) {
        if (plan.version === target.current) plan.keep = 'current'
        else if (target.history.includes(plan.version)) plan.keep = 'history'
        else if (Date.parse(plan.uploadedAt) > graceStart) plan.keep = 'recent'
    }
    return { target, versions: [...versions.values()].sort(compareVersions) }
}

const compareVersions = (a: VersionPlan, b: VersionPlan) =>
    a.version.localeCompare(b.version, 'en', { numeric: true })

const execFileAsync = promisify(execFile)

const listObjects = async (bucket: string, prefix: string): Promise<StoredObject[]> => {
    const { stdout } = await execFileAsync(
        'gcloud',
        [
            'storage',
            'objects',
            'list',
            `gs://${bucket}/${prefix}/**`,
            '--format=json(name,size,creation_time)'
        ],
        { env: withCloudSdkPythonEnv(process.env), maxBuffer: 256 * 1024 * 1024 }
    )
    const listed = JSON.parse(stdout) as { name: string; size: number; creation_time: string }[]
    return listed.map((object) => ({
        name: object.name,
        size: Number(object.size),
        createdAt: object.creation_time
    }))
}

const DELETE_BATCH = 50

const deleteVersions = async (
    context: PublishContext,
    bucket: string,
    plan: TargetPlan,
    versions: VersionPlan[]
) => {
    const logLabel = plan.target.label.replace(/[^A-Za-z0-9._-]+/g, '-')
    for (let start = 0; start < versions.length; start += DELETE_BATCH) {
        const batch = versions.slice(start, start + DELETE_BATCH)
        const spec = {
            label: `prune:${plan.target.label}`,
            command: 'gcloud',
            // The trailing slash limits each deletion to that version's directory.
            args: [
                'storage',
                'rm',
                '-r',
                ...batch.map(
                    (version) => `gs://${bucket}/${plan.target.prefix}/${version.version}/`
                )
            ],
            cwd: context.repoRoot,
            logPath: `/tmp/prune-${logLabel}.log`
        }
        await runCommand(spec)
    }
}

const formatBytes = (bytes: number) =>
    bytes >= 1024 ** 3
        ? `${(bytes / 1024 ** 3).toFixed(2)} GiB`
        : `${(bytes / 1024 ** 2).toFixed(1)} MiB`

const describePlan = (plan: TargetPlan, apply: boolean): string[] => {
    const kept = plan.versions.filter((version) => version.keep)
    const removed = plan.versions.filter((version) => !version.keep)
    const removedBytes = removed.reduce((total, version) => total + version.bytes, 0)
    const lines = [
        `${plan.target.label}: keeping ${kept
            .map((version) => `${version.version} (${version.keep})`)
            .join(', ')}`
    ]
    if (removed.length > 0) {
        lines.push(
            `${plan.target.label}: ${apply ? 'deleting' : 'would delete'} ${removed.length} ` +
                `version(s), ${formatBytes(removedBytes)}: ${removed
                    .map((version) => version.version)
                    .join(', ')}`
        )
    }
    return lines
}

const resolveTargets = (context: PublishContext, manifest: SiteManifest, scope: PruneScope) => {
    if ('frontend' in scope) return [frontendPruneTarget(manifest)]
    if ('all' in scope) return [...pruneTargets(manifest), frontendPruneTarget(manifest)]
    const game = findGameEntry(context.catalogue, scope.game)
    const targets = pruneTargets(manifest, [game.packageId])
    if (targets.length === 0) {
        throw new Error(`${game.gameId} has never been published; there is nothing to prune`)
    }
    return targets
}

// Deletes artifact versions the manifest no longer references. The manifest is read fresh, so
// the deletions are planned against what production selects at the time of the run.
export const prune = async (context: PublishContext, scope: PruneScope, options: PruneOptions) => {
    const bucket = context.deployConfig.gcsBucket
    if (!bucket) throw new Error('Missing gcsBucket (set TABLETOP_GCS_BUCKET or deploy config)')
    const manifest = await fetchBucketManifest(context.deployConfig)
    const now = new Date()
    let removedVersions = 0
    let removedBytes = 0
    for (const target of resolveTargets(context, manifest, scope)) {
        const plan = planTarget(
            target,
            await listObjects(bucket, target.prefix),
            now,
            options.graceDays
        )
        for (const line of describePlan(plan, options.apply)) context.log(line)
        const removed = plan.versions.filter((version) => !version.keep)
        if (options.apply && removed.length > 0) {
            await deleteVersions(context, bucket, plan, removed)
        }
        removedVersions += removed.length
        removedBytes += removed.reduce((total, version) => total + version.bytes, 0)
    }
    context.log(
        options.apply
            ? `prune SUCCEEDED: deleted ${removedVersions} version(s), ${formatBytes(removedBytes)}`
            : `prune dry run: would delete ${removedVersions} version(s), ${formatBytes(removedBytes)}; pass --apply to delete`
    )
}

// A successful deploy prunes what it published. Its outcome is already settled when this runs,
// so a prune failure is reported without failing the deploy.
export const pruneAfterDeploy = async (context: PublishContext, scope: PruneScope) => {
    try {
        await prune(context, scope, { apply: true, graceDays: DEFAULT_GRACE_DAYS })
    } catch (error) {
        context.log(
            `prune FAILED (the deploy itself succeeded): ${error instanceof Error ? error.message : error}`
        )
    }
}
