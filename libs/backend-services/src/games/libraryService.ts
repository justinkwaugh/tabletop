import path from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'
import { access, readFile, stat } from 'node:fs/promises'
import { GameDefinition } from '@tabletop/common'
import type { SiteManifest, SiteManifestGame } from '@tabletop/games-config'
import { RedisCacheService } from '../cache/cacheService.js'
import { EnvService } from '../env/envService.js'
import { STATIC_ROOT } from '../env/staticRoot.js'
import { evaluateLogicDefinition, importLogicModule } from './logicFactory.js'

const DEFAULT_CACHE_KEY = 'site-manifest'

const DEFAULT_GAMES_ROOT = path.join(STATIC_ROOT, 'games')
export const LOCAL_WORKSPACE_ROOT = path.join(process.cwd(), '../..')
const LOCAL_WORKSPACE_GAMES_ROOT = path.join(LOCAL_WORKSPACE_ROOT, 'games')
const GAMES_ROOT =
    process.env['GAME_LOGIC_ROOT'] ??
    (EnvService.isLocal() ? LOCAL_WORKSPACE_GAMES_ROOT : DEFAULT_GAMES_ROOT)

const MANIFEST_PATH =
    process.env['SITE_MANIFEST_PATH'] ?? path.join(STATIC_ROOT, 'config', 'site-manifest.json')

// A publication whose activation failed is not retried on every request: the next attempt
// waits this long, and callers that explicitly await activation see the failure meanwhile.
const ACTIVATION_RETRY_MS = 30_000

// One loaded title: its executable Definition and the publication it came from. A generation is
// retired when a later activation replaces it; requests that pinned it keep it until they finish.
export type TitleGeneration = {
    definition: GameDefinition
    publication: SiteManifestGame
}

// The generations a request has resolved so far. Once released, lookups fall through to the
// current generation so lingering asynchronous work never retains retired code.
export type TitleScope = {
    generations: Map<string, TitleGeneration>
    released: boolean
}

type TitleLoadTimings = {
    locateMs?: number
    readMs?: number
    bytes?: number
    evaluateMs?: number
    importMs?: number
}

// Wraps the load of one title's logic, which blocks the event loop while the artifact evaluates.
export type WhileLoadingTitle = <T>(load: () => Promise<T>) => Promise<T>

export type LibraryServiceOptions = {
    manifestPath?: string
    cacheKey?: string
    useCache?: boolean
    fallbackManifest?: () => Promise<SiteManifest>
    logicRoot?: string
    // Runs for every generation before it is installed; a failure keeps the previous titles.
    prepare?: (generation: TitleGeneration) => Promise<void>
    whileLoadingTitle?: WhileLoadingTitle
}

export class LibraryService {
    private readonly cacheService: RedisCacheService
    private readonly manifestPath: string
    private readonly manifestCacheKey: string
    private readonly useCache: boolean
    private readonly fallbackManifest?: () => Promise<SiteManifest>
    private readonly logicRoot: string
    private readonly prepare?: (generation: TitleGeneration) => Promise<void>
    private readonly whileLoadingTitle: WhileLoadingTitle
    private manifestSnapshot?: SiteManifest
    private manifestRefreshQueue: Promise<void> = Promise.resolve()
    private activationQueue: Promise<void> = Promise.resolve()
    private pendingActivation?: Promise<void>
    private activationFailure?: { signature: string; at: number; error: unknown }
    private readonly scopes = new AsyncLocalStorage<TitleScope>()
    private generations = new Map<string, TitleGeneration>()
    private loadedManifest?: SiteManifest

    constructor(cacheService: RedisCacheService, options: LibraryServiceOptions = {}) {
        this.cacheService = cacheService
        this.manifestPath = options.manifestPath ?? MANIFEST_PATH
        this.manifestCacheKey = options.cacheKey ?? DEFAULT_CACHE_KEY
        this.useCache = options.useCache ?? true
        this.fallbackManifest = options.fallbackManifest
        this.logicRoot = options.logicRoot ?? GAMES_ROOT
        this.prepare = options.prepare
        this.whileLoadingTitle = options.whileLoadingTitle ?? ((load) => load())
    }

    async invalidateManifestCache(): Promise<void> {
        if (!this.useCache) {
            return
        }
        await this.cacheService.delete(this.manifestCacheKey)
    }

