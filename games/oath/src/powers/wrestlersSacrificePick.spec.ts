import { describe, expect, it } from 'vitest'
import { Color, assertExists, type Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { CampaignTargetKind, type CampaignTarget, type WarbandGroup } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS, type WarbandCounts } from '../model/warbandCounts.js'
import { BattlePlanSide, PowerTiming, cardPowers, powerIndexOf } from '../data/cardPowers.js'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import { HydratedCampaignDefend } from '../actions/campaignDefend.js'
import type { BattlePlanUse } from '../model/battlePlanUse.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction, joinDefence } from '../testing/actions.js'
import { battlePlanUse, boardWarbands, site, siteTarget } from '../testing/choices.js'
import { adviser } from '../testing/tables.js'
import { ongoingCampaign } from '../testing/required.js'
import { defend } from '../testing/steps.js'
import { served } from '../testing/projection.js'
import { enemyWarbandsKilledFor } from '../util/campaignRoll.js'
import {
    legalChoices,
    offeredChoices,
    PowerChoiceKind,
    type PowerChoice
} from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Wrestlers: "+1 defense die if you sacrifice one warband in your force." Law 10.22: the player
// chooses the warband. Its Q&A: an Ally's board counts "if their board is adding warbands to your
// force", and a site's last warband may go, since the attacker "already targeted it".

const WRESTLERS = 'denizen.order.wrestlers'
const HOSPITAL = 'denizen.hearth.hospital'
const CAULDRON = 'relic.cursed-cauldron'

const atRevision = OathRevision.EngineFixes18
const before = OathRevision.EngineFixes17

const I = IMPERIAL_WARBANDS
const DANA = 'dana' // an Exile, the attacker
const ANN = 'ann' // the Chancellor
const RHYS = 'rhys' // a Citizen
const PLAINS = 'p1'
const CHANCELLOR_BANK = 10

interface Scene {
    revision: number
    dana?: Partial<OathPlayerState>
    ann?: Partial<OathPlayerState>
    rhys?: Partial<OathPlayerState>
    denizens?: Record<string, string[]>
    warbands?: Record<string, WarbandCounts>
}

/**
 * The scene: Dana, at the Plains (p1), attacks Ann there, where the Empire has two; Ann
 * stands there with three on their board and Wrestlers; Rhys stands there with two on their
 * board.
 */
function table(scene: Scene): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: PLAINS,
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [DANA]: 6 },
                warbandsInPersonalBank: { [DANA]: 4 },
                ...scene.dana
            }),
            testPlayer({
                playerId: ANN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: PLAINS,
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [I]: 3 },
                warbandsInPersonalBank: { [I]: CHANCELLOR_BANK },
                advisers: [adviser(WRESTLERS)],
                ...scene.ann
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: PLAINS,
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [I]: 2 },
                ...scene.rhys
            })
        ],
        {
            oathRevision: scene.revision,
            chancellorPlayerId: ANN,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...scene.denizens },
            warbandsBySite: scene.warbands ?? { [PLAINS]: { [I]: 2 } },
            prng: { seed: 1, invocations: 0 }
        }
    )
    openTurn(s, DANA)
    return s
}

function attack(
    s: HydratedOathGameState,
    defenderId = ANN,
    plans: string[] = [],
    targets: CampaignTarget[] = [siteTarget(PLAINS)]
) {
    new HydratedCampaign(
        buildAction(Campaign, {
            playerId: DANA,
            defender: { kind: 'player', playerId: defenderId },
            targets,
            attackDice: 0,
            plans: plans.map(battlePlanUse)
        })
    ).apply(s)
}

/** Dana attacks Ann; Rhys joins as Ann's Ally. Each answers in turn who has a plan to use. */
function defendedTable(scene: Partial<Scene> = {}, revision = atRevision): HydratedOathGameState {
    const s = table({ revision, ...scene })
    attack(s)
    joinDefence(s, RHYS, ANN)
    expect(ongoingCampaign(s).allyPlayerIds).toEqual([RHYS])
    return s
}

