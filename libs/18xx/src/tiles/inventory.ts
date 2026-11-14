import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Clone } from 'typebox/value'
import { assert, assertExists, deepFreeze } from '@tabletop/common'
import { TileRotation, type ImmutableTileData, type TileDefinition } from './tile.js'
import { TrackStop } from './trackStops.js'
import type { TileCatalog } from './catalog.js'

const Identifier = Type.String({ minLength: 1 })

export const TileManifestEntry = Type.Object(
    {
        id: Identifier,
        faceDefinitionIds: Type.Array(Identifier, { minItems: 1, maxItems: 2, uniqueItems: true }),
        count: Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('unlimited')])
    },
    { additionalProperties: false }
)
export type TileManifestEntry = ImmutableTileData<Type.Static<typeof TileManifestEntry>>

export const TileManifest = Type.Object(
    {
        id: Identifier,
        entries: Type.Array(TileManifestEntry)
    },
    { additionalProperties: false }
)
export type TileManifest = ImmutableTileData<Type.Static<typeof TileManifest>>

export const TilePlacement = Type.Object(
    {
        pieceId: Identifier,
        definitionId: Identifier,
        rotation: TileRotation,
        /** Towns standing on the tile's plain track, such as 1862's small stations. */
        trackStops: Type.Optional(Type.Array(TrackStop, { minItems: 1 }))
    },
    { additionalProperties: false }
)
export type TilePlacement = Type.Static<typeof TilePlacement>

export const TileInventory = Type.Object(
    {
        // Stored games from before this stopped being recorded may hold it; never read.
        tileSetId: Type.Optional(Type.Unsafe<never>(Identifier)),
        /** The set's variant chosen at setup, such as a scenario's board and smaller supply. */
        variantId: Type.Optional(Identifier),
        placements: Type.Record(Identifier, TilePlacement),
        retiredPieceIds: Type.Array(Identifier, { uniqueItems: true })
    },
    { additionalProperties: false }
)
export type TileInventory = Type.Static<typeof TileInventory>

export type TilePiece = Pick<TileManifestEntry, 'faceDefinitionIds'> & { readonly id: string }
export type TileInventoryCount = {
    definitionId: string
    total: TileManifestEntry['count']
    available: number | 'unlimited'
}
export type TileReplacement = {
    locationId: string
    placement: TilePlacement
    returnPrevious: boolean
}

/** A tile a set variant prints on the board from the start, standing until play replaces it. */
export type BoardTile = { locationId: string; definitionId: string; rotation: TileRotation }
/**
 * A variant of a tile set chosen at setup, as 1822's scenarios: tiles printed on the board from
 * the start, and the pieces of the supply it plays without, the last so many of each definition.
 * The inventory records only the variant's id, so neither is stored in a game.
 */
export type TileSetVariant = {
    board?: readonly BoardTile[]
    removed?: Readonly<Record<string, number>>
}

const ManifestValidator = Compile(TileManifest)
const InventoryValidator = Compile(TileInventory)
const PlacementValidator = Compile(TilePlacement)

export class TileSet {
    readonly manifest: TileManifest
    readonly definitions: readonly TileDefinition[]
    readonly pieces: readonly TilePiece[]
    private readonly piecesById: Map<string, TilePiece>
    private readonly variants: Readonly<Record<string, TileSetVariant>>
    private readonly variantRemovedPieceIds: ReadonlyMap<string, ReadonlySet<string>>

