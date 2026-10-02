import { CropType, type PlantingTile } from '../model/board.js'

export function buildTileBag(): PlantingTile[] {
    const bag: PlantingTile[] = []
    for (const crop of Object.values(CropType)) {
        for (let i = 0; i < 3; i++) bag.push({ crop, farmerCapacity: 1 })
        for (let i = 0; i < 6; i++) bag.push({ crop, farmerCapacity: 2 })
    }
    return bag
}

// 4 tiles are drawn per round for 3–4 players; 5 for 5 players.
export function tilesPerRound(playerCount: number): number {
    return Math.max(4, playerCount)
}
