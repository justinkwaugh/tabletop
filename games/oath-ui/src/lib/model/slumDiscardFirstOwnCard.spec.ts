import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import {
    HydratedOathGameState,
    HydratedUseActionPower,
    OathRevision,
    OathVisibility,
    PowerChoiceKind,
    type PowerChoice
} from '@tabletop/oath'
import { openTurn, served, testPlayer, testState, withChancellor } from '@tabletop/oath/testing'
import { listedActionPowers } from './phaseDrafts.js'

// The Great Slum lets a card there be discarded before one is moved there; the card whose power moves a card there
// is never the one discarded first. From revision 33 Homesteaders' and Resettle's lists of cards to discard first, used
// at the Great Slum, leave out the card itself; before revision 33 they list it, as the game was recorded.

const HOMESTEADERS = 'denizen.hearth.homesteaders'
const RESETTLE = 'denizen.nomad.resettle'
const INN = 'denizen.hearth.wayside-inn'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const SCOUTS = 'denizen.order.scouts'
const DANA = 'dana'

/** Dana at c1, a full Great Slum Dana rules holding `atC1`, with `advisers` faceup. */
function table(revision: OathRevision, atC1: string[], advisers: string[]): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: atC1, c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [DANA]: 1 } },
            siteCards: {
                c1: 'site.great-slums',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, DANA)
    return s
}

const homesteaders = (revision: OathRevision) =>
    table(revision, [HOMESTEADERS, WOLVES, TENTS], [INN])
const resettle = (revision: OathRevision) => table(revision, [RESETTLE, WOLVES, SCOUTS], [TENTS])

/** The cards the listed power offers to discard first (its last choice), or undefined when it is not listed. */
function firstOffers(s: HydratedOathGameState, cardId: string): string[] | undefined {
    const use = listedActionPowers(s, DANA).find((listed) => listed.cardId === cardId)
    return use?.choices[use.choices.length - 1].options.flatMap((option) =>
        option.kind === PowerChoiceKind.Card ? [option.cardId] : []
    )
}

/** The engine's answer to the use with `first` named first, as the UI would send it. */
function reasonFor(s: HydratedOathGameState, cardId: string, first: string): string | undefined {
    const use = listedActionPowers(s, DANA).find((listed) => listed.cardId === cardId)
    if (!use) throw Error(`${cardId} is not listed`)
    const move: PowerChoice[] =
        cardId === HOMESTEADERS
            ? [{ kind: PowerChoiceKind.Card, cardId: INN }]
            : [
                  { kind: PowerChoiceKind.Card, cardId: TENTS },
                  { kind: PowerChoiceKind.Site, siteId: 'c1' }
              ]
    return HydratedUseActionPower.reasonCannotUse(s, DANA, cardId, use.powerIndex, [
        ...move,
        { kind: PowerChoiceKind.Card, cardId: first }
    ])
}

describe('Homesteaders and Resettle at the Great Slum: their own card is not listed to discard first', () => {
    it('from revision 33 Homesteaders lists the Wolves and Tents, not itself', () => {
        expect(firstOffers(homesteaders(OathRevision.EngineFixes28), HOMESTEADERS)).toEqual([
            WOLVES,
            TENTS
        ])
    })

    it('from revision 33 Resettle lists the Wolves and Scouts, not itself', () => {
        expect(firstOffers(resettle(OathRevision.EngineFixes28), RESETTLE)).toEqual([
            WOLVES,
            SCOUTS
        ])
    })

    it('each listed card is accepted by the engine, at revision 33', () => {
        for (const [s, cardId] of [
            [homesteaders(OathRevision.EngineFixes28), HOMESTEADERS],
            [resettle(OathRevision.EngineFixes28), RESETTLE]
        ] as const) {
            for (const first of firstOffers(s, cardId) ?? [])
                expect(reasonFor(s, cardId, first)).toBeUndefined()
        }
    })

    it('before revision 33 each lists itself too, as the game was recorded', () => {
        expect(firstOffers(homesteaders(OathRevision.EngineFixes27), HOMESTEADERS)).toEqual([
            HOMESTEADERS,
            WOLVES,
            TENTS
        ])
        expect(firstOffers(resettle(OathRevision.EngineFixes27), RESETTLE)).toEqual([
            RESETTLE,
            WOLVES,
            SCOUTS
        ])
    })

    it("the same on Dana's own view", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
        const own = (s: HydratedOathGameState) =>
            OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)
        for (const revision of [OathRevision.EngineFixes28, OathRevision.EngineFixes27]) {
            for (const [s, cardId] of [
                [homesteaders(revision), HOMESTEADERS],
                [resettle(revision), RESETTLE]
            ] as const) {
                expect(firstOffers(own(s), cardId)).toEqual(firstOffers(s, cardId))
            }
        }
    })
})
