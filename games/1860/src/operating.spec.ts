import { describe, expect, it } from 'vitest'
import { TrackConstruction, getCompany, type TileRotation } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { companiesToClose } from './endgame.js'
import { homeTileChoices } from './homeTile.js'
import { dividendSteps, EarningsRules1860 } from './operating.js'
import type { State1860 } from './state.js'
import { Market1860, marketSpaceIdAt } from './stockMarket.js'
import { TileSet1860 } from './tiles.js'
import { TrackRules1860, upgradeReason } from './track.js'
import { edit, kit } from '../test/kit.js'
import { openedWith, playerCash, running, seated, setPrice } from '../test/positions.js'

function tileId(number: string): string {
    const id = TileSet1860.definitions.find((tile) => tile.printedNumber === number)?.id
    assertExists(id, `No tile ${number}`)
    return id
}

function place(state: State1860, locationId: string, number: string, rotation: TileRotation): void {
    const definitionId = tileId(number)
    const [piece] = TileSet1860.availablePieces(state.tileInventory, definitionId)
    assertExists(piece, `No ${number} left`)
    state.tileInventory = TileSet1860.replace(state.tileInventory, {
        locationId,
        placement: { pieceId: piece.id, definitionId, rotation },
        returnPrevious: true
    })
}

function trackStep(state: State1860, companyId: string, lays: readonly string[] = []): State1860 {
    return {
        ...state,
        trackStep: {
            companyId,
            completed: false,
            lays: lays.map((number) => ({ locationId: 'A1', definitionId: tileId(number) }))
        }
    }
}

describe('laying track', () => {
    const state = openedWith(seated(3)).state

    it('lays two yellow tiles, or one large station, or one upgrade (TR-1)', () => {
        expect(TrackRules1860.allowance(trackStep(state, 'IOW'), 'yellow')).toEqual({ cost: 0 })
        expect(TrackRules1860.allowance(trackStep(state, 'IOW', ['742']), 'yellow')).toEqual({
            cost: 0
        })
        expect(
            TrackRules1860.allowance(trackStep(state, 'IOW', ['742', '8']), 'yellow')
        ).toHaveProperty('reason')
        expect(TrackRules1860.allowance(trackStep(state, 'IOW', ['57']), 'yellow')).toHaveProperty(
            'reason'
        )
        expect(
            TrackRules1860.allowance(trackStep(state, 'IOW', ['742']), 'green', true)
        ).toHaveProperty('reason')
    })

    it('lets an insolvent company make no upgrade (TR-7)', () => {
        const insolvent = { ...trackStep(state, 'IOW'), insolventIds: ['IOW'] }
        expect(TrackRules1860.allowance(insolvent, 'green', true)).toHaveProperty('reason')
        expect(TrackRules1860.allowance(insolvent, 'yellow')).toEqual({ cost: 0 })
    })

    it('upgrades only within reach of one of the company’s trains (TR-6)', () => {
        const game = openedWith(seated(3))
        edit(game, (draft) => {
            running(draft, 'IOW', 'p3')
            draft.phaseId = '3'
            place(draft, 'J4', '57', 2)
            place(draft, 'K5', '743', 2)
            place(draft, 'L6', '5', 1)
        })
        const rotation: TileRotation = 1
        const request = {
            companyId: 'IOW',
            locationId: 'L6',
            definitionId: tileId('756'),
            rotation,
            nodeMapping: { city: 'city' }
        }
        expect(upgradeReason(trackStep(game.state, 'IOW'), request)).toMatch(/without a train/)
        // A 2+1 counts Ryde Esplanade and Ryde, so Bembridge, a third large station, is beyond it.
        edit(game, (draft) => {
            kit.giveTrain(draft, 'IOW', '2+1')
        })
        expect(upgradeReason(trackStep(game.state, 'IOW'), request)).toMatch(/reach/)
        edit(game, (draft) => {
            kit.giveTrain(draft, 'IOW', '3+2')
        })
        expect(upgradeReason(trackStep(game.state, 'IOW'), request)).toBeUndefined()
    })

    it('checks reach with the upgrade laid, and not into a large station beyond it (TR-6)', () => {
        // Bembridge's green tile faces away from the halt; the russet tile joins them.
        const upgrade = (train: string) => {
            const game = openedWith(seated(3))
            edit(game, (draft) => {
                running(draft, 'IOW', 'p3')
                draft.phaseId = '5'
                place(draft, 'J4', '57', 2)
                place(draft, 'K5', '743', 2)
                place(draft, 'L6', '756', 3)
                kit.giveTrain(draft, 'IOW', train)
            })
            const rotation: TileRotation = 1
            return upgradeReason(trackStep(game.state, 'IOW'), {
                companyId: 'IOW',
                locationId: 'L6',
                definitionId: tileId('776'),
                rotation,
                nodeMapping: { city: 'city' }
            })
        }
        // The new track runs only into Bembridge, a third large station for a 2+1.
        expect(upgrade('2+1')).toMatch(/reach/)
        expect(upgrade('3+2')).toBeUndefined()
    })
})

