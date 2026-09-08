import { CropType, type PlantingTile } from '../model/board.js'

export function buildTileBag(): PlantingTile[] {
    const bag: PlantingTile[] = []
    for (const crop of Object.values(CropType)) {
        for (let i = 0; i < 3; i++) bag.push({ crop, farmerCapacity: 1 })
        for (let i = 0; i < 6; i++) bag.push({ crop, farmerCapacity: 2 })
    }
    return bag
}
