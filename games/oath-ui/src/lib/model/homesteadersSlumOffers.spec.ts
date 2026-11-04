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

// The Great Slum lets a card there be discarded before one is moved there; a locked card "cannot be discarded,
// moved, or swapped". From revision 31 Homesteaders' list of cards to discard first leaves out the locked ones.

const HOMESTEADERS = 'denizen.hearth.homesteaders'
const INN = 'denizen.hearth.wayside-inn'
const MARRIAGE = 'denizen.hearth.marriage'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'

/** Dana at c1, a full Great Slum holding Marriage, the Wolves and the Tents, with Homesteaders and the Inn. */
function table(revision: OathRevision): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                advisers: [
                    { cardId: HOMESTEADERS, faceUp: true },
                    { cardId: INN, faceUp: true }
                ]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [MARRIAGE, WOLVES, TENTS], c2: [], p1: [], h1: [] },
            siteCards: {
                c1: 'site.great-slums',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, 'dana')
    return s
}

/** The cards the listed Homesteaders offers to discard first, or undefined when it is not listed. */
function firstOffers(s: HydratedOathGameState): string[] | undefined {
    const use = listedActionPowers(s, 'dana').find((listed) => listed.cardId === HOMESTEADERS)
    return use?.choices[1].options.flatMap((option) =>
        option.kind === PowerChoiceKind.Card ? [option.cardId] : []
    )
}

describe("Homesteaders' cards to discard first at the Great Slum", () => {
    it('from revision 31 Marriage, which is locked, is not listed; the Wolves and Tents are', () => {
        expect(firstOffers(table(OathRevision.EngineFixes26))).toEqual([WOLVES, TENTS])
    })

    it('before revision 31 Marriage is listed, as the game was recorded', () => {
        expect(firstOffers(table(OathRevision.Chronicle))).toEqual([MARRIAGE, WOLVES, TENTS])
    })

    it("the same on Dana's own view", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        const own = (s: HydratedOathGameState) =>
            OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)
        for (const s of [table(OathRevision.EngineFixes26), table(OathRevision.Chronicle)]) {
            expect(firstOffers(own(s))).toEqual(firstOffers(s))
        }
    })
})
