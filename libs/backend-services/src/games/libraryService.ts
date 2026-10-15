import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { access, readFile } from 'node:fs/promises'
import { GameDefinition } from '@tabletop/common'
import type { SiteManifest } from '@tabletop/games-config'
import { RedisCacheService } from '../cache/cacheService.js'
import { EnvService } from '../env/envService.js'
import { STATIC_ROOT } from '../env/staticRoot.js'
import { servedManifest } from './servedManifest.js'

const DEFAULT_CACHE_KEY = 'site-manifest'

const DEFAULT_GAMES_ROOT = path.join(STATIC_ROOT, 'games')
export const LOCAL_WORKSPACE_ROOT = path.join(process.cwd(), '../..')
const LOCAL_WORKSPACE_GAMES_ROOT = path.join(LOCAL_WORKSPACE_ROOT, 'games')
const GAMES_ROOT =
    process.env['GAME_LOGIC_ROOT'] ??
    (EnvService.isLocal() ? LOCAL_WORKSPACE_GAMES_ROOT : DEFAULT_GAMES_ROOT)

const MANIFEST_PATH =
    process.env['SITE_MANIFEST_PATH'] ?? path.join(STATIC_ROOT, 'config', 'site-manifest.json')

export type ManifestMismatchInfo = {
    previous: SiteManifest
    next: SiteManifest
}

export type ManifestMismatchListener = (info: ManifestMismatchInfo) => void

export type LibraryServiceOptions = {
    manifestPath?: string
    cacheKey?: string
    cacheSeconds?: number
    useCache?: boolean
    fallbackManifest?: () => Promise<SiteManifest>
    logicRoot?: string
}

export class LibraryService {
    private readonly manifestPath: string
    private readonly manifestCacheKey: string
    private readonly useCache: boolean
    private readonly fallbackManifest?: () => Promise<SiteManifest>
    private readonly logicRoot: string

    private manifestSnapshot?: SiteManifest
    private manifestSignature?: string
    private manifestRefreshQueue: Promise<void> = Promise.resolve()
    private titlesById?: Record<string, GameDefinition>
    private loadedManifest?: SiteManifest
    private readonly mismatchListeners = new Set<ManifestMismatchListener>()

    constructor(
        private readonly cacheService: RedisCacheService,
        options: LibraryServiceOptions = {}
    ) {
        this.manifestPath = options.manifestPath ?? MANIFEST_PATH
        this.manifestCacheKey = options.cacheKey ?? DEFAULT_CACHE_KEY
        this.useCache = options.useCache ?? true
        this.fallbackManifest = options.fallbackManifest
        this.logicRoot = options.logicRoot ?? GAMES_ROOT
    }

    onManifestMismatch(listener: ManifestMismatchListener): () => void {
        this.mismatchListeners.add(listener)
        return () => {
            this.mismatchListeners.delete(listener)
        }
    }

    async invalidateManifestCache(): Promise<void> {
        if (!this.useCache) {
            return
        }
        await this.cacheService.delete(this.manifestCacheKey)
    }

    refreshManifest(): Promise<SiteManifest> {
        const refresh = this.manifestRefreshQueue.then(() => this.refreshManifestSnapshot())
        this.manifestRefreshQueue = refresh.then(
            () => {},
            () => {}
        )
        return refresh
    }

