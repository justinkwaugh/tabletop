import { describe, expect, it } from 'vitest'
import { Color, assertExists, type Visibility } from '@tabletop/common'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { WarbandMoveKind } from '../model/warbandMove.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { served } from '../testing/projection.js'
import {
    actionPowerUse,
    boardWarbands,
    site,
    siteTarget,
    siteWarbands
} from '../testing/choices.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignDefend, CampaignDefend } from '../actions/campaignDefend.js'
import { HydratedMoveWarbands } from '../actions/moveWarbands.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { legalChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { cardPowers, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { OathVisibility } from '../definition/runtime.js'
import { OathRevision } from '../util/revision.js'
import { applyMessengerMoves } from './actionCards.js'
import { applyWarningSignals } from './searchPlacementPowers.js'
import { warbandMovesOverlay } from './vocabulary.js'
import '../powers/index.js'

// Ring of Devotion: "You cannot place warbands at sites." Its Q&A applies it to every case, and a
// warband reaching a site is placed there, so from revision 31 Messenger's and Warning Signals' moves
// to a site (from the board or from another site) are refused for its holder and not offered. A move
// from a site to the board places nothing and stays allowed.

const RING = 'relic.ring-of-devotion'
const BANDIT_CROWN = 'relic.bandit-crown'
const MESSENGER = 'denizen.order.messenger'
const WARNING = 'denizen.nomad.warning-signals'
const RING_REASON = 'you cannot place warbands at sites (Ring of Devotion)'
/** A pick the power does not offer is refused before its moves are read. */
const NOT_OFFERED = /is not among the options/
const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

function powerOf(cardId: string, timing: PowerTiming) {
    const power = cardPowers(cardId)[powerIndexOf(cardId, timing)]
    assertExists(power, `${cardId} prints a ${timing} power`)
    return power
}

/** The player's own view as the table holds it: host-only and others' hidden values cannot be read. */
function ownView(s: HydratedOathGameState, playerId: string): HydratedOathGameState {
    const view: Visibility.Perspective = { kind: 'player', playerId }
    return OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
}

/**
 * Rhys stands at c1 with 3 warbands on their board, and rules c1 (1) and p1 (3) with Messenger and
 * Warning Signals faceup, holding `relics` (the Ring unless told otherwise). Dana is at c1 and rules c2.
 */
function table(revision: OathRevision, relics: string[] = [RING]): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 3,
                supply: 6,
                warbandsOnBoard: { dana: 3 }
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                warbandsOnBoard: { rhys: 3 },
                relicIds: relics,
                advisers: [
                    { cardId: MESSENGER, faceUp: true },
                    { cardId: WARNING, faceUp: true }
                ]
            })
        ],
        {
            oathRevision: revision,
            warbandsBySite: { c1: { rhys: 1 }, p1: { rhys: 3 }, c2: { dana: 2 } }
        }
    )
    openTurn(s, 'rhys')
    return s
}

function where(s: HydratedOathGameState, playerId: string) {
    return {
        board: s.getPlayerState(playerId).warbandsOnBoard,
        c1: s.warbandsBySite['c1'] ?? {},
        p1: s.warbandsBySite['p1'] ?? {}
    }
}

function messengerVerdict(s: HydratedOathGameState, choices: PowerChoice[]): string | undefined {
    return HydratedUseActionPower.reasonCannotUse(
        s,
        'rhys',
        MESSENGER,
        powerIndexOf(MESSENGER, PowerTiming.Action),
        choices
    )
}

/** The power's own check of the moves, as its use runs it: on an overlay of the warbands. */
function messengerRule(s: HydratedOathGameState, choices: PowerChoice[]): string | undefined {
    return applyMessengerMoves(warbandMovesOverlay(s, 'rhys'), 'rhys', choices).reason
}

/** What the move editor offers before any pick: the warbands to move, and the sites to move them to. */
function offered(s: HydratedOathGameState, cardId: string, timing: PowerTiming) {
    const [warbands, sites] = legalChoices(s, 'rhys', powerOf(cardId, timing))
    assertExists(warbands, `${cardId} asks for warbands first`)
    assertExists(sites, `${cardId} asks for a site after them`)
    return {
        from: warbands.options.flatMap((o) =>
            o.kind === PowerChoiceKind.Warbands
                ? [`${o.group.at.kind === 'board' ? 'board' : o.group.at.siteId}:${o.group.count}`]
                : []
        ),
        to: sites.options.flatMap((o) => (o.kind === PowerChoiceKind.Site ? [o.siteId] : []))
    }
}