describe('labelled upgrades', () => {
    function upgrades(companyId: string, locationId: string) {
        const game = openedWith(seated(3))
        edit(game, (draft) => {
            running(draft, companyId, 'p1')
            kit.giveTrain(draft, companyId, '2+1')
            draft.phaseId = '3'
        })
        return new TrackConstruction(trackStep(game.state, companyId), TrackRules1860)
            .choices(locationId)
            .map((choice) => [choice.definitionId, choice.rotation])
    }

    it('lays Ryde’s green tile only as printed, joining Ryde Pier (TR-9)', () => {
        expect(upgrades('IOW', 'I3')).toEqual([[tileId('758'), 0]])
    })

    it('lays the yellow Cowes running south or south-west as the C&N floats (TR-9, TR-10)', () => {
        const game = openedWith(seated(3))
        edit(game, (draft) => {
            running(draft, 'CN', 'p2')
            draft.homeTileCompanyId = 'CN'
        })
        expect(
            homeTileChoices(game.hydrated).map((choice) => [choice.definitionId, choice.rotation])
        ).toEqual([
            [tileId('787'), 0],
            [tileId('787'), 1]
        ])
    })

    it('lays Merstone’s green tile with Blackwater’s halt toward Newport (TR-9)', () => {
        expect(upgrades('IWNJ', 'G7')).toEqual([[tileId('761'), 0]])
    })
})

describe('dividends and the share price', () => {
    it('moves along the tier for each multiple of the price, up to four (DV-2)', () => {
        expect(dividendSteps(0, 74)).toBe(-1)
        expect(dividendSteps(70, 74)).toBe(0)
        expect(dividendSteps(74, 74)).toBe(1)
        expect(dividendSteps(150, 74)).toBe(2)
        expect(dividendSteps(500, 74)).toBe(4)
    })

    it('moves two places on the zig-zag track for each space on the tier', () => {
        const game = openedWith(seated(3))
        edit(game, (draft) => running(draft, 'IOW', 'p3'))
        const effect = (revenue: number, retained: number) =>
            EarningsRules1860.marketEffect(game.state, 'IOW', {
                choice: retained ? 'withhold' : 'pay',
                revenue,
                retained,
                baseDividendPerShare: (revenue - retained) / 10
            }).move?.toMarketSpaceId
        expect(effect(80, 0)).toBe(marketSpaceIdAt(82))
        expect(effect(80, 80)).toBe(marketSpaceIdAt(68))
        expect(effect(150, 0)).toBe(marketSpaceIdAt(90))
    })

    it('makes an insolvent company keep its revenue, and a nationalised one pay', () => {
        const game = openedWith(seated(3))
        edit(game, (draft) => {
            running(draft, 'IOW', 'p3')
            draft.insolventIds = ['IOW']
        })
        expect(EarningsRules1860.choices(game.state, 'IOW')).toEqual(['withhold'])
        edit(game, (draft) => {
            draft.insolventIds = []
            draft.nationalisation = { closedCompanyIds: [], dividends: {} }
        })
        expect(EarningsRules1860.choices(game.state, 'IOW')).toEqual(['pay'])
    })
})

describe('British Rail', () => {
    function nationalised(dividends: Record<string, number>) {
        const game = openedWith(seated(3))
        edit(game, (draft) => {
            for (const [index, companyId] of Object.keys(dividends).entries())
                running(draft, companyId, ['p1', 'p2', 'p3'][index % 3])
            draft.nationalisation = { closedCompanyIds: [], dividends }
        })
        return game.state
    }

    it('closes the two lowest payers after each round (SO-8)', () => {
        expect(
            companiesToClose(nationalised({ IOW: 100, CN: 50, FYN: 80, IWNJ: 200 })).sort()
        ).toEqual(['CN', 'FYN'])
    })

    it('closes every company tied at a closing value (SO-8)', () => {
        expect(companiesToClose(nationalised({ IOW: 0, CN: 0, FYN: 0, IWNJ: 200 })).sort()).toEqual(
            ['CN', 'FYN', 'IOW']
        )
        expect(
            companiesToClose(nationalised({ IOW: 0, CN: 50, FYN: 50, IWNJ: 200 })).sort()
        ).toEqual(['CN', 'FYN', 'IOW'])
    })

    it('closes the last one or two after their final round', () => {
        expect(companiesToClose(nationalised({ IOW: 300, CN: 50 })).sort()).toEqual(['CN', 'IOW'])
    })
})

describe('bankruptcy', () => {
    it('returns every share to the IPO when a sale takes the price to nothing (BK-1, BK-2)', () => {
        const game = openedWith(seated(3))
        edit(game, (draft) => {
            running(draft, 'NGStL', 'p1', { shares: 4 })
            setPrice(draft, 'NGStL', 7)
            const share = draft.certificates.find((c) => c.id === 'NGStL:share:3')
            assertExists(share, 'NGStL has a third share')
            share.owner = { kind: 'player', playerId: 'p2' }
            delete share.poolId
            kit.turnFor(draft, 'p1')
            draft.stockRound.number = 2
        })
        // The first share sold below 40 is free; the second takes the price to 0.
        game.act(
            'SellShares',
            {
                seller: { kind: 'player', playerId: 'p1' },
                sales: [{ companyId: 'NGStL', shares: 3 }],
                expectedProceeds: 9
            },
            'p1'
        )
        const state = game.state
        expect(state.bankruptIds).toEqual(['NGStL'])
        expect(getCompany(state, 'NGStL').started).toBe(false)
        expect(getCompany(state, 'NGStL').operated).toBe(true)
        expect(
            state.certificates
                .filter((c) => c.companyId === 'NGStL' && c.kind === 'share')
                .every((c) => c.poolId === 'initial-offering')
        ).toBe(true)
        expect(state.stations.find((s) => s.id === 'NGStL:home')?.status).toBe('placed')
        // A new stock round begins, the player with the fewest shares holding priority (BK-3, BK-4).
        expect(state.stockRound.number).toBe(3)
        expect(state.machineState).toBe('StockRound')
        expect(playerCash(state, 'p1')).toBeGreaterThan(0)
        expect(Market1860.spaces.find((space) => space.price === 0)).toBeDefined()
    })
})
