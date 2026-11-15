import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ActionType,
    IMPERIAL_WARBANDS,
    OathRevision,
    PowerChoiceKind,
    PowerTiming,
    cardPowers,
    type BattlePlanUse,
    type PowerChoice,
    type WarbandLocation
} from '@tabletop/oath'
import { required } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import {
    PLAINS,
    WRESTLERS,
    wrestlersDefends,
    type WrestlersScene
} from '$lib/testing/wrestlersTable.js'
import { describeAction } from './actionDescription.js'
import { pickerWords } from './powerPickerWords.js'
import { emptyPicks, withOptionPick } from './powerChoices.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const POWER = required(
    cardPowers(WRESTLERS).find((power) => power.timing === PowerTiming.BattlePlan),
    'Wrestlers’ battle plan'
)
const PLAN = { cardId: WRESTLERS, powerIndex: POWER.powerIndex }
const place = (at: WarbandLocation): PowerChoice => ({
    kind: PowerChoiceKind.Warbands,
    group: { at, owner: IMPERIAL_WARBANDS, count: 1 }
})
const SITE: WarbandLocation = { kind: 'site', siteId: PLAINS }
const ANN_BOARD: WarbandLocation = { kind: 'board', playerId: 'Ann' }
const RHYS_BOARD: WarbandLocation = { kind: 'board', playerId: 'Rhys' }

async function defending(scene: WrestlersScene = {}) {
    const session = await openSessionOn(wrestlersDefends(scene))
    expect(session.myPlayer?.id).toBe('Ann')
    const sent = vi.spyOn(session, 'defendCampaign').mockResolvedValue()
    const defence = session.defence
    expect(defence.usable.map((power) => power.cardId)).toEqual([WRESTLERS])
    return { session, defence, sent }
}

describe('R-10.22 — Wrestlers asks the warband its user sacrifices, from revision 22', () => {
    it("turning it on asks for one place of the force, none picked: the Plains, Ann's board and Rhys's", async () => {
        const { defence } = await defending()
        expect(defence.planChoicesOf(POWER)).toEqual([])
        defence.setPlan(POWER, true)
        const [legal, ...rest] = defence.planChoicesOf(POWER)
        expect(rest).toEqual([])
        expect(legal?.spec.byPlace).toBe(true)
        expect(legal?.options).toEqual([place(SITE), place(ANN_BOARD), place(RHYS_BOARD)])
        expect(defence.plansComplete).toBe(false)
        expect(pickerWords(WRESTLERS).place).toBe('the warband you sacrifice:')
    })

    it('"Use plans" waits for the pick; one tap picks a place, another tap moves it, and the pick is sent', async () => {
        const { defence, sent } = await defending()
        defence.setPlan(POWER, true)
        const [legal] = defence.planChoicesOf(POWER)
        if (!legal) throw Error('Wrestlers asks a place')
        defence.setPlanPicks(PLAN, withOptionPick(emptyPicks(), legal, 0, 1))
        expect(defence.plansComplete).toBe(true)
        expect(defence.usePlansRefusedBecause).toBeUndefined()
        defence.setPlanPicks(PLAN, withOptionPick(defence.planPicksOf(PLAN), legal, 0, 2))
        await defence.answer(true)
        const plans: BattlePlanUse[] = [{ ...PLAN, choices: [place(RHYS_BOARD)] }]
        expect(sent).toHaveBeenLastCalledWith(plans)
    })

    it('a single place is picked already', async () => {
        const { defence, sent } = await defending({ annBoard: 0, rhysBoard: 0 })
        defence.setPlan(POWER, true)
        expect(defence.planChoicesOf(POWER)[0]?.options).toEqual([place(SITE)])
        expect(defence.plansComplete).toBe(true)
        await defence.answer(true)
        expect(sent).toHaveBeenLastCalledWith([{ ...PLAN, choices: [place(SITE)] }])
    })

    it('with no warband in the force there is nothing to ask: the plan is used with no pick', async () => {
        const { defence, sent } = await defending({
            pawnTarget: true,
            atPlains: 0,
            annBoard: 0,
            rhysBoard: 0
        })
        defence.setPlan(POWER, true)
        expect(defence.planChoicesOf(POWER)).toEqual([])
        expect(defence.plansComplete).toBe(true)
        expect(defence.usePlansRefusedBecause).toBeUndefined()
        await defence.answer(true)
        expect(sent).toHaveBeenLastCalledWith([PLAN])
    })

    it('Undo takes back the pick, then the plan', async () => {
        const { defence } = await defending()
        defence.setPlan(POWER, true)
        const [legal] = defence.planChoicesOf(POWER)
        if (!legal) throw Error('Wrestlers asks a place')
        defence.setPlanPicks(PLAN, withOptionPick(emptyPicks(), legal, 0, 0))
        expect(defence.plansComplete).toBe(true)
        expect(defence.back()).toBe(true)
        expect(defence.plansComplete).toBe(false)
        expect(defence.plans).toEqual([{ ...PLAN, choices: [] }])
        expect(defence.back()).toBe(true)
        expect(defence.plans).toEqual([])
    })

    it('R-X.4 — before revision 22 nothing is asked, and the plan is sent bare', async () => {
        const { defence, sent } = await defending({ revision: OathRevision.EngineFixes17 })
        defence.setPlan(POWER, true)
        expect(defence.planChoicesOf(POWER)).toEqual([])
        expect(defence.plansComplete).toBe(true)
        await defence.answer(true)
        expect(sent).toHaveBeenLastCalledWith([PLAN])
    })
})

describe('the History of a Wrestlers sacrifice', () => {
    const names = {
        player: (playerId: string) => playerId,
        site: (slotId: string) => (slotId === PLAINS ? 'Plains' : slotId),
        seats: ['Dana', 'Ann', 'Rhys']
    }
    const row = (note: string): GameAction => {
        const fields: Record<string, unknown> = {
            plans: [],
            metadata: { plansUsed: ['Wrestlers'], swords: 2, defense: 3, planNotes: [note] }
        }
        return {
            id: 'a1',
            gameId: 'g1',
            source: ActionSource.User,
            type: ActionType.CampaignDefend,
            playerId: 'Ann',
            ...fields
        }
    }

    it("names the place: at the site, on the Ally's board, on the user's own board", () => {
        expect(describeAction(row(`Wrestlers: sacrificed a warband at ${PLAINS}`), names)).toBe(
            'used Wrestlers; 2 swords against 3 defense; sacrificed a warband at Plains (Wrestlers)'
        )
        expect(describeAction(row("Wrestlers: sacrificed a warband on Rhys's board"), names)).toBe(
            "used Wrestlers; 2 swords against 3 defense; sacrificed a warband on Rhys's board (Wrestlers)"
        )
        expect(describeAction(row("Wrestlers: sacrificed a warband on Ann's board"), names)).toBe(
            'used Wrestlers; 2 swords against 3 defense; sacrificed a warband on their own board (Wrestlers)'
        )
    })
})
