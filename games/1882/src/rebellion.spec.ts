import { describe, expect, it } from 'vitest'
import { edit, floatCompany, kit, opened } from '../test/kit.js'
import { TileSet1882 } from './tiles.js'

describe('1882 North-West Rebellion', () => {
    it('removes the yellow tiles laid in rebellion hexes when its train is bought, stations staying (§8)', () => {
        const game = opened(4)
        floatCompany(game, 'CNoR')
        kit.passStockRound(game)
        kit.lay(game, 'E7', '18xx:8', [0, 4])
        edit(game, (state) => {
            state.rebellion = { definitionId: '3' }
            // A yellow city in Lloydminster with a GTP station, and the 2-trains sold.
            const [piece] = TileSet1882.availablePieces(state.tileInventory, '18xx:57')
            state.tileInventory.placements.C3 = {
                pieceId: piece.id,
                definitionId: '18xx:57',
                rotation: 0
            }
            state.stations = state.stations.map((station) =>
                station.id === 'GTP:station:1'
                    ? {
                          ...station,
                          status: 'placed',
                          position: { locationId: 'C3', nodeId: 'city', slot: 0 }
                      }
                    : station
            )
            state.trainInventory.trains = state.trainInventory.trains.filter(
                (train) => train.definitionId !== '2'
            )
        })
        game.act('FinishTrack', { companyId: 'CNoR' })
        while (game.state.machineState !== 'BuyingTrains')
            game.act(
                game.valid().includes('FinishStations') ? 'FinishStations' : 'FinishOperatingTurn',
                {
                    companyId: 'CNoR'
                }
            )
        kit.buyTrain(game, '3')
        expect(game.actions.some((action) => action.type === 'NorthWestRebellion')).toBe(true)
        expect(game.state.rebellion.occurred).toBe(true)
        expect(game.state.tileInventory.placements.E7).toBeUndefined()
        expect(game.state.tileInventory.placements.C3).toBeUndefined()
        expect(game.state.stations.find((station) => station.id === 'GTP:station:1')).toMatchObject(
            {
                status: 'placed',
                position: { locationId: 'C3' }
            }
        )
        // A tile removed returns to the supply.
        expect(TileSet1882.availablePieces(game.state.tileInventory, '18xx:57')).toHaveLength(4)
    })
})
