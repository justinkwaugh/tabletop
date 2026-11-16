import { describe, expect, it } from 'vitest'
import { certificateLimitAllows, placeStockMarker } from '@tabletop/18xx'
import { edit, kit, opened, setCash } from '../test/kit.js'
import { TransferRulesChesapeake } from './operating.js'
import { StockRulesChesapeake } from './stock.js'
import { TileSetChesapeake } from './tiles.js'
import { MarketChesapeake } from './stockMarket.js'

describe('18Chesapeake rulings', () => {
    it('lets a player at the certificate limit buy a yellow-zone share (AAG errata; BGG 37361979)', () => {
        const game = opened(4)
        edit(game, (state) => {
            kit.operated(state, 'LV', 'p2', { price: 70 })
            const yellow = MarketChesapeake.spaces.find((space) => space.color === 'yellow')
            if (!yellow) throw new Error('The market has a yellow zone')
            placeStockMarker(state.stockMarket, 'LV', yellow.id)
            kit.operated(state, 'PRR', 'p3', { price: 80 })
        })
        const share = (companyId: string) => {
            const found = game.state.certificates.find(
                (entry) =>
                    entry.companyId === companyId &&
                    entry.kind === 'share' &&
                    entry.owner.kind === 'bank'
            )
            if (found?.kind !== 'share') throw new Error(`${companyId} has a share on offer`)
            return found
        }
        const atLimit = { ...StockRulesChesapeake, certificateLimit: () => 0 }
        const buyer = { kind: 'player' as const, playerId: 'p1' }
        expect(certificateLimitAllows(game.hydrated, buyer, share('LV'), atLimit)).toBe(true)
        expect(certificateLimitAllows(game.hydrated, buyer, share('PRR'), atLimit)).toBe(false)
    })

    it('caps a president-funded purchase from another company at the train’s face value (§11.8)', () => {
        const game = opened(4)
        edit(game, (state) => {
            kit.operated(state, 'PRR', 'p1', { price: 80, cash: 0 })
            kit.operated(state, 'LV', 'p2', { price: 70 })
            // Harrisburg joined to Hagerstown: a route of two cities obliges a train.
            for (const locationId of ['F2', 'E3']) {
                const [piece] = TileSetChesapeake.availablePieces(state.tileInventory, '18xx:57')
                state.tileInventory.placements[locationId] = {
                    pieceId: piece.id,
                    definitionId: '18xx:57',
                    rotation: kit.rotationFor('18xx:57', [1, 4])
                }
            }
        })
        const trainId = kit.giveTrain(game.state, 'LV', '3')
        expect(
            TransferRulesChesapeake.purchaseFunding?.(game.hydrated, 'PRR', {
                kind: 'train',
                trainId
            })
        ).toEqual({ contributors: [{ kind: 'player', playerId: 'p1' }], maximumPrice: 180 })
        // A treasury that can pay for the bank's 2-train gets no help from its president.
        edit(game, (state) => setCash(state, 'PRR', 80))
        expect(
            TransferRulesChesapeake.purchaseFunding?.(game.hydrated, 'PRR', {
                kind: 'train',
                trainId
            })
        ).toBeUndefined()
    })
})
