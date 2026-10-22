import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { card } from '../testing/choices.js'
import { FILLER, TENTS } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { playMapChanges } from '../util/cardPlay.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const HERD = 'denizen.nomad.great-herd'
const ORACLE = 'denizen.nomad.oracle'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'

/**
 * Dana stands at c1 with Great Herd drawn; c1 and c2 are in the Cradle, h1 in the Hinterland, where the Oracle,
 * a Nomad card, stands. `table` holds the rest: who holds the People's Favor, what stands where, c1's site card.
 */
function board(table: Record<string, unknown> = {}, dana: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                supply: 5,
                handIds: [HERD, FILLER],
                ...dana
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c2',
                favor: 4,
                secrets: 2,
                supply: 5
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 12 }
            })
        ],
        {
            oathRevision: OathRevision.EngineFixes8,
            chancellorPlayerId: 'ann',
            denizensBySite: { c1: [], c2: [], p1: [], h1: [ORACLE] },
            warbandsBySite: { c1: { dana: 1 }, c2: { rhys: 2 }, h1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            ...table
        }
    )
    openTurn(s, 'dana')
    return s
}

const favorHeld = {
    banners: {
        [Banner.PeoplesFavor]: { value: 1, holderPlayerId: 'dana' },
        [Banner.DarkestSecret]: { value: 1, holderPlayerId: 'ann' }
    }
}
const cropRotationCarried = {
    pendingSearchModifiers: [
        { cardId: CROP_ROTATION, powerIndex: powerIndexOf(CROP_ROTATION, PowerTiming.Modifier) }
    ]
}

/** Great Herd kept from the Search and played to Dana's site, with `first` discarded before it. */
function herdPlay(first: string, target?: string): SearchResolveChoice {
    return {
        keptCardId: HERD,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        discardFirstCardId: first,
        choices: target ? [card(target)] : []
    }
}

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice) {
    const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'dana', ...choice }))
    a.apply(s)
    return a
}

const peoplesFavorTable = {
    ...favorHeld,
    denizensBySite: { c1: [], c2: [TENTS], p1: [], h1: [ORACLE] }
}

