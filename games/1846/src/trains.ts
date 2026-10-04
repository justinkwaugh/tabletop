import { TrainDepot, type TrainInventory } from '@tabletop/18xx'
export function createInitialTrainInventory(playerCount: number): TrainInventory {
    return new TrainDepot({
        id: '1846',
        trains: [
            { id: '2', name: '2', price: 80, distance: { measure: 'revenue-centers', maximum: 2 } }
        ],
        supply: [{ definitionId: '2', count: playerCount + 2 }]
    }).createInventory()
}