const wrestlersPower = () => {
    const power = cardPowers(WRESTLERS)[powerIndexOf(WRESTLERS, PowerTiming.BattlePlan)]
    assertExists(power, 'Wrestlers prints a battle plan')
    return power
}
const onBoard = (playerId: string, count = 1): WarbandGroup => ({
    at: { kind: 'board', playerId },
    owner: I,
    count
})
const atSite = (siteId: string, count = 1): WarbandGroup => ({
    at: { kind: 'site', siteId },
    owner: I,
    count
})
const pick = (group: WarbandGroup): PowerChoice => ({ kind: PowerChoiceKind.Warbands, group })
const wrestlers = (group?: WarbandGroup): BattlePlanUse => ({
    ...battlePlanUse(WRESTLERS),
    ...(group ? { choices: [pick(group)] } : {})
})

function answer(
    s: HydratedOathGameState,
    playerId: string,
    plans: BattlePlanUse[]
): HydratedCampaignDefend {
    const action = defend(plans, playerId)
    action.apply(s)
    return action
}

const places = (s: HydratedOathGameState, playerId: string) =>
    legalChoices(s, playerId, wrestlersPower()).flatMap((legal) => legal.options)
const board = (s: HydratedOathGameState, playerId: string) =>
    s.getPlayerState(playerId).warbandsOnBoard[I] ?? 0
const atPlains = (s: HydratedOathGameState) => s.warbandsBySite[PLAINS]?.[I] ?? 0
const imperialBank = (s: HydratedOathGameState) =>
    s.getPlayerState(ANN).warbandsInPersonalBank[I] ?? 0
const heldFor = (s: HydratedOathGameState, playerId: string) =>
    (ongoingCampaign(s).heldForHospital ?? [])
        .filter((held) => held.playerId === playerId)
        .reduce((total, held) => total + held.count, 0)
const offered = (s: HydratedOathGameState, playerId: string) =>
    HydratedCampaignDefend.usablePlans(s, playerId).map((power) => power.cardId)

