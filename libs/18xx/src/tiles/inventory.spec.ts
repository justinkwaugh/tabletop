import { describe, expect, it } from 'vitest'
import { StandardTileCatalog } from './standardCatalog.js'
import { TileSet } from './inventory.js'

function tileSet(id = 'test'): TileSet {
    return new TileSet(
        {
            id,
            entries: [
                { id: 'curve', faceDefinitionIds: ['18xx:7', '18xx:8'], count: 1 },
                { id: 'city', faceDefinitionIds: ['18xx:5'], count: 2 },
                { id: 'upgrade', faceDefinitionIds: ['18xx:14'], count: 1 }
            ]
        },
        [StandardTileCatalog]
    )
}

describe('physical tile inventory', () => {
    it('shares definitions but isolates inventories, including opposite faces', () => {
        const a = tileSet('a'),
            b = tileSet('b')
        const initial = a.createInventory(),
            other = b.createInventory()
        expect(a.definitions[0]).toBe(StandardTileCatalog.get('18xx:7'))
        const placed = a.replace(initial, {
            locationId: 'A1',
            placement: {
                pieceId: 'a/curve/1',
                definitionId: '18xx:8',
                rotation: 4
            },
            returnPrevious: true
        })
        expect(
            a
                .counts(placed)
                .filter((count) => ['18xx:7', '18xx:8'].includes(count.definitionId))
                .map((count) => count.available)
        ).toEqual([0, 0])
        expect(b.counts(other).map((count) => count.available)).toEqual([1, 1, 2, 1])
        expect(initial.placements).toEqual({})
        expect(a.parseInventory(JSON.parse(JSON.stringify(placed)))).toEqual(placed)
    })

    it('replaces pieces atomically, returns both faces, and preserves map-owned facts', () => {
        const set = tileSet()
        const locations = {
            A1: {
                name: 'Hill Town',
                terrain: [{ kind: 'mountain', cost: 80 }],
                reservations: ['company-a'],
                markers: ['port']
            }
        }
        const initial = { locations, inventory: set.createInventory() }
        const laid = set.replace(initial.inventory, {
            locationId: 'A1',
            placement: {
                pieceId: 'test/curve/1',
                definitionId: '18xx:7',
                rotation: 2
            },
            returnPrevious: true
        })
        const upgraded = {
            ...initial,
            inventory: set.replace(laid, {
                locationId: 'A1',
                placement: {
                    pieceId: 'test/upgrade/1',
                    definitionId: '18xx:14',
                    rotation: 5
                },
                returnPrevious: true
            })
        }
        expect(upgraded.locations).toBe(locations)
        expect(upgraded.locations).toEqual(initial.locations)
        expect(set.availablePieces(upgraded.inventory, '18xx:7')).toHaveLength(1)
        expect(set.availablePieces(upgraded.inventory, '18xx:8')).toHaveLength(1)
        expect(upgraded.inventory.placements.A1.rotation).toBe(5)
        expect(laid.placements.A1.definitionId).toBe('18xx:7')
        expect(StandardTileCatalog.get('18xx:14').face.paths[0].endpoints[0]).toEqual({
            kind: 'edge',
            edge: 0
        })
    })

    it('can flip a placed paired piece or retire a replaced piece without duplicate stock', () => {
        const set = tileSet()
        const placed = set.replace(set.createInventory(), {
            locationId: 'A1',
            placement: {
                pieceId: 'test/curve/1',
                definitionId: '18xx:7',
                rotation: 0
            },
            returnPrevious: true
        })
        const flipped = set.replace(placed, {
            locationId: 'A1',
            placement: {
                pieceId: 'test/curve/1',
                definitionId: '18xx:8',
                rotation: 3
            },
            returnPrevious: false
        })
        expect(flipped.retiredPieceIds).toEqual([])
        const retired = set.replace(flipped, {
            locationId: 'A1',
            placement: {
                pieceId: 'test/city/1',
                definitionId: '18xx:5',
                rotation: 0
            },
            returnPrevious: false
        })
        expect(retired.retiredPieceIds).toEqual(['test/curve/1'])
        expect(set.availablePieces(retired, '18xx:7')).toHaveLength(0)
    })

    it('rejects unavailable pieces, mismatched faces and sets, and malformed serialized state', () => {
        const set = tileSet()
        const initial = set.createInventory()
        const placement = { pieceId: 'test/city/1', definitionId: '18xx:5', rotation: 0 } as const
        const placed = set.replace(initial, { locationId: 'A1', placement, returnPrevious: true })
        const before = JSON.stringify(placed)
        expect(() =>
            set.replace(placed, { locationId: 'B2', placement, returnPrevious: true })
        ).toThrow('unavailable')
        expect(() =>
            set.replace(initial, {
                locationId: 'A1',
                placement: { ...placement, definitionId: '18xx:8' },
                returnPrevious: true
            })
        ).toThrow('not a face')
        expect(() =>
            set.parseInventory({ ...placed, placements: { A1: placement, B2: placement } })
        ).toThrow('multiple locations')
        expect(() =>
            set.parseInventory({ ...placed, retiredPieceIds: [placement.pieceId] })
        ).toThrow('Retired tile')
        expect(() =>
            set.parseInventory({ ...placed, placements: { A1: { ...placement, rotation: 6 } } })
        ).toThrow('schema')
        expect(() => set.counts(tileSet('other').createInventory())).toThrow('different set')
        expect(JSON.stringify(placed)).toBe(before)
    })

    it('validates manifest identity, finite counts and catalog resolution', () => {
        const entry = { id: 'x', faceDefinitionIds: ['18xx:7'], count: 1 }
        expect(
            () => new TileSet({ id: 'x', entries: [entry, entry] }, [StandardTileCatalog])
        ).toThrow('Duplicate')
        expect(
            () =>
                new TileSet({ id: 'x', entries: [{ ...entry, count: Infinity }] }, [
                    StandardTileCatalog
                ])
        ).toThrow('manifest')
        expect(
            () =>
                new TileSet({ id: 'x', entries: [{ ...entry, faceDefinitionIds: ['missing'] }] }, [
                    StandardTileCatalog
                ])
        ).toThrow('Unknown tile')
    })
})

