import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { withCloudSdkPythonEnv } from './cloudSdkPython.js'
import { manifestObjectUrl } from './commands.js'
import { parseManifest, writeManifest } from './manifest.js'
import type {
    DeployConfig,
    FrontendVersionRecord,
    GameCatalogueEntry,
    GameManifestEntry,
    PublicationRecord,
    SiteManifest
} from './types.js'
import { updatePriorVersions } from './versions.js'

const execFileAsync = promisify(execFile)

export const fetchBucketManifest = async (config: DeployConfig): Promise<SiteManifest> => {
    const url = manifestObjectUrl(config)
    try {
        const { stdout } = await execFileAsync('gcloud', ['storage', 'cat', url], {
            env: withCloudSdkPythonEnv(process.env),
            maxBuffer: 16 * 1024 * 1024
        })
        return parseManifest(stdout)
    } catch (error) {
        const stderr =
            typeof error === 'object' && error !== null && 'stderr' in error
                ? String(error.stderr).trim()
                : ''
        throw new Error(`Unable to read ${url}${stderr ? `: ${stderr}` : ''}`)
    }
}

export const writeTemporaryManifest = async (manifest: SiteManifest): Promise<string> => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tabletop-manifest-'))
    const manifestPath = path.join(dir, 'site-manifest.json')
    await writeManifest(manifestPath, manifest)
    return manifestPath
}

const backupTimestamp = (now: Date) => now.toISOString().replace(/[-:.]/g, '').replace('T', '-')

export const manifestBackupUrl = (config: DeployConfig, operation: string, now: Date) => {
    const bucket = config.gcsBucket
    if (!bucket) {
        throw new Error('Missing gcsBucket (set TABLETOP_GCS_BUCKET or deploy config)')
    }
    const safeOperation = operation.replace(/[^A-Za-z0-9._-]+/g, '-')
    return `gs://${bucket}/config/manifest-backups/site-manifest.${backupTimestamp(now)}.${safeOperation}.json`
}

export type GameVersionUpdate = {
    logicVersion?: string
    uiVersion?: string
}

export type ChangeMetadata = {
    deployedAt: string
    commitSha?: string
    tags?: string[]
}

const samePublication = (a: PublicationRecord, b: PublicationRecord) =>
    a.logicVersion === b.logicVersion && a.uiVersion === b.uiVersion

// History lists every Publication that has served, newest first, each pair once. A manifest
// written before history existed seeds it with the Publication current at that time.
const seedGameHistory = (entry: GameManifestEntry): PublicationRecord[] =>
    entry.history ?? [{ logicVersion: entry.logicVersion, uiVersion: entry.uiVersion }]

const withPublicationFirst = (
    history: PublicationRecord[],
    record: PublicationRecord
): PublicationRecord[] => [record, ...history.filter((entry) => !samePublication(entry, record))]

export const withGameVersions = (
    manifest: SiteManifest,
    game: GameCatalogueEntry,
    update: GameVersionUpdate,
    metadata: ChangeMetadata
): SiteManifest => {
    const existing = manifest.games.find((entry) => entry.packageId === game.packageId)
    const current: GameManifestEntry = existing ?? {
        ...game,
        logicVersion: update.logicVersion ?? '',
        uiVersion: update.uiVersion ?? '',
        history: []
    }
    const logicVersion = update.logicVersion ?? current.logicVersion
    const uiVersion = update.uiVersion ?? current.uiVersion
    const record: PublicationRecord = { logicVersion, uiVersion, ...metadata }
    const next: GameManifestEntry = {
        ...current,
        gameId: game.gameId,
        logicVersion,
        uiVersion,
        priorLogicVersions: existing
            ? updatePriorVersions(current.logicVersion, logicVersion, current.priorLogicVersions)
            : [],
        priorUiVersions: existing
            ? updatePriorVersions(current.uiVersion, uiVersion, current.priorUiVersions)
            : [],
        history: withPublicationFirst(seedGameHistory(current), record)
    }
    const games = existing
        ? manifest.games.map((entry) => (entry.packageId === game.packageId ? next : entry))
        : [...manifest.games, next]
    return { ...manifest, games }
}

const seedFrontendHistory = (frontend: SiteManifest['frontend']): FrontendVersionRecord[] =>
    frontend.history ?? [{ version: frontend.version }]

export const withFrontendVersion = (
    manifest: SiteManifest,
    version: string,
    metadata: ChangeMetadata
): SiteManifest => {
    const record: FrontendVersionRecord = {
        version,
        deployedAt: metadata.deployedAt,
        commitSha: metadata.commitSha,
        tag: metadata.tags?.[0]
    }
    return {
        ...manifest,
        frontend: {
            ...manifest.frontend,
            version,
            priorVersions: updatePriorVersions(
                manifest.frontend.version,
                version,
                manifest.frontend.priorVersions
            ),
            history: [
                record,
                ...seedFrontendHistory(manifest.frontend).filter(
                    (entry) => entry.version !== version
                )
            ]
        }
    }
}

export const gameHistory = (entry: GameManifestEntry): PublicationRecord[] => seedGameHistory(entry)

export const frontendHistory = (manifest: SiteManifest): FrontendVersionRecord[] =>
    seedFrontendHistory(manifest.frontend)

// Rollback selects the Publication that served before the current one.
export const previousGamePublication = (entry: GameManifestEntry): PublicationRecord | null => {
    const history = seedGameHistory(entry)
    const currentIndex = history.findIndex(
        (record) =>
            record.logicVersion === entry.logicVersion && record.uiVersion === entry.uiVersion
    )
    return history[currentIndex + 1] ?? null
}

export const previousFrontendVersion = (manifest: SiteManifest): FrontendVersionRecord | null => {
    const history = seedFrontendHistory(manifest.frontend)
    const currentIndex = history.findIndex((record) => record.version === manifest.frontend.version)
    return history[currentIndex + 1] ?? null
}