    // Reads the current manifest. When it selects publications the loaded titles do not match,
    // their activation is queued and the current generations keep serving until it completes;
    // callers that need the new titles await activation().
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
        this.manifestSnapshot = manifest
        if (this.loadedManifest && !this.publicationsMatch(this.loadedManifest, manifest)) {
            void this.scheduleActivation()
        }
        return manifest
    }

    // Resolves once no activation is pending; rejects with the failure of the last attempt.
    activation(): Promise<void> {
        return this.pendingActivation ?? Promise.resolve()
    }

    async refreshAndActivate(): Promise<SiteManifest> {
        const manifest = await this.refreshManifest()
        await this.activation()
        return manifest
    }

    private scheduleActivation(): Promise<void> {
        const run = this.activationQueue.then(() => this.activateSnapshot())
        this.activationQueue = run.then(
            () => {},
            () => {}
        )
        this.pendingActivation = run
        void run.then(
            () => {
                if (this.pendingActivation === run) this.pendingActivation = undefined
            },
            () => {
                if (this.pendingActivation === run) this.pendingActivation = undefined
            }
        )
        return run
    }

    // Activates the latest snapshot, so a burst of refreshes activates once.
    private async activateSnapshot(): Promise<void> {
        const manifest = this.manifestSnapshot
        if (!manifest) return
        if (this.loadedManifest && this.publicationsMatch(this.loadedManifest, manifest)) return
        const signature = this.publicationSignature(manifest)
        const failure = this.activationFailure
        if (
            failure &&
            failure.signature === signature &&
            Date.now() - failure.at < ACTIVATION_RETRY_MS
        ) {
            throw failure.error
        }
        try {
            await this.activateManifest(manifest)
            this.activationFailure = undefined
        } catch (error) {
            this.activationFailure = { signature, at: Date.now(), error }
            console.error('Title activation failed; the loaded titles keep serving', error)
            throw error
        }
    }

    async getManifest(options: { force?: boolean } = {}): Promise<SiteManifest> {
        if (!options.force && this.manifestSnapshot) {
            return this.manifestSnapshot
        }
        return this.refreshManifest()
    }

    // The manifest whose titles this instance runs; it trails the bucket manifest only while an
    // activation is in progress.
    async getServedManifest(): Promise<SiteManifest> {
        if (!this.loadedManifest) {
            throw new Error('Game titles have not been loaded; there is no served manifest')
        }
        return this.loadedManifest
    }

    createScope(): TitleScope {
        return { generations: new Map(), released: false }
    }

    runInScope<T>(scope: TitleScope, run: () => T): T {
        return this.scopes.run(scope, run)
    }

    releaseScope(scope: TitleScope): void {
        scope.released = true
        scope.generations.clear()
    }

    // The generation the current request uses for a title, pinned on first use so one request
    // validates, executes and projects with a single Definition even across an activation.
    getGeneration(titleId: string): TitleGeneration | undefined {
        const scope = this.scopes.getStore()
        const pinned = scope?.generations.get(titleId)
        if (pinned) return pinned
        const generation = this.generations.get(titleId)
        if (generation && scope && !scope.released) scope.generations.set(titleId, generation)
        return generation
    }

    currentTitles(): Record<string, GameDefinition> {
        const titles: Record<string, GameDefinition> = {}
        for (const id of this.generations.keys()) {
            const generation = this.getGeneration(id)
            if (generation) titles[id] = generation.definition
        }
        return titles
    }

    async getTitles(): Promise<GameDefinition[]> {
        return Object.values(await this.getTitlesMap())
    }

    async getTitlesMap(): Promise<Record<string, GameDefinition>> {
        if (!this.loadedManifest) {
            const initialize = this.manifestRefreshQueue.then(async () => {
                if (this.loadedManifest) return
                const manifest = this.manifestSnapshot ?? (await this.loadManifest())
                this.manifestSnapshot = manifest
                await this.activateManifest(manifest)
            })
            this.manifestRefreshQueue = initialize.then(
                () => {},
                () => {}
            )
            await initialize
        }
        return this.currentTitles()
    }

    async getTitle(titleId: string): Promise<GameDefinition | undefined> {
        if (!this.loadedManifest) await this.getTitlesMap()
        return this.getGeneration(titleId)?.definition
    }

    // Loads only the titles whose logic selection changed; the others keep their Definition and
    // take the new publication record. Nothing is installed until every changed title loaded.
    private async activateManifest(manifest: SiteManifest): Promise<void> {
        const next = new Map<string, TitleGeneration>()
        for (const entry of manifest.games) {
            if (next.has(entry.gameId)) throw new Error(`Duplicate title: ${entry.gameId}`)
            const current = this.generations.get(entry.gameId)
            if (
                current &&
                current.publication.packageId === entry.packageId &&
                current.publication.logicVersion === entry.logicVersion
            ) {
                next.set(entry.gameId, { ...current, publication: entry })
                continue
            }
            const generation = await this.whileLoadingTitle(() => this.loadGeneration(entry))
            await this.prepare?.(generation)
            next.set(entry.gameId, generation)
        }
        this.generations = next
        this.loadedManifest = manifest
    }

    private async loadGeneration(entry: SiteManifestGame): Promise<TitleGeneration> {
        const timings: TitleLoadTimings = {}
        const startedAt = performance.now()
        try {
            const { factory, legacy } = await this.logicLocation(entry)
            timings.locateMs = this.elapsedMs(startedAt)
            const definition = factory
                ? await this.evaluateFactory(factory, timings)
                : await this.importLegacyModule(legacy, entry.packageId, timings)
            if (
                definition.info.id !== entry.gameId ||
                definition.info.metadata.version !== entry.logicVersion
            ) {
                throw new Error(
                    `Logic artifact identity differs from publication: ${entry.packageId} ${entry.logicVersion}`
                )
            }
            this.logTitleLoad('loaded', entry, timings)
            return { definition, publication: entry }
        } catch (error) {
            this.logTitleLoad('failed', entry, timings)
            throw error
        }
    }

    private async evaluateFactory(
        filename: string,
        timings: TitleLoadTimings
    ): Promise<GameDefinition> {
        const readStartedAt = performance.now()
        const source = await readFile(filename)
        timings.readMs = this.elapsedMs(readStartedAt)
        timings.bytes = source.byteLength
        const evaluateStartedAt = performance.now()
        try {
            return evaluateLogicDefinition(source.toString('utf8'), filename)
        } finally {
            timings.evaluateMs = this.elapsedMs(evaluateStartedAt)
        }
    }

    private async importLegacyModule(
        filename: string,
        packageId: string,
        timings: TitleLoadTimings
    ): Promise<GameDefinition> {
        const importStartedAt = performance.now()
        try {
            return await importLogicModule(filename, packageId)
        } finally {
            timings.importMs = this.elapsedMs(importStartedAt)
        }
    }

    private logTitleLoad(
        outcome: 'loaded' | 'failed',
        entry: SiteManifestGame,
        timings: TitleLoadTimings
    ): void {
        console.log(
            JSON.stringify({
                severity: outcome === 'loaded' ? 'INFO' : 'WARNING',
                event: 'title_logic_load',
                message: `Title logic ${outcome}: ${entry.gameId} ${entry.logicVersion}`,
                outcome,
                titleId: entry.gameId,
                logicVersion: entry.logicVersion,
                ...timings
            })
        )
    }

    private elapsedMs(since: number): number {
        return Math.round(performance.now() - since)
    }

    // A published artifact is its collectible factory, or for artifacts published before the
    // factory existed the ESM bundle, which stays resident until the process ends. Local
    // development runs the workspace's compiled sources when there is no published artifact.
    private async logicLocation(
        entry: SiteManifestGame
    ): Promise<{ factory?: string; legacy: string }> {
        if (
            !entry.packageId ||
            !entry.logicVersion ||
            path.basename(entry.packageId) !== entry.packageId ||
            path.basename(entry.logicVersion) !== entry.logicVersion ||
            entry.packageId === '..' ||
            entry.logicVersion === '..'
        ) {
            throw new Error('Invalid logic artifact location')
        }
        const published = path.join(this.logicRoot, entry.packageId, 'logic', entry.logicVersion)
        if (this.fallbackManifest && !(await this.pathExists(published))) {
            // The workspace bundle is the production artifact, so it is preferred whenever it is
            // at least as fresh as the compiled sources; otherwise the sources are imported.
            const workspace = path.join(this.logicRoot, entry.packageId)
            const bundle = path.join(workspace, 'bundle')
            const factory = path.join(bundle, 'index.cjs')
            const compiled = path.join(workspace, 'esm', 'index.js')
            const [factoryModified, compiledModified] = await Promise.all([
                this.modifiedAt(factory),
                this.modifiedAt(compiled)
            ])
            if (factoryModified !== undefined && factoryModified >= (compiledModified ?? 0)) {
                return { factory, legacy: path.join(bundle, 'index.js') }
            }
            if (compiledModified !== undefined) return { legacy: compiled }
            return { legacy: path.join(bundle, 'index.js') }
        }
        const factory = path.join(published, 'index.cjs')
        return {
            factory: (await this.pathExists(factory)) ? factory : undefined,
            legacy: path.join(published, 'index.js')
        }
    }

    private async modifiedAt(filePath: string): Promise<number | undefined> {
        try {
            return (await stat(filePath)).mtimeMs
        } catch {
            return undefined
        }
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

    private publicationsMatch(loaded: SiteManifest, manifest: SiteManifest): boolean {
        return this.publicationSignature(loaded) === this.publicationSignature(manifest)
    }

    private publicationSignature(manifest: SiteManifest): string {
        return JSON.stringify(
            (manifest.games ?? [])
                .map((entry) => [
                    entry.gameId,
                    entry.packageId,
                    entry.logicVersion,
                    entry.uiVersion
                ])
                .sort(([left], [right]) => left.localeCompare(right))
        )
    }
}