const BOARD_TO_P1 = [boardWarbands('rhys', 'rhys', 2), site('p1')]
const P1_TO_C1 = [siteWarbands('p1', 'rhys', 2), site('c1')]
const P1_TO_BOARD = [siteWarbands('p1', 'rhys', 2)]

describe('Ring of Devotion bars Messenger’s moves to a site from revision 31', () => {
    it('from revision 31, a move from the board to a site is refused, and nothing moves', () => {
        const s = table(FIXED)
        const before = JSON.stringify(where(s, 'rhys'))
        expect(messengerVerdict(s, BOARD_TO_P1)).toMatch(NOT_OFFERED)
        expect(messengerRule(s, BOARD_TO_P1)).toBe(RING_REASON)
        expect(JSON.stringify(where(s, 'rhys'))).toBe(before)
    })

    it('from revision 31, a move from one site to another is refused before the warbands leave', () => {
        const s = table(FIXED)
        const before = JSON.stringify(where(s, 'rhys'))
        expect(messengerVerdict(s, P1_TO_C1)).toMatch(NOT_OFFERED)
        expect(messengerRule(s, P1_TO_C1)).toBe(RING_REASON)
        // A lift first, then a move to a site from the board it filled: that move is refused too.
        const liftThenPlace = [...P1_TO_BOARD, boardWarbands('rhys', 'rhys', 1), site('c1')]
        expect(messengerVerdict(s, liftThenPlace)).toMatch(NOT_OFFERED)
        expect(messengerRule(s, liftThenPlace)).toBe(RING_REASON)
        expect(JSON.stringify(where(s, 'rhys'))).toBe(before)
    })

    it('from revision 31, the editor offers no site to move to and no warbands on the board', () => {
        expect(offered(table(FIXED), MESSENGER, PowerTiming.Action)).toEqual({
            from: ['p1:2'],
            to: []
        })
    })

    it('from revision 31, a lift from a site to the board is accepted and made', () => {
        const s = table(FIXED)
        expect(messengerVerdict(s, P1_TO_BOARD)).toBeUndefined()
        actionPowerUse('rhys', MESSENGER, P1_TO_BOARD).apply(s)
        expect(where(s, 'rhys')).toEqual({ board: { rhys: 5 }, c1: { rhys: 1 }, p1: { rhys: 1 } })
    })

    it('before revision 31 both moves to a site are accepted and made, as the game was recorded', () => {
        const s = table(BEFORE)
        expect(messengerVerdict(s, BOARD_TO_P1)).toBeUndefined()
        expect(messengerVerdict(s, P1_TO_C1)).toBeUndefined()
        actionPowerUse('rhys', MESSENGER, [...BOARD_TO_P1, ...P1_TO_C1]).apply(s)
        expect(where(s, 'rhys')).toEqual({ board: { rhys: 1 }, c1: { rhys: 3 }, p1: { rhys: 3 } })
    })

    it('before revision 31 the editor offers the board’s warbands and both ruled sites', () => {
        expect(offered(table(BEFORE), MESSENGER, PowerTiming.Action)).toEqual({
            from: ['board:3', 'p1:2'],
            to: ['c1', 'p1']
        })
    })

    it('a player without the Ring moves to sites as before, from revision 31', () => {
        const s = table(FIXED, [])
        expect(messengerVerdict(s, BOARD_TO_P1)).toBeUndefined()
        expect(messengerVerdict(s, P1_TO_C1)).toBeUndefined()
        expect(offered(s, MESSENGER, PowerTiming.Action)).toEqual({
            from: ['board:3', 'p1:2'],
            to: ['c1', 'p1']
        })
    })

    it('a Citizen holding the Ring cannot move the Empire’s warbands to a site either', () => {
        const citizen = (revision: OathRevision) => {
            const s = testState(
                [
                    testPlayer({
                        playerId: 'dana',
                        color: Color.Purple,
                        status: PlayerStatus.Chancellor,
                        siteId: 'h1'
                    }),
                    testPlayer({
                        playerId: 'rhys',
                        color: Color.Blue,
                        status: PlayerStatus.Citizen,
                        siteId: 'c1',
                        favor: 3,
                        warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                        relicIds: [RING],
                        advisers: [{ cardId: MESSENGER, faceUp: true }]
                    })
                ],
                {
                    oathRevision: revision,
                    warbandsBySite: {
                        c1: { [IMPERIAL_WARBANDS]: 1 },
                        p1: { [IMPERIAL_WARBANDS]: 3 },
                        h1: { [IMPERIAL_WARBANDS]: 2 }
                    }
                }
            )
            openTurn(s, 'rhys')
            return s
        }
        const imperialToP1 = [boardWarbands('rhys', IMPERIAL_WARBANDS, 2), site('p1')]
        expect(messengerVerdict(citizen(FIXED), imperialToP1)).toMatch(NOT_OFFERED)
        expect(messengerRule(citizen(FIXED), imperialToP1)).toBe(RING_REASON)
        expect(messengerVerdict(citizen(BEFORE), imperialToP1)).toBeUndefined()
        expect(
            messengerVerdict(citizen(FIXED), [siteWarbands('p1', IMPERIAL_WARBANDS, 2)])
        ).toBeUndefined()
    })

    it('with the Bandit Crown beside the Ring, the last warband may be lifted and no empty site is offered', () => {
        const s = table(FIXED, [RING, BANDIT_CROWN])
        const lastToo = [siteWarbands('p1', 'rhys', 3)]
        expect(messengerVerdict(s, lastToo)).toBeUndefined()
        const toEmptySite = [boardWarbands('rhys', 'rhys', 1), site('h1')]
        expect(messengerVerdict(s, toEmptySite)).toMatch(NOT_OFFERED)
        expect(messengerRule(s, toEmptySite)).toBe(RING_REASON)
        expect(offered(s, MESSENGER, PowerTiming.Action)).toEqual({
            from: ['c1:1', 'p1:3'],
            to: []
        })
        // Before revision 31 the Crown's empty sites are offered too.
        expect(
            offered(table(BEFORE, [RING, BANDIT_CROWN]), MESSENGER, PowerTiming.Action).to
        ).toContain('h1')
    })

    it('the R-6.5 minor action refuses a move to a site at both revisions, as before', () => {
        for (const revision of [FIXED, BEFORE]) {
            expect(
                HydratedMoveWarbands.reasonCannotMove(table(revision), 'rhys', {
                    move: { kind: WarbandMoveKind.BoardToSite },
                    owner: 'rhys',
                    count: 1
                })
            ).toBe(RING_REASON)
        }
    })

    it("reads the same on Rhys's own view, and the checks change nothing there", () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = table(revision)
            const view = ownView(s, 'rhys')
            const viewBefore = JSON.stringify(where(view, 'rhys'))
            for (const choices of [BOARD_TO_P1, P1_TO_C1, P1_TO_BOARD]) {
                expect(messengerVerdict(view, choices)).toBe(messengerVerdict(s, choices))
                expect(messengerRule(view, choices)).toBe(messengerRule(s, choices))
            }
            expect(offered(view, MESSENGER, PowerTiming.Action)).toEqual(
                offered(s, MESSENGER, PowerTiming.Action)
            )
            expect(JSON.stringify(where(view, 'rhys'))).toBe(viewBefore)
        }
    })
})