describe('Wrestlers sacrifices the warband its user picks (Law 10.22), from revision 22', () => {
    it("offers one warband at each place in the defending force: the targeted site, the defender's board and an Ally's board in the battle", () => {
        const s = defendedTable()
        expect(offered(s, ANN)).toContain(WRESTLERS)
        expect(places(s, ANN)).toEqual([
            pick(atSite(PLAINS)),
            pick(onBoard(ANN)),
            pick(onBoard(RHYS))
        ])
    })

    it('at the Plains: one of the two there is sacrificed for a defense die, and the History names the place', () => {
        const s = defendedTable()
        const pool = ongoingCampaign(s).defensePool
        const action = answer(s, ANN, [wrestlers(atSite(PLAINS))])
        expect(atPlains(s)).toBe(1)
        expect(board(s, ANN)).toBe(3)
        expect(board(s, RHYS)).toBe(2)
        expect(ongoingCampaign(s).defensePool).toBe(pool + 1)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 1)
        expect(action.metadata?.planNotes).toEqual([`Wrestlers: sacrificed a warband at ${PLAINS}`])
    })

    it("on the user's own board", () => {
        const s = defendedTable()
        const pool = ongoingCampaign(s).defensePool
        const action = answer(s, ANN, [wrestlers(onBoard(ANN))])
        expect(board(s, ANN)).toBe(2)
        expect(atPlains(s)).toBe(2)
        expect(ongoingCampaign(s).defensePool).toBe(pool + 1)
        expect(action.metadata?.planNotes).toEqual([
            `Wrestlers: sacrificed a warband on ${ANN}'s board`
        ])
    })

    it("on an Ally's board that adds to the force (its Q&A)", () => {
        const s = defendedTable()
        const pool = ongoingCampaign(s).defensePool
        const action = answer(s, ANN, [wrestlers(onBoard(RHYS))])
        expect(board(s, RHYS)).toBe(1)
        expect(board(s, ANN)).toBe(3)
        expect(ongoingCampaign(s).defensePool).toBe(pool + 1)
        expect(action.metadata?.planNotes).toEqual([
            `Wrestlers: sacrificed a warband on ${RHYS}'s board`
        ])
    })

    it("an Ally's board not in the battle is refused: Rhys defends, and Ann, their Ally, is away from the Plains", () => {
        const s = table({
            revision: atRevision,
            ann: { siteId: 'h1', advisers: [] },
            rhys: { advisers: [adviser(WRESTLERS)] }
        })
        attack(s, RHYS)
        expect(ongoingCampaign(s).allyPlayerIds).toEqual([ANN])
        expect(places(s, RHYS)).toEqual([pick(atSite(PLAINS)), pick(onBoard(RHYS))])
        expect(
            HydratedCampaignDefend.reasonCannotDefend(s, RHYS, [wrestlers(onBoard(ANN))])
        ).toMatch(/is not among the options for the warband you sacrifice/)
    })

    it("a pick outside the force is refused: a site not targeted, the attacker's board, two warbands", () => {
        const s = defendedTable({ warbands: { [PLAINS]: { [I]: 2 }, c2: { [I]: 2 } } })
        const danaBoard: WarbandGroup = {
            at: { kind: 'board', playerId: DANA },
            owner: DANA,
            count: 1
        }
        for (const group of [atSite('c2'), danaBoard]) {
            expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, [wrestlers(group)])).toMatch(
                /is not among the options for the warband you sacrifice/
            )
        }
        expect(
            HydratedCampaignDefend.reasonCannotDefend(s, ANN, [wrestlers(onBoard(ANN, 2))])
        ).toMatch(/but only 1 are there/)
        expect(() => answer(s, ANN, [wrestlers(onBoard(ANN, 2))])).toThrow(
            /Cannot use battle plans/
        )
        expect(board(s, ANN)).toBe(3)
    })

    it('no pick is refused while the force holds a warband, even at one place', () => {
        const s = defendedTable({ ann: { warbandsOnBoard: {} }, rhys: { warbandsOnBoard: {} } })
        expect(places(s, ANN)).toEqual([pick(atSite(PLAINS))])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, [wrestlers()])).toMatch(
            /no choice was made for the warband you sacrifice/
        )
        expect(
            HydratedCampaignDefend.reasonCannotDefend(s, ANN, [wrestlers(atSite(PLAINS))])
        ).toBeUndefined()
    })

    it('with no warband in the force there is nothing to pick: still offered, used with no pick, and it gains nothing', () => {
        // Dana takes Ann's pawn and favor (R-5.5.2): no site is targeted, and Ann's board is empty.
        const s = table({
            revision: atRevision,
            ann: { warbandsOnBoard: {} },
            rhys: { siteId: 'h1' },
            warbands: {}
        })
        attack(s, ANN, [], [{ kind: CampaignTargetKind.PawnAndFavor }])
        expect(offered(s, ANN)).toContain(WRESTLERS)
        expect(places(s, ANN)).toEqual([])
        const pool = ongoingCampaign(s).defensePool
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, [wrestlers()])).toBeUndefined()
        const action = answer(s, ANN, [wrestlers()])
        expect(ongoingCampaign(s).plansUsed).toEqual([WRESTLERS])
        expect(ongoingCampaign(s).defensePool).toBe(pool)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
        expect(action.metadata?.planNotes).toBeUndefined()
    })

    it('the last warband at a targeted site may go, and the attacker still takes the site (its Q&A)', () => {
        const s = defendedTable({ warbands: { [PLAINS]: { [I]: 1 } } })
        answer(s, ANN, [wrestlers(atSite(PLAINS))])
        expect(atPlains(s)).toBe(0)
        expect(ongoingCampaign(s).targets).toEqual([siteTarget(PLAINS)])
    })

    it("an Ally uses their own Wrestlers on the defending force, the defender's board too", () => {
        const s = defendedTable({ ann: { advisers: [] }, rhys: { advisers: [adviser(WRESTLERS)] } })
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([RHYS])
        expect(places(s, RHYS)).toEqual([
            pick(atSite(PLAINS)),
            pick(onBoard(ANN)),
            pick(onBoard(RHYS))
        ])
        const pool = ongoingCampaign(s).defensePool
        const action = answer(s, RHYS, [wrestlers(onBoard(ANN))])
        expect(board(s, ANN)).toBe(2)
        expect(board(s, RHYS)).toBe(2)
        expect(ongoingCampaign(s).defensePool).toBe(pool + 1)
        expect(action.metadata?.planNotes).toEqual([
            `Wrestlers: sacrificed a warband on ${ANN}'s board`
        ])
    })

    it('a Citizen defender with the Chancellor as an Ally: every place holds one colour, so one option per place', () => {
        const s = table({
            revision: atRevision,
            ann: { advisers: [] },
            rhys: { advisers: [adviser(WRESTLERS)] }
        })
        attack(s, RHYS)
        expect(ongoingCampaign(s).allyPlayerIds).toEqual([ANN])
        const options = places(s, RHYS)
        expect(options).toEqual([pick(atSite(PLAINS)), pick(onBoard(RHYS)), pick(onBoard(ANN))])
        const at = options.map((option) =>
            option.kind === PowerChoiceKind.Warbands ? JSON.stringify(option.group.at) : ''
        )
        expect(new Set(at).size).toBe(options.length)
        expect(
            options.every(
                (option) => option.kind === PowerChoiceKind.Warbands && option.group.owner === I
            )
        ).toBe(true)
    })

    it("the defender's Hospital, at the Plains, holds a sacrifice from their own board; an Ally's board has its own redirect", () => {
        const own = defendedTable({ denizens: { [PLAINS]: [HOSPITAL] } })
        answer(own, ANN, [battlePlanUse(HOSPITAL), wrestlers(onBoard(ANN))])
        expect(board(own, ANN)).toBe(2)
        expect(heldFor(own, ANN)).toBe(1)
        expect(imperialBank(own)).toBe(CHANCELLOR_BANK)

        // Hospital catches its user's warbands alone (R-10.28), so Rhys's is killed.
        const allys = defendedTable({ denizens: { [PLAINS]: [HOSPITAL] } })
        answer(allys, ANN, [battlePlanUse(HOSPITAL), wrestlers(onBoard(RHYS))])
        expect(board(allys, RHYS)).toBe(1)
        expect(heldFor(allys, ANN)).toBe(0)
        expect(imperialBank(allys)).toBe(CHANCELLOR_BANK + 1)

        // Rhys answers after Ann's Hospital: their sacrifice from Ann's board is held for it.
        const later = defendedTable({
            denizens: { [PLAINS]: [HOSPITAL] },
            ann: { advisers: [] },
            rhys: { advisers: [adviser(WRESTLERS)] }
        })
        answer(later, ANN, [battlePlanUse(HOSPITAL)])
        answer(later, RHYS, [wrestlers(onBoard(ANN))])
        expect(board(later, ANN)).toBe(2)
        expect(heldFor(later, ANN)).toBe(1)
        expect(imperialBank(later)).toBe(CHANCELLOR_BANK)
    })

    it("a picked sacrifice counts for the attacker's Cursed Cauldron", () => {
        const s = table({
            revision: atRevision,
            dana: { relicIds: [CAULDRON] },
            rhys: { siteId: 'h1' }
        })
        attack(s, ANN, [CAULDRON])
        answer(s, ANN, [wrestlers(onBoard(ANN))])
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(1)
    })

    it('the bandits have no user, so their Wrestlers sacrifices nothing', () => {
        const s = table({
            revision: atRevision,
            dana: { siteId: 'c2' },
            ann: { advisers: [] },
            denizens: { c2: [WRESTLERS] },
            warbands: {}
        })
        const control = table({
            revision: atRevision,
            dana: { siteId: 'c2' },
            ann: { advisers: [] },
            warbands: {}
        })
        for (const t of [s, control]) {
            new HydratedCampaign(
                buildAction(Campaign, {
                    playerId: DANA,
                    defender: { kind: 'bandits' },
                    targets: [siteTarget('c2')],
                    attackDice: 0,
                    plans: []
                })
            ).apply(t)
        }
        expect(s.campaign?.plansUsed ?? []).toContain(WRESTLERS)
        expect(s.campaign?.defensePool).toBe(control.campaign?.defensePool)
    })

    it("the domain reads only what the defending player's own view holds, and copies nothing", () => {
        const s = defendedTable()
        const server = JSON.stringify(s.dehydrate())
        const ann: Visibility.Perspective = { kind: 'player', playerId: ANN }
        const view = OathVisibility.state.guardForExecution(
            new HydratedOathGameState(served(s, ann)),
            ann
        )
        expect(places(view, ANN)).toEqual(places(s, ANN))
        expect(offeredChoices(view, ANN, wrestlersPower())[0]?.options).toEqual(places(s, ANN))
        expect(
            HydratedCampaignDefend.reasonCannotDefend(view, ANN, [wrestlers(onBoard(RHYS))])
        ).toBeUndefined()
        expect(HydratedCampaignDefend.reasonCannotDefend(view, ANN, [wrestlers()])).toMatch(
            /no choice was made/
        )
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })
})

