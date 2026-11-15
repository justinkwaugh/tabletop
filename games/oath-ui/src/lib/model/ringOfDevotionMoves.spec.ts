import { describe, expect, it } from 'vitest'
import { Color, assertExists, type Visibility } from '@tabletop/common'
import {
    HydratedOathGameState,
    OathRevision,
    OathVisibility,
    PowerTiming,
    cardPower,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, served, testPlayer, testState } from '@tabletop/oath/testing'
import { listedActionPowers } from './phaseDrafts.js'
import { powerMoves, type MoveFrom } from './powerMoves.js'

// Ring of Devotion: "You cannot place warbands at sites." From revision 31 its holder's Messenger
// offers no site to move warbands to and no warbands on their board (they could only go to a site);
// a move from a site goes to the board.

const RING = 'relic.ring-of-devotion'
const MESSENGER = 'denizen.order.messenger'

/** Rhys at c1 with 3 warbands on their board rules c1 (1) and p1 (`atP1`), holding the Ring and Messenger. */
function table(revision: OathRevision, atP1 = 3): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c2', favor: 3 }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c1',
                favor: 3,
                warbandsOnBoard: { rhys: 3 },
                relicIds: [RING],
                advisers: [{ cardId: MESSENGER, faceUp: true }]
            })
        ],
        {
            oathRevision: revision,
            warbandsBySite: { c1: { rhys: 1 }, p1: { rhys: atP1 }, c2: { dana: 2 } }
        }
    )
    openTurn(s, 'rhys')
    return s
}

const P1: MoveFrom = { at: { kind: 'site', siteId: 'p1' }, owner: 'rhys' }

function messenger() {
    const power = cardPower(MESSENGER, powerIndexOf(MESSENGER, PowerTiming.Action))
    assertExists(power, 'Messenger prints an Action power')
    return power
}

/**
 * The From choices, and where the warbands picked at p1 (or the one From, which the panel picks) may
 * go; undefined when Messenger is not listed.
 */
function offered(s: HydratedOathGameState) {
    if (!listedActionPowers(s, 'rhys').some((listed) => listed.cardId === MESSENGER)) {
        return undefined
    }
    const open = powerMoves(s, 'rhys', messenger(), [{ from: P1 }]).open
    assertExists(open, 'Messenger has a move to pick')
    return {
        from: open.sources.map((group) =>
            group.at.kind === 'board' ? 'board' : `${group.at.siteId}:${group.count}`
        ),
        to: open.destinations.map((to) => (to.kind === 'board' ? 'board' : to.siteId))
    }
}

describe('Messenger’s moves for the Ring of Devotion’s holder', () => {
    it('from revision 31, the warbands at p1 go only to the board, and the board offers none', () => {
        expect(offered(table(OathRevision.EngineFixes26))).toEqual({
            from: ['p1:2'],
            to: ['board']
        })
    })

    it('from revision 31, with nothing to lift, Messenger is not listed', () => {
        expect(offered(table(OathRevision.EngineFixes26, 1))).toBeUndefined()
    })

    it('before revision 31 the board’s warbands and the other site are offered, as the game was recorded', () => {
        expect(offered(table(OathRevision.Chronicle))).toEqual({
            from: ['board', 'p1:2'],
            to: ['board', 'c1']
        })
        // With nothing to lift, the board is the one From, picked for the player, and goes to either site.
        expect(offered(table(OathRevision.Chronicle, 1))).toEqual({
            from: ['board'],
            to: ['c1', 'p1']
        })
    })

    it("the same on Rhys's own view", () => {
        const rhys: Visibility.Perspective = { kind: 'player', playerId: 'rhys' }
        const own = (s: HydratedOathGameState) =>
            OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, rhys)), rhys)
        for (const s of [
            table(OathRevision.EngineFixes26),
            table(OathRevision.EngineFixes26, 1),
            table(OathRevision.Chronicle)
        ]) {
            expect(offered(own(s))).toEqual(offered(s))
        }
    })
})