    constructor(
        manifest: TileManifest,
        catalogs: readonly TileCatalog[],
        variants: Readonly<Record<string, TileSetVariant>> = {}
    ) {
        assert(ManifestValidator.Check(manifest), 'Invalid tile manifest')
        assert(
            new Set(manifest.entries.map((entry) => entry.id)).size === manifest.entries.length,
            'Duplicate tile manifest entry'
        )
        const definitions = new Map<string, TileDefinition>()
        for (const catalog of catalogs) {
            for (const definition of catalog.entries()) {
                assert(
                    !definitions.has(definition.id),
                    `Duplicate catalog definition: ${definition.id}`
                )
                definitions.set(definition.id, definition)
            }
        }
        this.manifest = Clone(manifest)
        deepFreeze(this.manifest)
        const selected = new Set([
            ...manifest.entries.flatMap((entry) => [...entry.faceDefinitionIds]),
            ...Object.values(variants).flatMap((variant) =>
                (variant.board ?? []).map((tile) => tile.definitionId)
            )
        ])
        this.definitions = Object.freeze(
            [...selected].map((id) => {
                const definition = definitions.get(id)
                assertExists(definition, `Unknown tile definition: ${id}`)
                return definition
            })
        )
        this.pieces = manifest.entries.flatMap((entry) =>
            Array.from({ length: entry.count === 'unlimited' ? 0 : entry.count }, (_, index) => ({
                id: `${manifest.id}/${entry.id}/${index + 1}`,
                faceDefinitionIds: [...entry.faceDefinitionIds]
            }))
        )
        deepFreeze(this.pieces)
        this.piecesById = new Map(this.pieces.map((piece) => [piece.id, piece]))
        assert(this.piecesById.size === this.pieces.length, 'Duplicate physical tile identity')
        this.variants = variants
        this.variantRemovedPieceIds = new Map(
            Object.entries(variants).map(([variantId, variant]) => [
                variantId,
                new Set(
                    Object.entries(variant.removed ?? {}).flatMap(([definitionId, count]) => {
                        const pieces = this.pieces.filter((piece) =>
                            piece.faceDefinitionIds.includes(definitionId)
                        )
                        assert(
                            pieces.length >= count,
                            `The set has ${count} of tile ${definitionId} to remove`
                        )
                        return pieces.slice(pieces.length - count).map((piece) => piece.id)
                    })
                )
            ])
        )
    }

    /** The tiles the inventory's variant prints on the board, by location. */
    boardTiles(inventory: TileInventory): readonly BoardTile[] {
        return inventory.variantId ? (this.variants[inventory.variantId]?.board ?? []) : []
    }

    createInventory(
        placements: readonly (Omit<TilePlacement, 'pieceId'> & { locationId: string })[] = [],
        variantId?: string
    ): TileInventory {
        assert(!variantId || this.variants[variantId] !== undefined, 'Unknown tile set variant')
        let inventory: TileInventory = {
            ...(variantId ? { variantId } : {}),
            placements: {},
            retiredPieceIds: []
        }
        for (const { locationId, definitionId, rotation } of placements) {
            assert(!inventory.placements[locationId], 'Duplicate initial tile location')
            const piece = this.availablePieces(inventory, definitionId)[0]
            assertExists(piece, 'Initial tile is unavailable')
            inventory = this.replace(inventory, {
                locationId,
                placement: { pieceId: piece.id, definitionId, rotation },
                returnPrevious: true
            })
        }
        return inventory
    }

    parseInventory(value: unknown): TileInventory {
        assert(InventoryValidator.Check(value), 'Invalid tile inventory schema')
        this.assertInventory(value)
        return Clone(value)
    }

    counts(inventory: TileInventory): readonly TileInventoryCount[] {
        this.assertInventory(inventory)
        const unavailable = this.unavailablePieces(inventory)
        return this.definitions.map((definition) => {
            if (
                this.manifest.entries.some(
                    (entry) =>
                        entry.count === 'unlimited' &&
                        entry.faceDefinitionIds.includes(definition.id)
                )
            ) {
                return { definitionId: definition.id, total: 'unlimited', available: 'unlimited' }
            }
            const pieces = this.pieces.filter((piece) =>
                piece.faceDefinitionIds.includes(definition.id)
            )
            return {
                definitionId: definition.id,
                total: pieces.length,
                available: pieces.filter((piece) => !unavailable.has(piece.id)).length
            }
        })
    }