describe("Wrestlers with Warning Signals, the same player's plans", () => {
    const WARNING = 'denizen.nomad.warning-signals'
    // Ann rules c2 too, away from the battle, and moves their whole board there.
    const scene = () =>
        defendedTable({
            ann: { advisers: [adviser(WRESTLERS), adviser(WARNING)] },
            warbands: { [PLAINS]: { [I]: 2 }, c2: { [I]: 1 } }
        })
    const boardAway: BattlePlanUse = {
        ...battlePlanUse(WARNING),
        choices: [boardWarbands(ANN, I, 3), site('c2')]
    }

    it('moved away first, the picked board holds no warband: nothing is sacrificed and no die gained', () => {
        const s = scene()
        const pool = ongoingCampaign(s).defensePool
        const action = answer(s, ANN, [boardAway, wrestlers(onBoard(ANN))])
        expect(board(s, ANN)).toBe(0)
        expect(s.warbandsBySite['c2']?.[I]).toBe(4)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
        expect(ongoingCampaign(s).defensePool).toBe(pool)
        expect(action.metadata?.planNotes?.some((note) => note.startsWith('Wrestlers'))).toBe(false)
    })

    it('a place the moves leave alone is sacrificed from as picked', () => {
        const s = scene()
        const pool = ongoingCampaign(s).defensePool
        answer(s, ANN, [boardAway, wrestlers(atSite(PLAINS))])
        expect(atPlains(s)).toBe(1)
        expect(board(s, ANN)).toBe(0)
        expect(ongoingCampaign(s).defensePool).toBe(pool + 1)
    })
})

describe('R-X.4 — before revision 22 the engine picks, as recorded', () => {
    it("the user's own board first, never an Ally's, and no pick is asked or accepted", () => {
        const s = defendedTable({}, before)
        expect(legalChoices(s, ANN, wrestlersPower())).toEqual([])
        expect(
            HydratedCampaignDefend.reasonCannotDefend(s, ANN, [wrestlers(onBoard(RHYS))])
        ).toMatch(/takes no choices/)
        const pool = ongoingCampaign(s).defensePool
        const action = answer(s, ANN, [wrestlers()])
        expect(board(s, ANN)).toBe(2)
        expect(board(s, RHYS)).toBe(2)
        expect(atPlains(s)).toBe(2)
        expect(ongoingCampaign(s).defensePool).toBe(pool + 1)
        expect(action.metadata?.planNotes).toBeUndefined()
    })

    it("with no warband on the user's board, the first targeted site", () => {
        const s = defendedTable({ ann: { warbandsOnBoard: {} } }, before)
        answer(s, ANN, [wrestlers()])
        expect(atPlains(s)).toBe(1)
        expect(board(s, RHYS)).toBe(2)
    })
})
