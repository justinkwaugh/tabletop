import { describe, expect, it } from 'vitest'
import { evaluateSharePurchase, getCompany } from '@tabletop/18xx'
import { edit, floatCompany, kit, type Table } from '../test/kit.js'
import { MarketPoolIdChesapeake } from './names.js'
import { StockRoundRulesChesapeake, StockRulesChesapeake } from './stock.js'

/** A two-player table whose first company, not Cornelius Vanderbilt's, has floated. */
function twoPlayerFloat(): { game: Table; companyId: string } {
    const game = kit.table(2, 3)
    kit.buyAllPrivates(game)
    const companyId = ['PRR', 'BO'].find((id) => id !== game.state.corneliusCompanyId) ?? ''
    floatCompany(game, companyId)
    return { game, companyId }
}

const poolShares = (game: Table, companyId: string) =>
    game.state.certificates.filter(
        (entry) => entry.companyId === companyId && entry.poolId === MarketPoolIdChesapeake
    )

/** Sets up the next stock turn for a player, in the first round's place. */
function stockTurn(game: Table, playerId: string): void {
    edit(game, (state) => {
        state.activePlayerIds = [playerId]
        state.turnManager.series = [{ type: 'turn', playerId, start: 0 }]
        state.stockRound.number = 2
    })
}

describe('18Chesapeake two-player variant', () => {
    it('sends a company’s four unsold certificates to the bank pool as it floats (§14.2)', () => {
        const { game, companyId } = twoPlayerFloat()
        expect(poolShares(game, companyId)).toHaveLength(4)
        expect(
            game.state.certificates.some(
                (entry) => entry.companyId === companyId && entry.poolId === 'initial-offering'
            )
        ).toBe(false)
    })

    it('takes a pool share out of the game before a non-president buys one (§14.3)', () => {
        const { game, companyId } = twoPlayerFloat()
        const president = getCompany(game.state, companyId).president
        if (president?.kind !== 'player') throw new Error('A player presides')
        const other = president.playerId === 'p1' ? 'p2' : 'p1'
        stockTurn(game, other)
        const [share] = poolShares(game, companyId)
        game.act(
            'BuyShares',
            {
                buyer: { kind: 'player', playerId: other },
                certificateId: share.id,
                expectedPrice: 80
            },
            other
        )
        expect(poolShares(game, companyId)).toHaveLength(2)
        expect(game.state.certificates.find((entry) => entry.id === share.id)?.owner).toEqual({
            kind: 'player',
            playerId: other
        })
        const bought = game.actions.findLast((action) => action.type === 'BuyShares')
        expect(bought?.metadata).toMatchObject({ removedCertificateIds: [expect.any(String)] })
    })

    it('leaves the buyer nothing when the pool holds only the share that is removed (§14.3)', () => {
        const { game, companyId } = twoPlayerFloat()
        const president = getCompany(game.state, companyId).president
        if (president?.kind !== 'player') throw new Error('A player presides')
        const other = president.playerId === 'p1' ? 'p2' : 'p1'
        const [kept, ...rest] = poolShares(game, companyId)
        edit(game, (state) => {
            state.certificates = state.certificates.filter((entry) =>
                rest.every((removed) => removed.id !== entry.id)
            )
        })
        stockTurn(game, other)
        const request = {
            playerId: other,
            buyer: { kind: 'player' as const, playerId: other },
            certificateId: kept.id
        }
        expect(
            evaluateSharePurchase(game.hydrated, request, StockRulesChesapeake).details
        ).toMatchObject({
            price: 0,
            payments: [],
            removedCertificateIds: [kept.id]
        })
        game.act(
            'BuyShares',
            { buyer: request.buyer, certificateId: kept.id, expectedPrice: 0 },
            other
        )
        expect(game.state.certificates.some((entry) => entry.id === kept.id)).toBe(false)
        // The purchase was the turn's: play passes to the president.
        expect(game.state.activePlayerIds).toEqual([president.playerId])
    })

    it('lets the president buy from the pool without removing a share (§14.3)', () => {
        const { game, companyId } = twoPlayerFloat()
        const president = getCompany(game.state, companyId).president
        if (president?.kind !== 'player') throw new Error('A player presides')
        stockTurn(game, president.playerId)
        const [share] = poolShares(game, companyId)
        expect(
            evaluateSharePurchase(
                game.hydrated,
                { playerId: president.playerId, buyer: president, certificateId: share.id },
                StockRulesChesapeake
            ).details?.removedCertificateIds
        ).toBeUndefined()
    })

    it('raises a floated company with no pool shares at the round’s end (§14.4)', () => {
        const { game, companyId } = twoPlayerFloat()
        expect(StockRoundRulesChesapeake.soldOut(game.hydrated, companyId)).toBe(false)
        edit(game, (state) => {
            state.certificates = state.certificates.filter(
                (entry) =>
                    !(entry.companyId === companyId && entry.poolId === MarketPoolIdChesapeake)
            )
        })
        expect(StockRoundRulesChesapeake.soldOut(game.hydrated, companyId)).toBe(true)
    })
})
