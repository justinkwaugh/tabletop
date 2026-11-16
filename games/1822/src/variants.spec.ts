import { describe, expect, it } from 'vitest'
import {
    certificatesOwnedBy,
    evaluateSharePurchase,
    getCompany,
    privateTrackConstruction,
    rotateTileFace,
    tileExits,
    type TrackRequest
} from '@tabletop/18xx'
import { SetupSeeds, boxLot, kit, prepared, type Table } from '../test/kit.js'
import {
    cashOf,
    company,
    giveCharter,
    player,
    runMinor,
    setCash,
    stepTo
} from '../test/positions.js'
import { FirstMinorId, MinorIds1822 } from './companies.js'
import { GameConfig1822 } from './definition/gameConfig.js'
import { bidBoxId1822, privateBoxStackId1822, refillBidBoxes1822 } from './lots.js'
import { MarketPoolId1822 } from './names.js'
import { PrivatePowerRules1822, advancedColor1822 } from './privatePowers.js'
import {
    EnglishChannelPrivateId,
    FirstPrivateId,
    GrimsbyLocationId,
    HullLocationId,
    HumberBridgePrivateId,
    PrivateStacks1822,
    TaxHavenPrivateId,
    private1822
} from './privates.js'
import type { State1822 } from './state.js'
import { StockRules1822 } from './stock.js'
import { Market1822 } from './stockMarket.js'
import { Tiles1822 } from './tiles.js'
import { TrackRules1822 } from './track.js'

const Plus = { plus: true }
const stackOf = (state: State1822, id: string) =>
    state.bidBoxes.stacks.find((stack) => stack.id === id)?.lotIds ?? []

describe('game options (§6.1, §6.2.2)', () => {
    it('keeps the private company setup choices to games with 1822+', () => {
        expect(GameConfig1822.variants({ allPrivates: true, mixedPrivates: true })).toEqual({})
        expect(GameConfig1822.variants({ plus: true, allPrivates: true })).toEqual({
            plus: true,
            allPrivates: true
        })
        expect(GameConfig1822.variants({ taxHavenShares: true })).toEqual({ taxHavenShares: true })
    })

    it('plays the original game without options', () => {
        const { state } = kit.table(4, 3)
        expect(state.variants).toEqual({})
        expect(state.removedPrivateIds).toBeUndefined()
        expect(state.companies.filter((entry) => entry.kind === 'minor')).toHaveLength(24)
        expect(state.companies.some((entry) => entry.id === HumberBridgePrivateId)).toBe(false)
    })
})

