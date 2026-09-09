import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Clone } from 'typebox/value'
import { assert, assertExists, deepFreeze } from '@tabletop/common'
import { TileRotation, type ImmutableTileData, type TileDefinition } from './tile.js'
import type { TileCatalog } from './catalog.js'

const Identifier = Type.String({ minLength: 1 })

export const TileManifestEntry = Type.Object(
    {
        id: Identifier,
        faceDefinitionIds: Type.Array(Identifier, { minItems: 1, maxItems: 2, uniqueItems: true }),
        count: Type.Integer({ minimum: 1 })
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
        rotation: TileRotation
    },
    { additionalProperties: false }
)
export type TilePlacement = Type.Static<typeof TilePlacement>

export const TileInventory = Type.Object(
    {
        tileSetId: Identifier,
        placements: Type.Record(Identifier, TilePlacement),
        retiredPieceIds: Type.Array(Identifier, { uniqueItems: true })
    },
    { additionalProperties: false }
)
export type TileInventory = Type.Static<typeof TileInventory>

export type TilePiece = Pick<TileManifestEntry, 'faceDefinitionIds'> & { readonly id: string }
export type TileInventoryCount = {
    definitionId: string
    total: number
    available: number
}
export type TileReplacement = {
    locationId: string
    placement: TilePlacement
    returnPrevious: boolean
}

const ManifestValidator = Compile(TileManifest)
const InventoryValidator = Compile(TileInventory)
const PlacementValidator = Compile(TilePlacement)

export class TileSet {
    readonly manifest: TileManifest
    readonly definitions: readonly TileDefinition[]
    readonly pieces: readonly TilePiece[]
    private readonly piecesById: Map<string, TilePiece>

    constructor(manifest: TileManifest, catalogs: readonly TileCatalog[]) {
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
        const selected = new Set(manifest.entries.flatMap((entry) => [...entry.faceDefinitionIds]))
        this.definitions = Object.freeze(
            [...selected].map((id) => {
                const definition = definitions.get(id)
                assertExists(definition, `Unknown tile definition: ${id}`)
                return definition
            })
        )
        this.pieces = manifest.entries.flatMap((entry) =>
            Array.from({ length: entry.count }, (_, index) => ({
                id: `${manifest.id}/${entry.id}/${index + 1}`,
                faceDefinitionIds: [...entry.faceDefinitionIds]
            }))
        )
        deepFreeze(this.pieces)
        this.piecesById = new Map(this.pieces.map((piece) => [piece.id, piece]))
        assert(this.piecesById.size === this.pieces.length, 'Duplicate physical tile identity')
    }

    createInventory(): TileInventory {
        return { tileSetId: this.manifest.id, placements: {}, retiredPieceIds: [] }
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
        return this.pieces.filter(
            (piece) => piece.faceDefinitionIds.includes(definitionId) && !unavailable.has(piece.id)
        )
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
            tileSetId: inventory.tileSetId,
            placements: Object.fromEntries(
                [...placements].map(([id, placement]) => [id, { ...placement }])
            ),
            retiredPieceIds
        }
    }

    private assertInventory(inventory: TileInventory): void {
        assert(InventoryValidator.Check(inventory), 'Invalid tile inventory schema')
        assert(
            inventory.tileSetId === this.manifest.id,
            'Tile inventory belongs to a different set'
        )
        const used = new Set<string>()
        for (const placement of Object.values(inventory.placements)) {
            this.assertPieceFace(placement)
            assert(!used.has(placement.pieceId), 'Physical tile occupies multiple locations')
            used.add(placement.pieceId)
        }
        for (const id of inventory.retiredPieceIds) {
            assert(this.piecesById.has(id), `Unknown physical tile: ${id}`)
            assert(!used.has(id), 'Retired tile is placed on the map')
            used.add(id)
        }
    }

    private assertPieceFace(placement: TilePlacement): void {
        const piece = this.piecesById.get(placement.pieceId)
        assertExists(piece, `Unknown physical tile: ${placement.pieceId}`)
        assert(
            piece.faceDefinitionIds.includes(placement.definitionId),
            'Definition is not a face of this physical tile'
        )
    }

    private unavailablePieces(inventory: TileInventory): Set<string> {
        return new Set([
            ...inventory.retiredPieceIds,
            ...Object.values(inventory.placements).map((placement) => placement.pieceId)
        ])
    }
}