/** Each way a site play discards first: the People's Favor (Tents at c2, in Dana's region), Crop Rotation and the Great Slum (Tents at c1). */
const discardsFirst = [
    { name: "the People's Favor", table: peoplesFavorTable },
    {
        name: 'Crop Rotation',
        table: {
            ...cropRotationCarried,
            denizensBySite: { c1: [TENTS], c2: [], p1: [], h1: [ORACLE] }
        }
    },
    {
        name: 'the Great Slum',
        table: {
            denizensBySite: { c1: [TENTS], c2: [], p1: [], h1: [ORACLE] },
            siteCards: {
                c1: 'site.great-slums',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    }
]

describe('Great Herd cannot name a card the play discards first (R-5.1.4.I, R-11.10)', () => {
    for (const { name, table } of discardsFirst) {
        describe(name, () => {
            it('the discard first alone is accepted, and Great Herd names Tents among its targets on the map before the play', () => {
                const s = board(table)
                expect(
                    HydratedSearchResolve.reasonCannotResolve(s, 'dana', herdPlay(TENTS))
                ).toBeUndefined()
            })

            it('naming Tents, the card it discards first, is refused with a reason', () => {
                const s = board(table)
                expect(
                    HydratedSearchResolve.reasonCannotResolve(s, 'dana', herdPlay(TENTS, TENTS))
                ).toBe(
                    `${TENTS} is discarded before Great Herd is played, so it is no longer at a site`
                )
                expect(() => resolve(s, herdPlay(TENTS, TENTS))).toThrow(
                    /^Cannot resolve search: denizen.nomad.tents is discarded before/
                )
                expect(s.denizensBySite['h1']).toEqual([ORACLE])
            })

            it('naming another Nomad card is accepted: Great Herd and the Oracle trade places', () => {
                const s = board(table)
                expect(
                    HydratedSearchResolve.reasonCannotResolve(s, 'dana', herdPlay(TENTS, ORACLE))
                ).toBeUndefined()
                const a = resolve(s, herdPlay(TENTS, ORACLE))
                expect(s.denizensBySite['c1']).toEqual([ORACLE])
                expect(s.denizensBySite['h1']).toEqual([HERD])
                expect(a.metadata?.discardedCardIds).toContain(TENTS)
                expect(a.metadata?.whenPlayed).toBe(`swapped Great Herd with ${ORACLE}`)
            })
        })
    }

    it('naming Tents with no card discarded first is accepted, as before', () => {
        const s = board(peoplesFavorTable)
        resolve(s, {
            keptCardId: HERD,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            choices: [card(TENTS)]
        })
        expect(s.denizensBySite['c2']).toEqual([HERD])
        expect(s.denizensBySite['c1']).toEqual([TENTS])
    })

    it('a Nomad card at its own site that stays, beside the one discarded first, is still a same-site no-op (revision 10)', () => {
        const s = board({
            ...cropRotationCarried,
            denizensBySite: { c1: [TENTS, ORACLE], c2: [], p1: [], h1: [] }
        })
        resolve(s, herdPlay(TENTS, ORACLE))
        expect(s.denizensBySite['c1']).toEqual([ORACLE, HERD])
    })

    it('played facedown it asks nothing', () => {
        const s = board({
            ...cropRotationCarried,
            denizensBySite: { c1: [TENTS], c2: [], p1: [], h1: [ORACLE] }
        })
        const facedown: SearchResolveChoice = {
            keptCardId: HERD,
            discardOrder: [FILLER],
            play: SearchPlay.Adviser,
            faceUp: false
        }
        expect(
            HydratedSearchResolve.reasonCannotResolve(s, 'dana', {
                ...facedown,
                choices: [card(TENTS)]
            })
        ).toBeDefined()
        resolve(s, facedown)
        expect(s.getPlayerState('dana').hasAdviser(HERD)).toBe(true)
        expect(s.denizensBySite['c1']).toEqual([TENTS])
    })

    describe('a facedown Great Herd turned faceup to a site (R-6.1) is judged the same way', () => {
        const flip = (target: string) =>
            new HydratedPlayFacedownAdviser(
                buildAction(PlayFacedownAdviser, {
                    playerId: 'dana',
                    cardId: HERD,
                    play: SearchPlay.Site,
                    discardFirstCardId: TENTS,
                    choices: [card(target)]
                })
            )
        const flipBoard = () =>
            board(
                { ...favorHeld, denizensBySite: { c1: [], c2: [TENTS], p1: [], h1: [ORACLE] } },
                { handIds: [], advisers: [{ cardId: HERD, faceUp: false }] }
            )

        it('naming the card discarded first is refused', () => {
            const s = flipBoard()
            const a = flip(TENTS)
            expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', a)).toBe(
                `${TENTS} is discarded before Great Herd is played, so it is no longer at a site`
            )
        })

        it('naming another Nomad card is accepted and swaps', () => {
            const s = flipBoard()
            const a = flip(ORACLE)
            expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', a)).toBeUndefined()
            a.apply(s)
            expect(s.denizensBySite['h1']).toEqual([HERD])
            expect(s.denizensBySite['c1']).toEqual([ORACLE])
        })
    })

    it("as Land Warden's second card, after the kept card discards Tents first, it is asked nothing and stays where it was played", () => {
        const LAND_WARDEN = 'denizen.hearth.land-warden'
        const WOLVES = 'denizen.beast.wolves'
        const s = board(
            {
                ...favorHeld,
                pendingSearchModifiers: [
                    {
                        cardId: LAND_WARDEN,
                        powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier)
                    }
                ],
                denizensBySite: { c1: [], c2: [TENTS], p1: [], h1: [ORACLE] }
            },
            { handIds: [WOLVES, HERD, FILLER], advisers: [{ cardId: LAND_WARDEN, faceUp: true }] }
        )
        // The second play carries no choices (docs/known-deviations.md), so the earlier play's leaving card is never named.
        const a = resolve(s, {
            keptCardId: WOLVES,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            discardFirstCardId: TENTS,
            secondPlay: { cardId: HERD, play: SearchPlay.Site }
        })
        expect(s.denizensBySite['c1']).toEqual([WOLVES, HERD])
        expect(s.denizensBySite['c2']).toEqual([])
        expect(a.metadata?.secondWhenPlayed).toBe('kept Great Herd where it was played')
    })

    describe("on Dana's own view, where host-only values cannot be read", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        const ownView = (s: HydratedOathGameState) =>
            OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

        it('the play map changes and the refusal are the same as on the server', () => {
            const s = board(peoplesFavorTable)
            const own = ownView(s)
            const changes = playMapChanges(own, 'dana', HERD, SearchPlay.Site, {
                discardFirstCardId: TENTS
            })
            expect(changes).toMatchObject({ leaving: [TENTS], arriving: [HERD] })
            expect(changes).toEqual(
                playMapChanges(s, 'dana', HERD, SearchPlay.Site, { discardFirstCardId: TENTS })
            )
            const refusal = `${TENTS} is discarded before Great Herd is played, so it is no longer at a site`
            expect(
                HydratedSearchResolve.reasonCannotResolve(s, 'dana', herdPlay(TENTS, TENTS))
            ).toBe(refusal)
            expect(
                HydratedSearchResolve.reasonCannotResolve(own, 'dana', herdPlay(TENTS, TENTS))
            ).toBe(refusal)
            expect(
                HydratedSearchResolve.reasonCannotResolve(own, 'dana', herdPlay(TENTS, ORACLE))
            ).toBeUndefined()
        })
    })
})