describe('1822+ setup (§2.1.7)', () => {
    it('adds six minor companies, the S&MR still first in its stack', () => {
        const { state } = kit.table(4, 3, Plus)
        expect(
            state.companies.filter((entry) => entry.kind === 'minor').map((entry) => entry.id)
        ).toEqual(MinorIds1822)
        expect(boxLot(state, bidBoxId1822('minor', 1))).toBe(FirstMinorId)
        expect(stackOf(state, 'minor')).toHaveLength(26)
        expect(state.stationReservations.map((entry) => entry.companyId)).toEqual(
            expect.arrayContaining(['M25', 'M26', 'M27', 'M28', 'M29', 'M30'])
        )
    })

    it.each(SetupSeeds)(
        'removes one track private, never P5, and two of the rest (seed %i)',
        (seed) => {
            const { state } = kit.table(4, seed, Plus)
            const removed = state.removedPrivateIds ?? []
            expect(removed.map((id) => private1822(id)?.stack).sort()).toEqual([
                'other',
                'other',
                'track'
            ])
            expect(removed).not.toContain(EnglishChannelPrivateId)
            for (const id of removed) {
                expect(getCompany(state, id).closed).toBe(true)
                expect(state.certificates.some((entry) => entry.companyId === id)).toBe(false)
                expect(state.bidBoxes.stacks.some((stack) => stack.lotIds.includes(id))).toBe(false)
                expect(state.bidBoxes.boxes.some((box) => box.lotId === id)).toBe(false)
            }
        }
    )

    it.each(SetupSeeds)(
        'gives each private box its own stack of six, P1 first (seed %i)',
        (seed) => {
            const { state } = kit.table(4, seed, Plus)
            expect(boxLot(state, bidBoxId1822('private', 1))).toBe(FirstPrivateId)
            for (const stack of PrivateStacks1822) {
                const boxId = privateBoxStackId1822(stack)
                const lotIds = [boxLot(state, boxId), ...stackOf(state, boxId)]
                expect(lotIds).toHaveLength(6)
                expect(lotIds.map((id) => private1822(id ?? '')?.stack)).toEqual(
                    Array.from({ length: 6 }, () => stack)
                )
            }
            expect(stackOf(state, 'private')).toEqual([])
        }
    )

    it('uses all 21 private companies when none are removed (§6.1.3)', () => {
        const { state } = kit.table(4, 3, { plus: true, allPrivates: true })
        expect(state.removedPrivateIds).toBeUndefined()
        expect(
            PrivateStacks1822.map(
                (stack) => stackOf(state, privateBoxStackId1822(stack)).length + 1
            )
        ).toEqual([6, 7, 8])
    })

    it('mixes the private companies into one stack when chosen, P1 first (§6.1.3)', () => {
        const { state } = kit.table(4, 3, { plus: true, mixedPrivates: true })
        expect(state.removedPrivateIds).toHaveLength(3)
        expect(boxLot(state, bidBoxId1822('private', 1))).toBe(FirstPrivateId)
        expect(stackOf(state, 'private')).toHaveLength(15)
        expect(state.bidBoxes.boxes.filter((box) => box.boxId.startsWith('private:'))).toHaveLength(
            3
        )
    })

    it('refills a private box from its own stack and leaves the others in place', () => {
        const game = kit.table(4, 3, Plus)
        const state = structuredClone(game.state)
        const second = bidBoxId1822('private', 2)
        const third = bidBoxId1822('private', 3)
        const [next] = stackOf(state, second)
        const kept = boxLot(state, third)
        state.bidBoxes.boxes = state.bidBoxes.boxes.filter((box) => box.boxId !== second)
        refillBidBoxes1822(state)
        expect(boxLot(state, second)).toBe(next)
        expect(boxLot(state, third)).toBe(kept)
        expect(boxLot(state, bidBoxId1822('private', 1))).toBe(FirstPrivateId)
        // A box whose stack has run out stays empty.
        state.bidBoxes.stacks = state.bidBoxes.stacks.map((stack) =>
            stack.id === second ? { ...stack, lotIds: [] } : stack
        )
        state.bidBoxes.boxes = state.bidBoxes.boxes.filter((box) => box.boxId !== second)
        refillBidBoxes1822(state)
        expect(boxLot(state, second)).toBeUndefined()
        expect(boxLot(state, third)).toBe(kept)
    })

    it('moves a certificate with P17 within the stack it lies in', () => {
        const game = prepared(
            (state, [first]) => {
                state.phaseId = '2'
                kit.operated(state, 'CR', first, { price: 100, shares: 6, cash: 400 })
                kit.giveTrain(state, 'CR', '2')
                giveCharter(state, 'P17', company('CR'))
            },
            { config: { plus: true, allPrivates: true } }
        )
        stepTo(game, 'LayingTrack', 'CR')
        const stackId = privateBoxStackId1822('track')
        const before = stackOf(game.state, stackId)
        const others = game.state.bidBoxes.stacks.filter((stack) => stack.id !== stackId)
        const lotId = before[before.length - 1]
        game.act('MoveStackCard', { companyId: 'CR', lotId, to: 'top' })
        expect(stackOf(game.state, stackId)).toEqual([lotId, ...before.slice(0, -1)])
        expect(game.state.bidBoxes.stacks.filter((stack) => stack.id !== stackId)).toEqual(others)
        expect(getCompany(game.state, 'P17').closed).toBe(true)
    })
})

