import { describe, expect, it } from 'vitest'
import { Color, assertExists, type Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { adviser } from '../testing/tables.js'
import { ongoingCampaign } from '../testing/required.js'
import { battlePlanUse, boardWarbands, site, siteTarget, siteWarbands } from '../testing/choices.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignDefend, CampaignDefend } from '../actions/campaignDefend.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { legalChoices, type PowerChoice } from '../util/powerChoice.js'
import { cardPowers, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { OathVisibility } from '../definition/runtime.js'
import { served, servedJson } from '../testing/projection.js'
import '../powers/index.js'

const WARNING = 'denizen.nomad.warning-signals'
const MESSENGER = 'denizen.order.messenger'
const CODE_OF_HONOR = 'denizen.order.code-of-honor'
const BEAR_TRAPS = 'denizen.order.bear-traps'
const HOSPITAL = 'denizen.hearth.hospital'
const ANCIENT_BLOODLINE = 'denizen.nomad.ancient-bloodline'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
const SPECIALIST = 'denizen.order.specialist'
const TENTS = 'denizen.nomad.tents'

function perspectiveOf(playerId: string): Visibility.Perspective {
    return { kind: 'player', playerId }
}

/** The player's own view as the table holds it: host-only and others' hidden values cannot be read. */
function ownView(s: HydratedOathGameState, playerId: string): HydratedOathGameState {
    const view = perspectiveOf(playerId)
    return OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
}

function powerOf(cardId: string, timing: PowerTiming) {
    const power = cardPowers(cardId)[powerIndexOf(cardId, timing)]
    assertExists(power, `${cardId} prints a ${timing} power`)
    return power
}

function warbandsOf(s: HydratedOathGameState, playerId: string) {
    return JSON.stringify({
        board: s.getPlayerState(playerId).warbandsOnBoard,
        sites: s.warbandsBySite
    })
}

/** Each seat's served view, so a check that changed anything shows. */
function servedViews(s: HydratedOathGameState, seats: readonly string[]): string[] {
    return seats.map((seat) => servedJson(s, perspectiveOf(seat)))
}

/**
 * Dana campaigns against Bea at c1. Bea rules c1 (2), p1 (3) and h1 (1), holds 2 on their board and
 * Warning Signals faceup, with `advisers` beside it; Dana holds a facedown adviser Bea cannot see.
 */
function defending(
    advisers: string[] = [],
    attackerPlans: string[] = [],
    denizensBySite: Record<string, string[]> = {}
): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 3,
                supply: 6,
                warbandsOnBoard: { dana: 3 },
                advisers: [adviser(TENTS, false), ...attackerPlans.map((cardId) => adviser(cardId))]
            }),
            testPlayer({
                playerId: 'bea',
                color: Color.Blue,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                warbandsOnBoard: { bea: 2 },
                advisers: [adviser(WARNING), ...advisers.map((cardId) => adviser(cardId))]
            })
        ],
        {
            denizensBySite,
            warbandsBySite: { c1: { bea: 2 }, p1: { bea: 3 }, h1: { bea: 1 }, c2: { dana: 2 } }
        }
    )
    openTurn(s, 'dana')
    new HydratedCampaign(
        buildAction(Campaign, {
            playerId: 'dana',
            defender: { kind: 'player', playerId: 'bea' },
            targets: [siteTarget('c1')],
            attackDice: 2,
            plans: attackerPlans.map(battlePlanUse)
        })
    ).apply(s)
    return s
}

function warningPlan(choices: PowerChoice[]) {
    return { ...battlePlanUse(WARNING), choices }
}

const WARNING_MOVES = [siteWarbands('p1', 'bea', 2), boardWarbands('bea', 'bea', 4), site('h1')]

/** Rhys rules c1 (1) and c2 (3, beside Ann's 3) with Messenger at c1; Ann holds a facedown adviser. */
function messengerTable(): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 3,
                warbandsOnBoard: { rhys: 2 },
                warbandsInPersonalBank: { rhys: 5 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                siteId: 'c1',
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { ann: 2 },
                warbandsInPersonalBank: { ann: 5 },
                advisers: [adviser(TENTS, false)]
            })
        ],
        {
            denizensBySite: { c1: [MESSENGER], c2: [], h1: [] },
            warbandsBySite: { c1: { rhys: 1 }, c2: { ann: 3, rhys: 3 } },
            siteCards: { c1: 'site.mine', c2: 'site.river', p1: 'site.plains', h1: 'site.wastes' }
        }
    )
    openTurn(s, 'rhys')
    return s
}

