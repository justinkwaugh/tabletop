import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BidBoxIds1822, BidsPerTurn1822, TitleRules1822 } from '@tabletop/1822'
import { BidBoxModule } from '../../../../libs/18xx-ui/src/lib/session/bidBoxModule.svelte.js'
import { testSession } from '../../../../libs/18xx-ui/src/lib/session/moduleTestSession.js'
import { bidBoxGroups, lot1822, lotName } from './lots.js'
import { Presentation1822 } from './presentation.js'

const scenario = (name: string) =>
    JSON.parse(readFileSync(new URL(`../scenarios/${name}.json`, import.meta.url), 'utf8')).state

function bidding(validActionTypes = ['PlaceBids']) {
    const state = scenario('bids-under-way')
    const [playerId] = state.activePlayerIds
    const { session, applied } = testSession(state, TitleRules1822, validActionTypes)
    return { module: new BidBoxModule({ ...session, playerId }), applied, state }
}

describe('1822 bidding boxes', () => {
    it('shows every box with its bids, the highest first (§4.9)', () => {
        const { module, state } = bidding()
        expect(module.lots.map((lot) => lot.boxId)).toEqual(
            BidBoxIds1822.filter((boxId) => module.lots.some((lot) => lot.boxId === boxId))
        )
        for (const lot of module.lots) {
            const amounts = lot.bids.map((bid) => bid.amount)
            expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
        }
        expect(module.lots.flatMap((lot) => lot.bids)).toHaveLength(state.bidBoxes.bids.length)
        expect(module.bidsPerTurn).toBe(BidsPerTurn1822)
    })

    it('offers no bid to a player who may not place one', () => {
        const { module } = bidding([])
        expect(module.canBid).toBe(false)
        expect(module.lots.every((lot) => lot.lowest === undefined)).toBe(true)
        expect(module.canPlace).toBe(false)
    })

    it('names each kind of lot for its box (Tables 3, 4 and 6)', () => {
        const state = scenario('first-stock-round')
        const groups = bidBoxGroups(state.bidBoxes)
        expect(groups.map((group) => [group.id, group.boxIds.length])).toEqual([
            ['minor', 4],
            ['concession', 3],
            ['private', 3]
        ])
        expect(groups.every((group) => group.upcoming.length > 0)).toBe(true)
        expect(lot1822('M24', Presentation1822.money)).toMatchObject({
            kind: 'minor',
            initials: 'S&MR',
            detail: 'Swansea & Oystermouth'
        })
        expect(lot1822('M14', Presentation1822.money)).toMatchObject({
            detail: 'Beside a London station'
        })
        expect(lot1822('C-LNWR', Presentation1822.money)).toMatchObject({
            kind: 'concession',
            initials: 'LNWR',
            detail: 'London to Manchester'
        })
        expect(lot1822('P6', Presentation1822.money)).toMatchObject({
            kind: 'private',
            income: '£10 a round'
        })
        expect(lotName('C-LNWR')).toBe('LNWR concession')
        expect(lotName('M24')).toBe('M24 Swansea and Mumbles Railway')
    })
})