    availablePieces(inventory: TileInventory, definitionId: string): readonly TilePiece[] {
        this.assertInventory(inventory)
        assert(
            this.definitions.some((definition) => definition.id === definitionId),
            `Tile is not in this set: ${definitionId}`
        )
        const unavailable = this.unavailablePieces(inventory)
        const unlimited = this.manifest.entries.filter(
            (entry) => entry.count === 'unlimited' && entry.faceDefinitionIds.includes(definitionId)
        )
        const generated = unlimited.map((entry) => {
            let index = 1
            while (unavailable.has(`${this.manifest.id}/${entry.id}/${index}`)) index++
            return {
                id: `${this.manifest.id}/${entry.id}/${index}`,
                faceDefinitionIds: entry.faceDefinitionIds
            }
        })
        return [
            ...generated,
            ...this.pieces.filter(
                (piece) =>
                    piece.faceDefinitionIds.includes(definitionId) && !unavailable.has(piece.id)
            )
        ]
    }

    replace(inventory: TileInventory, replacement: TileReplacement): TileInventory {
        this.assertInventory(inventory)
        assert(replacement.locationId.length > 0, 'Tile replacement requires a location')
        assert(PlacementValidator.Check(replacement.placement), 'Invalid tile placement')
        this.assertPieceFace(replacement.placement)
        const placements = new Map(Object.entries(inventory.placements))
        const previous = placements.get(replacement.locationId)
        const next = replacement.placement
        assert(
            previous?.pieceId === next.pieceId ||
                !this.unavailablePieces(inventory).has(next.pieceId),
            'Physical tile is unavailable'
        )
        const retiredPieceIds = [...inventory.retiredPieceIds]
        if (previous && previous.pieceId !== next.pieceId && !replacement.returnPrevious) {
            retiredPieceIds.push(previous.pieceId)
        }
        placements.set(replacement.locationId, { ...next })
        return {
            ...(inventory.variantId ? { variantId: inventory.variantId } : {}),
            placements: Object.fromEntries(
                [...placements].map(([id, placement]) => [id, { ...placement }])
            ),
            retiredPieceIds
        }
    }

    private assertInventory(inventory: TileInventory): void {
        assert(InventoryValidator.Check(inventory), 'Invalid tile inventory schema')
        assert(
            !inventory.variantId || this.variants[inventory.variantId] !== undefined,
            'Unknown tile set variant'
        )
        const used = new Set<string>(this.variantRemoved(inventory))
        for (const placement of Object.values(inventory.placements)) {
            this.assertPieceFace(placement)
            assert(!used.has(placement.pieceId), 'Physical tile occupies multiple locations')
            used.add(placement.pieceId)
        }
        for (const id of inventory.retiredPieceIds) {
            assert(this.piece(id) !== undefined, `Unknown physical tile: ${id}`)
            assert(!used.has(id), 'Retired tile is placed on the map')
            used.add(id)
        }
    }

    private piece(id: string): TilePiece | undefined {
        const finite = this.piecesById.get(id)
        if (finite) return finite
        for (const entry of this.manifest.entries) {
            if (entry.count !== 'unlimited') continue
            const prefix = `${this.manifest.id}/${entry.id}/`
            if (!id.startsWith(prefix)) continue
            const suffix = id.slice(prefix.length)
            const index = Number(suffix)
            if (Number.isSafeInteger(index) && index > 0 && String(index) === suffix)
                return { id, faceDefinitionIds: entry.faceDefinitionIds }
        }
        return undefined
    }

    private assertPieceFace(placement: TilePlacement): void {
        const piece = this.piece(placement.pieceId)
        assertExists(piece, `Unknown physical tile: ${placement.pieceId}`)
        assert(
            piece.faceDefinitionIds.includes(placement.definitionId),
            'Definition is not a face of this physical tile'
        )
    }

    private variantRemoved(inventory: TileInventory): ReadonlySet<string> {
        return (
            (inventory.variantId && this.variantRemovedPieceIds.get(inventory.variantId)) ||
            new Set()
        )
    }

    private unavailablePieces(inventory: TileInventory): Set<string> {
        return new Set([
            ...this.variantRemoved(inventory),
            ...inventory.retiredPieceIds,
            ...Object.values(inventory.placements).map((placement) => placement.pieceId)
        ])
    }
}
