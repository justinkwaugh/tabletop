import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import {
    HydratedOathGameState,
    OathRevision,
    OathVisibility,
    PowerChoiceKind
} from '@tabletop/oath'
import { openTurn, served, testPlayer, testState, withChancellor } from '@tabletop/oath/testing'
import { listedActionPowers } from './phaseDrafts.js'

// Roving Terror: "Action: Discard a denizen card at any other site and move this card there." From revision 31 a
// salted site can keep a modifier in use beside Salt the Earth, two cards at capacity 1: the move there cannot
// happen, so the card there is not offered.

const SALT = 'denizen.discord.salt-the-earth'
const WELCOMING = 'denizen.hearth.welcoming-party'
const ROVING = 'denizen.beast.roving-terror'
const WOLVES = 'denizen.beast.wolves'

/** Dana at c2 with Roving Terror; c1 salted, holding Salt the Earth and Welcoming Party; `atP1` at p1. */
function table(revision: OathRevision, atP1: string[] = []): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c2', favor: 3, secrets: 2 }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c1', favor: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [SALT, WELCOMING], c2: [ROVING], p1: atP1, h1: [] },
            warbandsBySite: { c1: { rhys: 1 }, c2: { dana: 1 } },
            siteCapacityOverrides: { c1: 1 }
        }
    )
    openTurn(s, 'dana')
    return s
}

/** The targets the listed Roving Terror offers, or undefined when it is not listed. */
function targets(s: HydratedOathGameState): string[] | undefined {
    const use = listedActionPowers(s, 'dana').find((listed) => listed.cardId === ROVING)
    return use?.choices[0].options.flatMap((option) =>
        option.kind === PowerChoiceKind.Card ? [option.cardId] : []
    )
}

describe('Roving Terror leaves out a card at a site with no space for it once that card is gone', () => {
    it('from revision 31, Welcoming Party at the salted site is not offered; the Wolves elsewhere are', () => {
        expect(targets(table(OathRevision.EngineFixes26, [WOLVES]))).toEqual([WOLVES])
    })

    it('from revision 31, with no other target, Roving Terror is not listed', () => {
        expect(targets(table(OathRevision.EngineFixes26))).toBeUndefined()
    })

    it('before revision 31 Welcoming Party is offered, as the game was recorded', () => {
        expect(targets(table(OathRevision.Chronicle, [WOLVES]))).toEqual([WELCOMING, WOLVES])
    })

    it("the same on Dana's own view", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        const own = (s: HydratedOathGameState) =>
            OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)
        for (const s of [
            table(OathRevision.EngineFixes26, [WOLVES]),
            table(OathRevision.EngineFixes26),
            table(OathRevision.Chronicle, [WOLVES])
        ]) {
            expect(targets(own(s))).toEqual(targets(s))
        }
    })
})
