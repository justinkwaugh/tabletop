import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { GameCatalogEntry } from '@tabletop/common'
import { SiteManifest } from '@tabletop/games-config'
import { CatalogService } from './catalogService.js'

describe('publication catalog', () => {
    let root: string
    let service: CatalogService
    const publication: SiteManifest['games'][number] = {
        gameId: 'example',
        packageId: 'example-package',
        logicVersion: '1.0.0',
        uiVersion: '1.0.0',
        priorLogicVersions: [],
        priorUiVersions: []
    }
    const manifest: SiteManifest = { ...SiteManifest, games: [publication] }
    const entry: GameCatalogEntry = {
        id: 'example',
        thumbnailUrl: '/games/example-package/ui/1.0.0/assets/cover.jpg',
        metadata: {
            name: 'Example',
            designer: 'Designer',
            description: 'A game.',
            year: '2000',
            minPlayers: 2,
            maxPlayers: 4,
            defaultPlayerCount: 3,
            version: '1.0.0',
            beta: false
        }
    }

    beforeEach(async () => {
        root = await mkdtemp(path.join(tmpdir(), 'game-catalog-'))
        service = new CatalogService(root)
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(async () => {
        vi.restoreAllMocks()
        await rm(root, { recursive: true, force: true })
    })

    async function publish(game: typeof publication, content: GameCatalogEntry | string = entry) {
        const directory = path.join(root, game.packageId, 'ui', game.uiVersion)
        await mkdir(directory, { recursive: true })
        await writeFile(
            path.join(directory, 'catalog.json'),
            typeof content === 'string' ? content : JSON.stringify(content)
        )
        await writeFile(path.join(directory, 'index.js'), 'throw new Error("Must not execute UI")')
    }

    it('reads only JSON and reuses cached entries across requests and logic publications', async () => {
        await publish(publication)
        const results = await Promise.all(
            Array.from({ length: 10 }, () => service.getCatalog(manifest))
        )
        expect(results).toEqual(Array.from({ length: 10 }, () => [entry]))
        await rm(path.join(root, publication.packageId), { recursive: true })
        expect(await service.getCatalog(manifest)).toEqual([entry])
        expect(
            await service.getCatalog({
                ...manifest,
                games: [{ ...publication, logicVersion: '2.0.0' }]
            })
        ).toEqual([entry])
    })

    it('discovers UI-only updates and new titles, removes titles, and supports rollback', async () => {
        await publish(publication)
        expect(await service.getCatalog(manifest)).toEqual([entry])
        const updated = { ...publication, uiVersion: '2.0.0' }
        const updatedEntry = {
            ...entry,
            metadata: { ...entry.metadata, name: 'New name' },
            thumbnailUrl: '/games/example-package/ui/2.0.0/assets/new-cover.jpg'
        }
        const added = { ...publication, gameId: 'new-game', packageId: 'new-package' }
        const addedEntry = { ...entry, id: 'new-game' }
        await publish(updated, updatedEntry)
        await publish(added, addedEntry)
        expect(await service.getCatalog({ ...manifest, games: [updated, added] })).toEqual([
            updatedEntry,
            addedEntry
        ])
        expect(await service.getCatalog(manifest)).toEqual([entry])
        expect(await service.getCatalog({ ...manifest, games: [] })).toEqual([])
    })

    it.each(['missing', 'malformed'])(
        'isolates a %s entry and retries without discarding healthy entries',
        async (failure) => {
            const missing = { ...publication, gameId: 'missing', packageId: 'missing-package' }
            await publish(publication)
            if (failure === 'malformed') await publish(missing, '{')
            const partial = { ...manifest, games: [publication, missing] }
            expect(await service.getCatalog(partial)).toEqual([entry])
            await rm(path.join(root, publication.packageId), { recursive: true })
            const repaired = { ...entry, id: 'missing' }
            await publish(missing, repaired)
            expect(await service.getCatalog(partial)).toEqual([entry, repaired])
        }
    )

    it.each([
        ['missing metadata', { metadata: undefined }],
        ['null metadata', { metadata: null }],
        ['missing name', { metadata: { ...entry.metadata, name: undefined } }],
        ['non-string name', { metadata: { ...entry.metadata, name: 123 } }],
        ['non-numeric player count', { metadata: { ...entry.metadata, minPlayers: 'two' } }],
        ['non-boolean beta', { metadata: { ...entry.metadata, beta: 'false' } }],
        ['missing cover', { thumbnailUrl: undefined }],
        ['empty cover', { thumbnailUrl: '' }]
    ])('isolates and retries a catalog with %s', async (_label, invalidFields) => {
        const broken = { ...publication, gameId: 'broken', packageId: 'broken-package' }
        await publish(publication)
        await publish(broken, JSON.stringify({ ...entry, id: broken.gameId, ...invalidFields }))
        const partial = { ...manifest, games: [publication, broken] }
        expect(await service.getCatalog(partial)).toEqual([entry])
        await rm(path.join(root, publication.packageId), { recursive: true })
        const repaired = { ...entry, id: broken.gameId }
        await publish(broken, repaired)
        expect(await service.getCatalog(partial)).toEqual([entry, repaired])
    })

    it('checks identity when a manifest assigns a cached artifact to a different title', async () => {
        await publish(publication)
        expect(await service.getCatalog(manifest)).toEqual([entry])
        expect(
            await service.getCatalog({
                ...manifest,
                games: [{ ...publication, gameId: 'wrong-title' }]
            })
        ).toEqual([])
    })

    it('does not list an artifact under the wrong game identity', async () => {
        await publish(publication, { ...entry, id: 'wrong' })
        expect(await service.getCatalog(manifest)).toEqual([])
        await publish(publication)
        expect(await service.getCatalog(manifest)).toEqual([entry])
    })
})
