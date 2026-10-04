import { WORLD_TILES } from './worldCatalog.js'
import { WorldClass, WorldSide, type WorldTileDefinition } from './worldTypes.js'

export * from './worldTypes.js'

const EARTHLIKE_CLASSES: readonly WorldClass[] = [WorldClass.M, WorldClass.O]
const UNTERRAFORMABLE_CLASSES: readonly WorldClass[] = [WorldClass.J, WorldClass.D, WorldClass.E]

export function worldTile(tileId: string): WorldTileDefinition {
    const tile = WORLD_TILES.find((candidate) => candidate.id === tileId)
    if (!tile) {
        throw new Error(`Unknown world tile ${tileId}`)
    }
    return tile
}

export function maxPopulation(tileId: string, side: WorldSide): number {
    const tile = worldTile(tileId)
    return tile.worldClass === WorldClass.None ? 0 : tile.sides[side].maxPopulation
}

export function isRevealedWorld(tileId: string): boolean {
    return worldTile(tileId).worldClass !== WorldClass.None
}

export function isEarthlikeClass(worldClass: WorldClass): boolean {
    return EARTHLIKE_CLASSES.includes(worldClass)
}

export function isTerraformTarget(worldClass: WorldClass): boolean {
    return worldClass !== WorldClass.None && !UNTERRAFORMABLE_CLASSES.includes(worldClass)
}

export function canTerraformFrom(worldClass: WorldClass, side: WorldSide): boolean {
    if (worldClass === WorldClass.None) {
        return false
    }
    return side === WorldSide.I || !UNTERRAFORMABLE_CLASSES.includes(worldClass)
}

export const ALL_WORLD_TILE_IDS: readonly string[] = WORLD_TILES.map((tile) => tile.id)