describe('P21, the Humber Suspension Bridge Company (Table 3)', () => {
    function bridging(phaseId = '2', prepare?: (state: State1822) => void): Table {
        const game = prepared(
            (state, [first]) => {
                state.phaseId = phaseId
                runMinor(state, 'M9', first, { cash: 100 })
                kit.giveTrain(state, 'M9', 'L')
                giveCharter(state, HumberBridgePrivateId, company('M9'))
                prepare?.(state)
            },
            { config: { plus: true, allPrivates: true } }
        )
        stepTo(game, 'LayingTrack', 'M9')
        return game
    }
    const terms = (game: Table) =>
        PrivatePowerRules1822.trackTerms(game.hydrated, HumberBridgePrivateId, game.player)
    const faceOf = (definitionId: string) => {
        const tile = Tiles1822.find((entry) => entry.id === definitionId)
        if (!tile) throw new Error(`No tile ${definitionId}`)
        return tile.face
    }
    function choices(game: Table, locationId: string, color = 'yellow') {
        const found = terms(game)
        if (!found) return []
        return privateTrackConstruction(game.hydrated, found, TrackRules1822)
            .choices(locationId)
            .filter((choice) => faceOf(choice.definitionId).color === color)
    }
    function lay(game: Table, choice: TrackRequest & { cost: number }) {
        game.act('LayPrivateTile', {
            privateCompanyId: HumberBridgePrivateId,
            companyId: 'M9',
            locationId: choice.locationId,
            definitionId: choice.definitionId,
            rotation: choice.rotation,
            nodeMapping: choice.nodeMapping,
            expectedCost: choice.cost
        })
    }
    const exitsOf = (state: State1822, locationId: string) => {
        const placement = state.tileInventory.placements[locationId]
        return [...tileExits(rotateTileFace(faceOf(placement.definitionId), placement.rotation))]
    }

    it('lays yellow tiles in Grimsby and Hull across the Humber at no cost, then closes', () => {
        const game = bridging()
        expect(terms(game)?.locationIds).toEqual([HullLocationId, GrimsbyLocationId])
        const treasury = cashOf(game.state, company('M9'))
        const grimsby = choices(game, GrimsbyLocationId)
        expect(grimsby.length).toBeGreaterThan(0)
        expect(grimsby.every((choice) => choice.cost === 0)).toBe(true)
        lay(game, grimsby[0])
        expect(exitsOf(game.state, GrimsbyLocationId)).toContain(3)
        expect(getCompany(game.state, HumberBridgePrivateId).closed).toBeFalsy()
        // The second lay is in the other city only, though a minor lays one tile a turn.
        expect(terms(game)?.locationIds).toEqual([HullLocationId])
        lay(game, choices(game, HullLocationId)[0])
        expect(exitsOf(game.state, HullLocationId)).toContain(0)
        expect(cashOf(game.state, company('M9'))).toBe(treasury)
        expect(getCompany(game.state, HumberBridgePrivateId).closed).toBe(true)
        expect(TrackRules1822.allowance(game.hydrated, 'yellow')).toHaveProperty('reason')
    })

    it('closes with the track step when it laid in one city only', () => {
        const game = bridging()
        lay(game, choices(game, HullLocationId)[0])
        expect(getCompany(game.state, HumberBridgePrivateId).closed).toBeFalsy()
        game.act('FinishTrack', { companyId: 'M9' })
        expect(getCompany(game.state, HumberBridgePrivateId).closed).toBe(true)
    })

    it('needs a station in Hull or Grimsby and is the turn’s track', () => {
        const elsewhere = prepared(
            (state, [first]) => {
                state.phaseId = '2'
                runMinor(state, 'M8', first, { cash: 100 })
                kit.giveTrain(state, 'M8', 'L')
                giveCharter(state, HumberBridgePrivateId, company('M8'))
            },
            { config: { plus: true, allPrivates: true } }
        )
        stepTo(elsewhere, 'LayingTrack', 'M8')
        expect(
            PrivatePowerRules1822.trackTerms(
                elsewhere.hydrated,
                HumberBridgePrivateId,
                elsewhere.player
            )
        ).toBeUndefined()

        const game = bridging()
        const state = structuredClone(game.state)
        state.trackStep = {
            companyId: 'M9',
            completed: false,
            lays: [{ locationId: 'test', definitionId: '18xx:9' }]
        }
        game.state = state
        expect(terms(game)).toBeUndefined()
    })

    it('leaves no room for P11’s early upgrade in the same turn', () => {
        const game = bridging('2', (state) => giveCharter(state, 'P11', company('M9')))
        expect(advancedColor1822(game.hydrated, 'M9')).toBe('green')
        lay(game, choices(game, HullLocationId)[0])
        expect(advancedColor1822(game.hydrated, 'M9')).toBeUndefined()
    })

    it('upgrades to green only from phase 3, and only once', () => {
        expect(terms(bridging('2'))?.colors).toEqual(['yellow'])
        const game = bridging('3')
        expect(terms(game)?.colors).toEqual(['yellow', 'green'])
        lay(game, choices(game, GrimsbyLocationId)[0])
        // A tile just laid with the power is not then upgraded with it.
        expect(terms(game)?.locationIds).toEqual([HullLocationId])
    })
})