const MESSENGER_MOVES = [
    siteWarbands('c2', 'rhys', 2),
    boardWarbands('rhys', 'rhys', 2),
    site('c1')
]

function messengerUse(s: HydratedOathGameState, choices: PowerChoice[]) {
    return HydratedUseActionPower.reasonCannotUse(
        s,
        'rhys',
        MESSENGER,
        powerIndexOf(MESSENGER, PowerTiming.Action),
        choices
    )
}

describe("Warning Signals checks its moves on the defender's own view as on the server", () => {
    it('ticking the plan with no moves, and declaring it with moves, are allowed on both', () => {
        const s = defending()
        for (const choices of [[], WARNING_MOVES]) {
            expect(
                HydratedCampaignDefend.reasonCannotDefend(s, 'bea', [warningPlan(choices)])
            ).toBeUndefined()
            expect(
                HydratedCampaignDefend.reasonCannotDefend(ownView(s, 'bea'), 'bea', [
                    warningPlan(choices)
                ])
            ).toBeUndefined()
        }
    })

    it('a move the rules refuse is refused with the same reason on both', () => {
        const s = defending()
        const lastWarband = [
            siteWarbands('p1', 'bea', 2),
            site('h1'),
            siteWarbands('h1', 'bea', 3),
            site('c1')
        ]
        const server = HydratedCampaignDefend.reasonCannotDefend(s, 'bea', [
            warningPlan(lastWarband)
        ])
        expect(server).toBe("3 of bea's warbands chosen for warbands to move, but only 2 are there")
        expect(
            HydratedCampaignDefend.reasonCannotDefend(ownView(s, 'bea'), 'bea', [
                warningPlan(lastWarband)
            ])
        ).toBe(server)
    })

    it('the move editor after one move offers the same on both, read on the state that move leaves', () => {
        const s = defending()
        const power = powerOf(WARNING, PowerTiming.BattlePlan)
        const earlier = [siteWarbands('p1', 'bea', 2)]
        const server = legalChoices(s, 'bea', power, earlier).map((c) => c.options)
        expect(server).not.toEqual(legalChoices(s, 'bea', power).map((c) => c.options))
        expect(
            legalChoices(ownView(s, 'bea'), 'bea', power, earlier).map((c) => c.options)
        ).toEqual(server)
    })

    it('the checks change nothing, on the server or the view, and every seat is served as before', () => {
        const s = defending()
        const power = powerOf(WARNING, PowerTiming.BattlePlan)
        const before = servedViews(s, ['dana', 'bea'])
        const view = ownView(s, 'bea')
        const viewBefore = warbandsOf(view, 'bea')
        for (const state of [s, view]) {
            HydratedCampaignDefend.reasonCannotDefend(state, 'bea', [warningPlan(WARNING_MOVES)])
            legalChoices(state, 'bea', power, WARNING_MOVES.slice(0, 2))
        }
        expect(servedViews(s, ['dana', 'bea'])).toEqual(before)
        expect(warbandsOf(view, 'bea')).toBe(viewBefore)
    })
})

describe("Messenger checks its moves on the user's own view as on the server", () => {
    it('the use with moves is allowed on both, and one the rules refuse is refused alike', () => {
        const s = messengerTable()
        expect(messengerUse(s, MESSENGER_MOVES)).toBeUndefined()
        expect(messengerUse(ownView(s, 'rhys'), MESSENGER_MOVES)).toBeUndefined()
        const tooMany = [
            siteWarbands('c2', 'rhys', 2),
            site('c1'),
            siteWarbands('c1', 'rhys', 3),
            site('c2')
        ]
        const server = messengerUse(s, tooMany)
        expect(server).toBe(
            "3 of rhys's warbands chosen for more warbands to move, but only 2 are there"
        )
        expect(messengerUse(ownView(s, 'rhys'), tooMany)).toBe(server)
    })

    it('the move editor after one pick offers the same on both, read on the state that pick leaves', () => {
        const s = messengerTable()
        const power = powerOf(MESSENGER, PowerTiming.Action)
        const earlier = [siteWarbands('c2', 'rhys', 2)]
        const server = legalChoices(s, 'rhys', power, earlier).map((c) => c.options)
        expect(server).not.toEqual(legalChoices(s, 'rhys', power).map((c) => c.options))
        expect(
            legalChoices(ownView(s, 'rhys'), 'rhys', power, earlier).map((c) => c.options)
        ).toEqual(server)
    })

    it('the checks change nothing, on the server or the view, and every seat is served as before', () => {
        const s = messengerTable()
        const power = powerOf(MESSENGER, PowerTiming.Action)
        const before = servedViews(s, ['rhys', 'ann'])
        const view = ownView(s, 'rhys')
        const viewBefore = warbandsOf(view, 'rhys')
        for (const state of [s, view]) {
            messengerUse(state, MESSENGER_MOVES)
            legalChoices(state, 'rhys', power, MESSENGER_MOVES.slice(0, 2))
        }
        expect(servedViews(s, ['rhys', 'ann'])).toEqual(before)
        expect(warbandsOf(view, 'rhys')).toBe(viewBefore)
    })
})