it('seeds distinct physical pieces and rejects duplicate locations or exhausted paired faces', () => {
    const set = tileSet()
    const inventory = set.createInventory([
        { locationId: 'a', definitionId: '18xx:5', rotation: 0 },
        { locationId: 'b', definitionId: '18xx:5', rotation: 2 },
        { locationId: 'c', definitionId: '18xx:7', rotation: 1 }
    ])
    expect(
        new Set(Object.values(inventory.placements).map((placement) => placement.pieceId)).size
    ).toBe(3)
    expect(
        set
            .counts(inventory)
            .filter((count) => ['18xx:5', '18xx:7', '18xx:8'].includes(count.definitionId))
            .map((count) => count.available)
    ).toEqual([0, 0, 0])
    expect(() =>
        set.createInventory([
            { locationId: 'a', definitionId: '18xx:5', rotation: 0 },
            { locationId: 'a', definitionId: '18xx:5', rotation: 0 }
        ])
    ).toThrow('Duplicate initial tile location')
    expect(() =>
        set.createInventory([
            { locationId: 'a', definitionId: '18xx:7', rotation: 0 },
            { locationId: 'b', definitionId: '18xx:8', rotation: 0 }
        ])
    ).toThrow('Initial tile is unavailable')
    expect(set.createInventory().placements).toEqual({})
})


it('keeps unlimited supplies available with unique, serializable, reusable piece identities', () => {
    const set = new TileSet({ id: 'unlimited', entries: [
        { id: 'curves', faceDefinitionIds: ['18xx:7', '18xx:8'], count: 'unlimited' },
        { id: 'straight', faceDefinitionIds: ['18xx:9'], count: 1 }
    ] }, [StandardTileCatalog])
    let inventory = set.createInventory()
    for (let i = 0; i < 50; i++) {
        const piece = set.availablePieces(inventory, '18xx:7')[0]
        inventory = set.replace(inventory, { locationId: `A${i}`, placement: {
            pieceId: piece.id, definitionId: '18xx:7', rotation: 0
        }, returnPrevious: true })
    }
    expect(set.counts(inventory).map((count) => count.available)).toEqual(['unlimited', 'unlimited', 1])
    const first = inventory.placements.A0.pieceId
    inventory = set.replace(inventory, { locationId: 'A0', placement: {
        pieceId: set.availablePieces(inventory, '18xx:9')[0].id, definitionId: '18xx:9', rotation: 0
    }, returnPrevious: true })
    expect(set.availablePieces(inventory, '18xx:8')[0].id).toBe(first)
    expect(set.availablePieces(inventory, '18xx:9')).toEqual([])
    inventory = set.replace(inventory, { locationId: 'A1', placement: {
        pieceId: first, definitionId: '18xx:8', rotation: 0
    }, returnPrevious: false })
    expect(inventory.retiredPieceIds).toEqual(['unlimited/curves/2'])
    expect(set.availablePieces(inventory, '18xx:7')[0].id).toBe('unlimited/curves/51')
    expect(set.parseInventory(JSON.parse(JSON.stringify(inventory)))).toEqual(inventory)
    for (const id of ['unlimited/curves/0', 'unlimited/curves/01', 'unlimited/curves/NaN']) {
        expect(() => set.parseInventory({ ...inventory, retiredPieceIds: [id] })).toThrow('Unknown physical tile')
    }
})