describe('the off-shore tax haven (Table 3, §3.1.15, §6.1.2)', () => {
    const haven = company(TaxHavenPrivateId)
    function holding(config: Record<string, boolean>, havenCash = 0): Table {
        return prepared(
            (state, [first, second]) => {
                state.phaseId = '3'
                for (const companyId of ['CR', 'GWR']) {
                    kit.operated(state, companyId, second, { price: 100, shares: 4, cash: 400 })
                    kit.giveTrain(state, companyId, '2')
                }
                giveCharter(state, TaxHavenPrivateId, player(first))
                setCash(state, haven, havenCash)
            },
            { config }
        )
    }
    const share = (state: State1822, companyId: string) => {
        const found = state.certificates.find(
            (entry) =>
                entry.companyId === companyId &&
                entry.kind === 'share' &&
                !entry.president &&
                entry.owner.kind !== 'player' &&
                entry.poolId !== MarketPoolId1822 &&
                !(entry.owner.kind === 'company' && entry.owner.companyId === TaxHavenPrivateId)
        )
        if (!found) throw new Error(`No ${companyId} share on offer`)
        return found.id
    }
    const priceOf = (game: Table, companyId: string) =>
        Market1822.companySpace(game.state.stockMarket, companyId).price
    const buy = (game: Table, companyId: string) =>
        game.act('BuyShares', {
            buyer: haven,
            certificateId: share(game.state, companyId),
            expectedPrice: priceOf(game, companyId)
        })
    const refusal = (game: Table, companyId: string) =>
        evaluateSharePurchase(
            game.hydrated,
            { playerId: game.player, buyer: haven, certificateId: share(game.state, companyId) },
            StockRules1822
        ).reason
    /** Plays to the player's turn in the next stock round. */
    function nextStockRound(game: Table, first: string): void {
        const round = game.state.stockRound.number
        for (let moves = 0; moves < 400; moves++) {
            const state = game.state
            if (
                state.machineState === 'StockRound' &&
                state.stockRound.number > round &&
                game.player === first
            )
                return
            if (state.machineState === 'StockRound') game.act('FinishStockTurn', {}, game.player)
            else stepTo(game, 'StockRound', '')
        }
        throw new Error('No later stock round')
    }

    it('buys its one share with its owner’s money, and no more', () => {
        const game = holding({})
        const first = game.player
        buy(game, 'CR')
        expect(cashOf(game.state, player(first))).toBe(525 - 100)
        expect(certificatesOwnedBy(game.state, haven).map((entry) => entry.companyId)).toEqual([
            'CR'
        ])
        nextStockRound(game, first)
        const state = structuredClone(game.state)
        setCash(state, haven, 500)
        game.state = state
        expect(refusal(game, 'GWR')).toBe('The tax haven holds a single share.')
    })

    it('buys further shares with its own money under the variant, one a stock round', () => {
        const game = holding({ taxHavenShares: true })
        const first = game.player
        buy(game, 'CR')
        expect(cashOf(game.state, player(first))).toBe(525 - 100)
        nextStockRound(game, first)
        // Its owner's money buys no second share for it.
        expect(refusal(game, 'GWR')).toBe('The tax haven’s money does not cover this share.')
        const state = structuredClone(game.state)
        setCash(state, haven, 250)
        game.state = state
        expect(refusal(game, 'CR')).toBe('The tax haven holds one certificate of a company.')
        const before = cashOf(game.state, player(first))
        const price = priceOf(game, 'GWR')
        buy(game, 'GWR')
        expect(cashOf(game.state, haven)).toBe(250 - price)
        expect(cashOf(game.state, player(first))).toBe(before)
        expect(
            certificatesOwnedBy(game.state, haven)
                .map((entry) => entry.companyId)
                .sort()
        ).toEqual(['CR', 'GWR'])
    })

    it('buys nothing more in the stock round of its first share under the variant', () => {
        const game = holding({ taxHavenShares: true }, 300)
        const first = game.player
        buy(game, 'CR')
        // Round the table back to its owner.
        while (game.player !== first) game.act('FinishStockTurn', {}, game.player)
        expect(game.state.machineState).toBe('StockRound')
        expect(refusal(game, 'GWR')).toBe('The tax haven buys one share each stock round.')
    })
})
