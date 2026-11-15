import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
    BidBoxIds1822,
    BidsPerTurn1822,
    LondonLocationId,
    TitleRules1822,
    major1822,
    minor1822
} from '@tabletop/1822'
import { placeReference } from '@tabletop/18xx'
import { BidBoxModule } from '../../../../libs/18xx-ui/src/lib/session/bidBoxModule.svelte.js'
import { testSession } from '../../../../libs/18xx-ui/src/lib/session/moduleTestSession.js'
import { bidBoxGroups, lot1822, lotName, lotStacks } from './lots.js'
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
        const groups = bidBoxGroups(state)
        expect(groups.map((group) => [group.id, group.boxIds.length])).toEqual([
            ['minor', 4],
            ['concession', 3],
            ['private', 3]
        ])
        expect(groups.every((group) => group.upcoming.length > 0)).toBe(true)
        expect(lot1822('M24', Presentation1822.money)).toMatchObject({
            kind: 'minor',
            initials: 'S&MR',
            detail: placeReference(minor1822('M24')?.home?.locationId ?? '')
        })
        expect(lot1822('M14', Presentation1822.money)).toMatchObject({
            detail: `Beside a ${placeReference(LondonLocationId)} station`
        })
        expect(lot1822('C-LNWR', Presentation1822.money)).toMatchObject({
            kind: 'concession',
            initials: 'LNWR',
            detail: `${placeReference(LondonLocationId)} to ${placeReference(major1822('LNWR')?.destination.locationId ?? '')}`
        })
        expect(lot1822('P6', Presentation1822.money)).toMatchObject({
            kind: 'private',
            income: '£10 a round'
        })
        expect(lotName('C-LNWR')).toBe('LNWR concession')
        expect(lotName('M24')).toBe('M24 Swansea and Mumbles Railway')
    })

    it('lists a stack for each private box in 1822+, with the companies removed (§2.1.7)', () => {
        const state = scenario('first-stock-round-of-1822-plus')
        const privates = bidBoxGroups(state).find((group) => group.id === 'private')
        expect(privates?.boxStacks?.map((stack) => stack.length)).toEqual([5, 5, 5])
        expect(privates?.upcoming).toHaveLength(15)
        expect(privates?.removed).toHaveLength(3)
        expect(lotStacks(state).map((stack) => stack.label)).toEqual([
            'Minor companies',
            'Concessions',
            'Private companies, box 1',
            'Private companies, box 2',
            'Private companies, box 3'
        ])
        // The original game's single stack carries no list by box.
        const original = bidBoxGroups(scenario('first-stock-round'))
        expect(original.every((group) => !group.boxStacks && !group.removed)).toBe(true)
    })

    it('warns what an unsold minor costs: two trains from box 1, one from the others (§4.10.3)', () => {
        const groups = bidBoxGroups(scenario('first-stock-round'))
        expect(groups.find((group) => group.id === 'minor')?.unsoldNotes).toEqual([
            'If unsold, it leaves the game and removes two trains',
            'If unsold, it removes one train',
            'If unsold, it removes one train',
            'If unsold, it removes one train'
        ])
        expect(groups.find((group) => group.id === 'private')?.unsoldNotes).toBeUndefined()
    })

    it('names the companies a scenario plays without under their stacks (§6.2.1)', () => {
        const groups = bidBoxGroups(scenario('small-regional-scenario'))
        const removed = (id: string) => groups.find((group) => group.id === id)?.removed
        expect(removed('minor')).toHaveLength(12)
        expect(removed('concession')?.map(lotName).sort()).toEqual([
            'CR concession',
            'NBR concession',
            'NER concession',
            'SWR concession'
        ])
        expect(removed('private')).toEqual(['P13', 'P14', 'P15', 'P16', 'P17', 'P18'])
    })
})