describe("Warning Signals beside other cards reads the same on the defender's own view", () => {
    it('Code of Honor declared with it is refused alike (its own side uses no other plan)', () => {
        const s = defending([CODE_OF_HONOR])
        const plans = [warningPlan(WARNING_MOVES), battlePlanUse(CODE_OF_HONOR)]
        const server = HydratedCampaignDefend.reasonCannotDefend(s, 'bea', plans)
        expect(server).toBe(`${CODE_OF_HONOR}: you cannot use other battle plans with it`)
        expect(HydratedCampaignDefend.reasonCannotDefend(ownView(s, 'bea'), 'bea', plans)).toBe(
            server
        )
    })

    it("the attacker's Specialist closes the defender's plan step alike, before any move is read", () => {
        const s = defending([], [SPECIALIST])
        expect(ongoingCampaign(s).defenderPlansLocked).toBe(true)
        const server = HydratedCampaignDefend.reasonCannotDefend(s, 'bea', [
            warningPlan(WARNING_MOVES)
        ])
        expect(server).toBe('the battle-plan step is not open')
        expect(
            HydratedCampaignDefend.reasonCannotDefend(ownView(s, 'bea'), 'bea', [
                warningPlan(WARNING_MOVES)
            ])
        ).toBe(server)
    })

    it('Ancient Bloodline and Vow of Union held beside it leave the moves allowed alike', () => {
        const s = defending([ANCIENT_BLOODLINE, VOW_OF_UNION])
        expect(
            HydratedCampaignDefend.reasonCannotDefend(s, 'bea', [warningPlan(WARNING_MOVES)])
        ).toBeUndefined()
        expect(
            HydratedCampaignDefend.reasonCannotDefend(ownView(s, 'bea'), 'bea', [
                warningPlan(WARNING_MOVES)
            ])
        ).toBeUndefined()
    })

    it('with Bear Traps the declaration is allowed alike, and the defence makes the moves and Bear Traps kills on the attacker board as it does alone', () => {
        const s = defending([BEAR_TRAPS])
        const plans = [warningPlan(WARNING_MOVES), battlePlanUse(BEAR_TRAPS)]
        expect(HydratedCampaignDefend.reasonCannotDefend(s, 'bea', plans)).toBeUndefined()
        expect(
            HydratedCampaignDefend.reasonCannotDefend(ownView(s, 'bea'), 'bea', plans)
        ).toBeUndefined()
        new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: 'bea', plans })).apply(s)
        expect(s.getPlayerState('bea').warbandsOnBoard).toEqual({ bea: 0 })
        expect(s.warbandsBySite).toMatchObject({ c1: { bea: 2 }, p1: { bea: 1 }, h1: { bea: 5 } })
        const alone = defending([BEAR_TRAPS])
        new HydratedCampaignDefend(
            buildAction(CampaignDefend, { playerId: 'bea', plans: [battlePlanUse(BEAR_TRAPS)] })
        ).apply(alone)
        expect(alone.getPlayerState('dana').warbandsOnBoard).toEqual({ dana: 1 })
        expect(s.getPlayerState('dana').warbandsOnBoard).toEqual(
            alone.getPlayerState('dana').warbandsOnBoard
        )
    })

    it('with Hospital at p1, which the moves leave one warband, the declaration is allowed alike and Hospital still holds kills there', () => {
        const s = defending([], [], { p1: [HOSPITAL] })
        const plans = [
            warningPlan([siteWarbands('p1', 'bea', 2), site('h1')]),
            battlePlanUse(HOSPITAL)
        ]
        expect(HydratedCampaignDefend.reasonCannotDefend(s, 'bea', plans)).toBeUndefined()
        expect(
            HydratedCampaignDefend.reasonCannotDefend(ownView(s, 'bea'), 'bea', plans)
        ).toBeUndefined()
        new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: 'bea', plans })).apply(s)
        expect(s.warbandsBySite).toMatchObject({ p1: { bea: 1 }, h1: { bea: 3 } })
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: 'bea', siteId: 'p1' }])
    })
})
