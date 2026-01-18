import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { GameDefinition } from '@tabletop/common'
import { SiteManifest } from '@tabletop/games-config'
import { RedisCacheService } from '../cache/cacheService.js'

const DEFAULT_CACHE_KEY = 'site-manifest'
const DEFAULT_GCS_ROOT = process.env['GCS_MOUNT_ROOT'] ?? '/mnt/gcs'
const DEFAULT_MANIFEST_PATH =
    process.env['SITE_MANIFEST_PATH'] ??
    path.join(DEFAULT_GCS_ROOT, 'config', 'site-manifest.json')

type ManifestMismatchChanges = {
    frontend: boolean
    logic: boolean
}

export type ManifestMismatchInfo = {
    previous: SiteManifest
    next: SiteManifest
    changes: ManifestMismatchChanges
}

export type ManifestMismatchListener = (info: ManifestMismatchInfo) => void

export type LibraryServiceOptions = {
    manifestPath?: string
    cacheKey?: string
    cacheSeconds?: number
    allowFallback?: boolean
}

export class LibraryService {
    private readonly manifestPath: string
    private readonly manifestCacheKey: string
    private readonly cacheSeconds?: number
    private readonly allowFallback: boolean

    private manifestSnapshot?: SiteManifest
    private manifestSignature?: string
    private titlesById?: Record<string, GameDefinition>
    private titlesSignature?: string
    private readonly mismatchListeners = new Set<ManifestMismatchListener>()

    constructor(
        private readonly cacheService: RedisCacheService,
        options: LibraryServiceOptions = {}
    ) {
        this.manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH
        this.manifestCacheKey = options.cacheKey ?? DEFAULT_CACHE_KEY
        this.cacheSeconds = options.cacheSeconds
        this.allowFallback = options.allowFallback ?? false
    }

    onManifestMismatch(listener: ManifestMismatchListener): () => void {
        this.mismatchListeners.add(listener)
        return () => {
            this.mismatchListeners.delete(listener)
        }
    }

    async invalidateManifestCache(): Promise<void> {
        await this.cacheService.delete(this.manifestCacheKey)
    }

    async refreshManifest(): Promise<SiteManifest> {
        const manifest = await this.loadManifest()
        const previous = this.manifestSnapshot
        const signature = this.getManifestSignature(manifest)
        const previousSignature = this.manifestSignature
        const changes =
            previous && previousSignature && previousSignature !== signature
                ? this.getManifestChanges(previous, manifest)
                : null

        this.manifestSnapshot = manifest
        this.manifestSignature = signature

        if (previous && changes && (changes.frontend || changes.logic)) {
            for (const listener of this.mismatchListeners) {
                listener({ previous, next: manifest, changes })
            }
        }

        return manifest
    }

    async getManifest(options: { force?: boolean } = {}): Promise<SiteManifest> {
        if (!options.force && this.manifestSnapshot) {
            return this.manifestSnapshot
        }

        return this.refreshManifest()
    }

    async getTitles(): Promise<GameDefinition[]> {
        const titles = await this.getTitlesMap()
        return Object.values(titles)
    }

    async getTitlesMap(): Promise<Record<string, GameDefinition>> {
        const manifest = await this.getManifest()
        const signature = this.getTitlesSignature(manifest)

        if (this.titlesById && this.titlesSignature === signature) {
            return this.titlesById
        }

        const definitions = await this.loadDefinitions(manifest)
        const byId = Object.fromEntries(
            definitions.map((definition) => [definition.info.id, definition])
        )

        this.titlesById = byId
        this.titlesSignature = signature

        return byId
    }

    async getTitle(gameId: string): Promise<GameDefinition | undefined> {
        const titles = await this.getTitlesMap()
        return titles[gameId]
    }

    private async loadDefinitions(manifest: SiteManifest): Promise<GameDefinition[]> {
        const gameIds = Object.keys(manifest.games ?? {})

        const definitions = await Promise.all(
            gameIds.map(async (gameId) => {
                const moduleName = `@tabletop/${gameId}`
                const gameModule = await import(moduleName)
                const definition = gameModule['Definition' as keyof typeof gameModule] as
                    | GameDefinition
                    | undefined

                if (!definition) {
                    throw new Error(`Game module "${moduleName}" does not export Definition`)
                }

                if (definition.info.id !== gameId) {
                    console.warn(
                        `Game definition id mismatch for ${moduleName}:`,
                        definition.info.id,
                        '!==',
                        gameId
                    )
                }

                return definition
            })
        )

        return definitions
    }

    private async loadManifest(): Promise<SiteManifest> {
        const cached = await this.cacheService.get<SiteManifest>(this.manifestCacheKey)

        if (cached.cached && cached.value) {
            return cached.value
        }

        let manifest: SiteManifest | undefined

        try {
            const rawManifest = await readFile(this.manifestPath, 'utf8')
            manifest = JSON.parse(rawManifest) as SiteManifest
        } catch (error) {
            console.warn('Unable to load manifest from disk', error)
        }

        if (!manifest && this.allowFallback) {
            manifest = SiteManifest
        }

        if (!manifest) {
            if (this.manifestSnapshot) {
                return this.manifestSnapshot
            }

            throw new Error('Manifest unavailable')
        }

        await this.cacheService.set(this.manifestCacheKey, manifest, this.cacheSeconds)

        return manifest
    }

    private getManifestSignature(manifest: SiteManifest): string {
        return JSON.stringify({
            frontendVersion: manifest.frontend?.version ?? null,
            logic: this.getLogicVersionEntries(manifest)
        })
    }

    private getTitlesSignature(manifest: SiteManifest): string {
        return JSON.stringify(this.getLogicVersionEntries(manifest))
    }

    private getManifestChanges(
        previous: SiteManifest,
        next: SiteManifest
    ): ManifestMismatchChanges {
        const frontend = (previous.frontend?.version ?? null) !== (next.frontend?.version ?? null)
        const logic = !this.areLogicVersionsEqual(previous, next)

        return { frontend, logic }
    }

    private areLogicVersionsEqual(previous: SiteManifest, next: SiteManifest): boolean {
        const previousEntries = this.getLogicVersionEntries(previous)
        const nextEntries = this.getLogicVersionEntries(next)

        if (previousEntries.length !== nextEntries.length) {
            return false
        }

        for (let index = 0; index < previousEntries.length; index += 1) {
            const [prevId, prevVersion] = previousEntries[index]
            const [nextId, nextVersion] = nextEntries[index]
            if (prevId !== nextId || prevVersion !== nextVersion) {
                return false
            }
        }

        return true
    }

    private getLogicVersionEntries(manifest: SiteManifest): Array<[string, string | null]> {
        return Object.entries(manifest.games ?? {})
            .map(([id, entry]) => [id, entry.logicVersion ?? null] as [string, string | null])
            .sort(([left], [right]) => left.localeCompare(right))
    }
}
