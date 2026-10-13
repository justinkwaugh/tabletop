import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, Suit } from '../model/oathEnums.js'
import { testBanners, testPlayer, testState, openTurn } from '../testing/fixture.js'
import { HydratedResolveWake, requiredFavorSteps, type WakeFavorStep } from './resolveWake.js'
import { availablePeoplesFavorOptions } from '../util/wake.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'

/** R-4.1.1.II, R-4.1.1-H1 — a Wake owed by a seized Mob-side banner at its floor stays resolvable. */

describe('R-4.1.1.II — a Mob-side banner at value 1 whose holder has no favor', () => {
    /** Reachable in play: a Mob-side banner at 2 is seized and burnt to 1 by a player with no favor. */
    function seizedBannerBoard() {
        const state = testState(
            [
                testPlayer({ playerId: 'p1', favor: 0 }),
                testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c2' })
            ],
            { banners: testBanners({ [Banner.PeoplesFavor]: 'p1' }, 1) }
        )
        state.banners[Banner.PeoplesFavor].mobSide = true
        openTurn(state, 'p1')
        return state
    }

    function allSubmissions(): WakeFavorStep[][] {
        const stepChoices: WakeFavorStep[] = [
            { kind: 'place' },
            ...Object.values(Suit).map((toSuit) => ({ kind: 'return' as const, toSuit }))
        ]
        const submissions: WakeFavorStep[][] = [[]]
        for (const a of stepChoices) {
            submissions.push([a])
            for (const b of stepChoices) {
                submissions.push([a, b])
            }
        }
        return submissions
    }

    // R-4.1.1-H1 — no return may take the banner below one, and p1 has no favor to place.
    it('the seized-banner board owes zero steps — no option survives the floor', () => {
        const state = seizedBannerBoard()
        expect(availablePeoplesFavorOptions(state, 'p1')).toEqual([])
        expect(requiredFavorSteps(state, 'p1')).toBe(0)
    })

    it('exactly the bare Wake is legal — every favor-step submission is refused', () => {
        const state = seizedBannerBoard()
        for (const favorSteps of allSubmissions()) {
            const reason = HydratedResolveWake.reasonCannotResolveWake(state, 'p1', favorSteps)
            if (favorSteps.length === 0) {
                expect(reason, 'the bare Wake must be legal').toBeUndefined()
            } else {
                expect(reason, JSON.stringify(favorSteps)).toBeDefined()
            }
        }
    })

    it('some legal Wake exists', () => {
        const state = seizedBannerBoard()
        const someLegal = allSubmissions().some(
            (steps) =>
                HydratedResolveWake.reasonCannotResolveWake(state, 'p1', steps) === undefined
        )
        expect(someLegal).toBe(true)
    })
})

// The table checks the Wake before sending it on the holder's own view: the projected state, which holds no
// host-only values and none of another player's hidden ones. Its favor steps are rehearsed there as on the server.
describe("R-4.1.1 — the People's Favor steps are judged on the holder's own view as on the server", () => {
    const DANA = 'dana'
    const game = { ...testGame([DANA, 'rhys']), hotseat: false, protectedInformation: true as const }

    function mobWake(favor: number) {
        const state = testState(
            [
                testPlayer({ playerId: DANA, favor }),
                testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', advisers: [{ cardId: 'denizen.nomad.tents', faceUp: false }] })
            ],
            { machineState: MachineState.WakePhase, banners: testBanners({ [Banner.PeoplesFavor]: DANA }, 2) }
        )
        state.banners[Banner.PeoplesFavor].mobSide = true
        openTurn(state, DANA)
        return state
    }

    it.each([0, 1, 3])('with %i favor, each submission is refused or accepted alike, and the offer is the same', (favor) => {
        const state = mobWake(favor)
        const dana = { kind: 'player', playerId: DANA } as const
        const own = new HydratedOathGameState(served(state, dana))
        const steps: WakeFavorStep[] = [{ kind: 'place' }, { kind: 'return', toSuit: Suit.Hearth }]
        const submissions: WakeFavorStep[][] = [[], ...steps.map((a) => [a]), ...steps.flatMap((a) => steps.map((b) => [a, b]))]
        let accepted = 0
        for (const favorSteps of submissions) {
            const reason = HydratedResolveWake.reasonCannotResolveWake(state, DANA, favorSteps)
            expect(HydratedResolveWake.reasonCannotResolveWake(own, DANA, favorSteps), JSON.stringify(favorSteps)).toEqual(reason)
            if (reason === undefined) accepted += 1
        }
        expect(accepted).toBeGreaterThan(0)
        expect(accepted).toBeLessThan(submissions.length)
        expect(engine.getValidActionTypesForPlayer(game, served(state, dana), DANA, { perspective: dana })).toEqual(
            engine.getValidActionTypesForPlayer(game, state.dehydrate(), DANA)
        )
    })
})