/** Dana campaigns against Rhys at c1, so Rhys defends with Warning Signals. */
function defending(revision: OathRevision, relics: string[] = [RING]): HydratedOathGameState {
    const s = table(revision, relics)
    openTurn(s, 'dana')
    new HydratedCampaign(
        buildAction(Campaign, {
            playerId: 'dana',
            defender: { kind: 'player', playerId: 'rhys' },
            targets: [siteTarget('c1')],
            attackDice: 2
        })
    ).apply(s)
    return s
}

function warningPlan(choices: PowerChoice[]) {
    return { cardId: WARNING, powerIndex: powerIndexOf(WARNING, PowerTiming.BattlePlan), choices }
}

function warningVerdict(s: HydratedOathGameState, choices: PowerChoice[]): string | undefined {
    return HydratedCampaignDefend.reasonCannotDefend(s, 'rhys', [warningPlan(choices)])
}

function defend(s: HydratedOathGameState, choices: PowerChoice[]): void {
    new HydratedCampaignDefend(
        buildAction(CampaignDefend, { playerId: 'rhys', plans: [warningPlan(choices)] })
    ).apply(s)
}

/** The plan's own check of the moves (checked), or the moves its use makes (unchecked), on an overlay. */
function warningRule(s: HydratedOathGameState, choices: PowerChoice[], checked: boolean) {
    return applyWarningSignals(warbandMovesOverlay(s, 'rhys'), 'rhys', choices, checked)
}

const BOARD_TO_C1 = [boardWarbands('rhys', 'rhys', 2), site('c1')]

