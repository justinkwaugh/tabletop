import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { withCloudSdkPythonEnv } from './cloudSdkPython.js'
import { manifestObjectUrl } from './commands.js'
import { parseManifest, writeManifest } from './manifest.js'
import type { DeployConfig, GameCatalogueEntry, SiteManifest } from './types.js'
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

export const withGameVersions = (
    manifest: SiteManifest,
    game: GameCatalogueEntry,
    update: GameVersionUpdate
): SiteManifest => {
    const existing = manifest.games.find((entry) => entry.packageId === game.packageId)
    const current = existing ?? {
        ...game,
        logicVersion: update.logicVersion ?? '',
        uiVersion: update.uiVersion ?? ''
    }
    const logicVersion = update.logicVersion ?? current.logicVersion
    const uiVersion = update.uiVersion ?? current.uiVersion
    const next = {
        ...current,
        gameId: game.gameId,
        logicVersion,
        uiVersion,
        priorLogicVersions: existing
            ? updatePriorVersions(current.logicVersion, logicVersion, current.priorLogicVersions)
            : [],
        priorUiVersions: existing
            ? updatePriorVersions(current.uiVersion, uiVersion, current.priorUiVersions)
            : []
    }
    const games = existing
        ? manifest.games.map((entry) => (entry.packageId === game.packageId ? next : entry))
        : [...manifest.games, next]
    return { ...manifest, games }
}

export const withFrontendVersion = (manifest: SiteManifest, version: string): SiteManifest => ({
    ...manifest,
    frontend: {
        ...manifest.frontend,
        version,
        priorVersions: updatePriorVersions(
            manifest.frontend.version,
            version,
            manifest.frontend.priorVersions
        )
    }
})