    private async refreshManifestSnapshot(): Promise<SiteManifest> {
        const manifest = await this.loadManifest()
        const previous = this.manifestSnapshot
        const signature = this.getLogicSignature(manifest)
        const logicChanged =
            this.manifestSignature !== undefined && this.manifestSignature !== signature

        this.manifestSnapshot = manifest
        this.manifestSignature = signature

        if (previous && logicChanged) {
            for (const listener of this.mismatchListeners) {
                listener({ previous, next: manifest })
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

    async getServedManifest(): Promise<SiteManifest> {
        if (!this.loadedManifest) {
            throw new Error('Game titles have not been loaded; there is no served manifest')
        }
        return servedManifest(await this.getManifest(), this.loadedManifest)
    }

    async getTitles(): Promise<GameDefinition[]> {
        const titles = await this.getTitlesMap()
        return Object.values(titles)
    }

    // Logic cannot be unloaded from a process, so titles load once; a logic change is served by a
    // replacement process instead.
    async getTitlesMap(): Promise<Record<string, GameDefinition>> {
        if (this.titlesById) return this.titlesById

        const manifest = await this.getManifest()
        const definitions = await this.loadDefinitions(manifest)
        this.titlesById = Object.fromEntries(
            definitions.map((definition) => [definition.info.id, definition])
        )
        this.loadedManifest = manifest
        return this.titlesById
    }

    async getTitle(gameId: string): Promise<GameDefinition | undefined> {
        const titles = await this.getTitlesMap()
        return titles[gameId]
    }

    private async loadDefinitions(manifest: SiteManifest): Promise<GameDefinition[]> {
        const entries = manifest.games ?? []

        const definitions = await Promise.all(
            entries.map(async (entry) => {
                const packageId = entry.packageId
                const logicVersion = entry.logicVersion
                if (!packageId) {
                    throw new Error('Manifest entry missing packageId')
                }
                if (!logicVersion) {
                    throw new Error(`Manifest missing logicVersion for "${packageId}"`)
                }

                const logicPath = path.join(
                    this.logicRoot,
                    packageId,
                    'logic',
                    logicVersion,
                    'index.js'
                )
                const esmPath = path.join(this.logicRoot, packageId, 'esm', 'index.js')
                const moduleName = `@tabletop/${packageId}`
                let gameModule: unknown

                try {
                    if (EnvService.isLocal()) {
                        if (await this.pathExists(esmPath)) {
                            gameModule = await import(pathToFileURL(esmPath).href)
                        } else {
                            gameModule = await import(pathToFileURL(logicPath).href)
                        }
                    } else {
                        gameModule = await import(pathToFileURL(logicPath).href)
                    }
                } catch (error) {
                    if (!this.fallbackManifest) {
                        throw error
                    }

                    console.warn(
                        `Unable to import game logic bundle for ${packageId} (${logicVersion}); falling back to ${moduleName}`,
                        error
                    )
                    gameModule = await import(moduleName)
                }

                const expectedGameId = entry.gameId ?? packageId
                const definition = (gameModule as Record<string, unknown>)['Definition'] as
                    | GameDefinition
                    | undefined

                if (!definition) {
                    throw new Error(`Game module "${moduleName}" does not export Definition`)
                }

                if (definition.info.id !== expectedGameId) {
                    console.warn(
                        `Game definition id mismatch for ${moduleName}:`,
                        definition.info.id,
                        '!==',
                        expectedGameId
                    )
                }

                if (definition.info.metadata.version !== logicVersion) {
                    console.warn(
                        `Game definition version mismatch for ${packageId}:`,
                        definition.info.metadata.version,
                        '!==',
                        logicVersion
                    )
                }

                return definition
            })
        )

        return definitions
    }

    private async pathExists(filePath: string): Promise<boolean> {
        try {
            await access(filePath)
            return true
        } catch {
            return false
        }
    }

    private async loadManifest(): Promise<SiteManifest> {
        const unavailable = new Error('Manifest unavailable')
        const readManifest = async (): Promise<SiteManifest> => {
            try {
                const manifest: SiteManifest = JSON.parse(await readFile(this.manifestPath, 'utf8'))
                if (manifest) return manifest
            } catch (error) {
                console.warn('Unable to load manifest from disk', error)
            }
            throw unavailable
        }

        try {
            const manifest = this.useCache
                ? await this.cacheService.cachingGet<SiteManifest>(
                      this.manifestCacheKey,
                      readManifest
                  )
                : await readManifest()
            if (manifest) return manifest
        } catch (error) {
            if (error !== unavailable) throw error
        }

        if (this.fallbackManifest) {
            return this.fallbackManifest()
        }
        if (this.manifestSnapshot) {
            return this.manifestSnapshot
        }
        throw unavailable
    }

    // Logic cannot be unloaded from a process, so a logic change needs a replacement process; the
    // site files are served by Firebase Hosting and change without one.
    private getLogicSignature(manifest: SiteManifest): string {
        return JSON.stringify(this.getLogicVersionEntries(manifest))
    }

    private getLogicVersionEntries(
        manifest: SiteManifest
    ): Array<[string, string | null, string | null]> {
        return (manifest.games ?? [])
            .map(
                (entry) =>
                    [entry.packageId, entry.logicVersion ?? null, entry.gameId ?? null] as [
                        string,
                        string | null,
                        string | null
                    ]
            )
            .sort(([left], [right]) => left.localeCompare(right))
    }
}