describe('Ring of Devotion bars Warning Signals’ moves to a site from revision 31', () => {
    it('from revision 31, a move into the targeted site from another site is refused', () => {
        const s = defending(FIXED)
        expect(warningVerdict(s, P1_TO_C1)).toMatch(NOT_OFFERED)
        expect(warningRule(s, P1_TO_C1, true).reason).toBe(RING_REASON)
        // The use itself makes no move to a site either.
        expect(warningRule(s, P1_TO_C1, false)).toEqual({ notes: [] })
    })

    it('from revision 31, a move into the targeted site from the board is refused', () => {
        const s = defending(FIXED)
        expect(warningVerdict(s, BOARD_TO_C1)).toMatch(NOT_OFFERED)
        expect(warningRule(s, BOARD_TO_C1, true).reason).toBe(RING_REASON)
        expect(warningRule(s, BOARD_TO_C1, false)).toEqual({ notes: [] })
        // Chained: a lift to the board, then those warbands on to c1. The lift is made; the move is not.
        const liftThenPlace = [...P1_TO_BOARD, boardWarbands('rhys', 'rhys', 2), site('c1')]
        expect(warningVerdict(s, liftThenPlace)).toMatch(NOT_OFFERED)
        expect(warningRule(s, liftThenPlace, true).reason).toBe(RING_REASON)
        expect(warningRule(s, liftThenPlace, false)).toEqual({
            notes: ['2 from p1 to the board']
        })
    })

    it('from revision 31, the editor offers no site and no warbands on the board', () => {
        expect(offered(defending(FIXED), WARNING, PowerTiming.BattlePlan)).toEqual({
            from: ['p1:2'],
            to: []
        })
    })

    it('from revision 31, a lift to the board is made, and the plan is still discarded at the end', () => {
        const s = defending(FIXED)
        expect(warningVerdict(s, P1_TO_BOARD)).toBeUndefined()
        defend(s, P1_TO_BOARD)
        expect(where(s, 'rhys')).toEqual({ board: { rhys: 5 }, c1: { rhys: 1 }, p1: { rhys: 1 } })
        expect(s.campaign?.discardAtEnd).toContain(WARNING)
    })

    it('from revision 31, the plan used with no moves is still accepted', () => {
        const s = defending(FIXED)
        expect(warningVerdict(s, [])).toBeUndefined()
        defend(s, [])
        expect(s.campaign?.discardAtEnd).toContain(WARNING)
    })

    it('before revision 31 the move into the targeted site is accepted and made, as the game was recorded', () => {
        const s = defending(BEFORE)
        expect(warningVerdict(s, BOARD_TO_C1)).toBeUndefined()
        expect(warningVerdict(s, P1_TO_C1)).toBeUndefined()
        expect(warningRule(s, P1_TO_C1, false)).toEqual({ notes: ['2 from p1 to c1'] })
        expect(offered(s, WARNING, PowerTiming.BattlePlan)).toEqual({
            from: ['board:3', 'p1:2'],
            to: ['c1', 'p1']
        })
        defend(s, P1_TO_C1)
        expect(where(s, 'rhys')).toEqual({ board: { rhys: 3 }, c1: { rhys: 3 }, p1: { rhys: 1 } })
    })

    it('a defender without the Ring moves into the targeted site as before, from revision 31', () => {
        const s = defending(FIXED, [])
        expect(warningVerdict(s, P1_TO_C1)).toBeUndefined()
        expect(warningVerdict(s, BOARD_TO_C1)).toBeUndefined()
        defend(s, P1_TO_C1)
        expect(where(s, 'rhys')).toEqual({ board: { rhys: 3 }, c1: { rhys: 3 }, p1: { rhys: 1 } })
    })

    it("reads the same on Rhys's own view, and the checks change nothing there", () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = defending(revision)
            const view = ownView(s, 'rhys')
            const viewBefore = JSON.stringify(where(view, 'rhys'))
            for (const choices of [BOARD_TO_C1, P1_TO_C1, P1_TO_BOARD, []]) {
                expect(warningVerdict(view, choices)).toBe(warningVerdict(s, choices))
                expect(warningRule(view, choices, true)).toEqual(warningRule(s, choices, true))
            }
            expect(offered(view, WARNING, PowerTiming.BattlePlan)).toEqual(
                offered(s, WARNING, PowerTiming.BattlePlan)
            )
            expect(JSON.stringify(where(view, 'rhys'))).toBe(viewBefore)
        }
    })
})
