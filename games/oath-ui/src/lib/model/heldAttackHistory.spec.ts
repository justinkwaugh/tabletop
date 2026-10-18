import { afterEach, describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, IMPERIAL_WARBANDS, MachineState, PowerQuestionKind, isAnswerQuestion, isCampaign, ownWarbandOwner } from '@tabletop/oath'
import { disposeSessions, openSessionOn, type PlayedTable } from '$lib/testing/sessionHarness.js'
import { heldAttackTable } from '$lib/testing/heldAttackTable.js'
import { describeAction, drawsSkulls, rowWarbandOwner } from './actionDescription.js'
import { seatsById } from './names.js'
import { tokenParts } from './tokenText.js'

afterEach(() => {
    disposeSessions()
})

const JINX = 'denizen.arcane.jinx'
const VIEWERS = ['Dana', 'Bea', 'Ann'] as const

function actionOf(table: PlayedTable, matches: (action: GameAction) => boolean): GameAction {
    const action = table.actions.find(matches)
    if (!action) throw Error('the table holds no such action')
    return action
}

const campaignOf = (table: PlayedTable) => actionOf(table, isCampaign)
const answerOf = (table: PlayedTable) => actionOf(table, isAnswerQuestion)

/** The row as each viewer's History says it, with the table's own names. */
async function rows(table: PlayedTable, action: GameAction): Promise<Record<(typeof VIEWERS)[number], string>> {
    const names = (await openSessionOn(table)).historyNames
    return { Dana: describeAction(action, names, 'Dana'), Bea: describeAction(action, names, 'Bea'), Ann: describeAction(action, names, 'Ann') }
}

/** The row's parts as `ActionDescription` draws them for `viewerId`. */
async function partsOf(table: PlayedTable, action: GameAction, viewerId: string) {
    const names = (await openSessionOn(table)).historyNames
    return tokenParts(describeAction(action, seatsById(names), viewerId), { warbands: true, skulls: drawsSkulls(action), seats: { names, viewerId } })
}

/** A recorded action from its fields, as History reads it. */
function row(fields: { type: ActionType; playerId?: string } & Record<string, unknown>): GameAction {
    return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
}

function answerRow(summary: string, heldAttack?: Record<string, unknown>): GameAction {
    return row({
        type: ActionType.AnswerQuestion,
        playerId: 'Bea',
        answer: { kind: PowerQuestionKind.RerollDice, reroll: false },
        metadata: { cardId: JINX, kind: PowerQuestionKind.RerollDice, summary, resumeMachineState: MachineState.CampaignSacrifice, last: true, ...(heldAttack ? { heldAttack } : {}) }
    })
}

const names = { player: (playerId: string) => playerId, site: (slotId: string) => slotId, seats: ['Dana', 'Bea', 'Ann', 'Rhys'] }

describe('R-5.5.4-H1 — History while the attack waits on the defender’s Jinx', () => {
    it('the Campaign row ends with the attack dice held against the defense rolled, never “0 swords”', async () => {
        const table = heldAttackTable()
        const row = await rows(table, campaignOf(table))
        expect(row.Ann).toBe('campaigned against Bea for Fertile Valley and their pawn and favor, spending 2 Supply; 4 attack dice against 6 defense')
        for (const text of Object.values(row)) {
            expect(text).toMatch(/; 4 attack dice against 6 defense$/)
            expect(text).not.toContain('swords')
        }
    })

    it('Bea keeps the roll: their answer row carries the attack, and the skull’s loss under Dana’s name', async () => {
        const table = heldAttackTable('keep')
        expect(await rows(table, answerOf(table))).toEqual({
            Dana: 'Jinx: kept the roll. 4 swords against 6 defense; you lost 1 warband to a skull',
            Bea: 'Jinx: kept the roll. 4 swords against 6 defense; Dana lost 1 warband to a skull',
            Ann: 'Jinx: kept the roll. 4 swords against 6 defense; Dana lost 1 warband to a skull'
        })
        // The Campaign row, written before the roll, still says what was brought.
        expect((await rows(table, campaignOf(table))).Ann).toMatch(/; 4 attack dice against 6 defense$/)
    })

    it('Bea rerolls: the answer row adds the attack against the new defense, with no loss', async () => {
        const table = heldAttackTable('reroll')
        const row = 'Jinx: rerolled the defense — 7 defense. 2 swords against 7 defense'
        expect(await rows(table, answerOf(table))).toEqual({ Dana: row, Bea: row, Ann: row })
    })

    it('the warband is its token and the skull its symbol, Dana a seat chip, for every viewer', async () => {
        const table = heldAttackTable('keep')
        const answer = answerOf(table)
        expect(drawsSkulls(answer)).toBe(true)
        for (const viewer of VIEWERS) {
            const parts = await partsOf(table, answer, viewer)
            expect(parts.slice(-5), viewer).toEqual([
                { kind: 'seat', playerId: 'Dana', possessive: false },
                { kind: 'text', text: ' lost ' },
                { kind: 'warband', count: 1, whose: { kind: 'row' }, words: 'warband' },
                { kind: 'text', text: ' to a ' },
                { kind: 'skull', words: 'skull' }
            ])
            expect(parts.filter((part) => part.kind === 'text' && /warband|skull/.test(part.text)), viewer).toEqual([])
        }
    })

    it('R-10.13 — the warband token is drawn in the attacker’s colour, not the answering defender’s', async () => {
        const table = heldAttackTable('keep')
        const answer = answerOf(table)
        const session = await openSessionOn(table)
        expect(rowWarbandOwner(answer, (playerId) => ownWarbandOwner(session.gameState, playerId))).toBe('Dana')
        expect(session.historyWarbandColor(answer)({ kind: 'row' })).toBe(session.warbandColor('Dana'))
        expect(session.warbandColor('Dana')).not.toBe(session.warbandColor('Bea'))
    })

    it('a Citizen attacker’s lost warband is Imperial; two skulls read “to skulls”', () => {
        const action = answerRow('kept the roll', { attackerPlayerId: 'Rhys', swords: 3, defense: 5, skullsKilled: 2 })
        const own = (playerId: string) => (playerId === 'Rhys' ? IMPERIAL_WARBANDS : playerId)
        expect(rowWarbandOwner(action, own)).toBe(IMPERIAL_WARBANDS)
        const text = describeAction(action, names, 'Ann')
        expect(text).toBe('Jinx: kept the roll. 3 swords against 5 defense; Rhys lost 2 warbands to skulls')
        expect(tokenParts(text, { warbands: true, skulls: true }).slice(-3)).toEqual([
            { kind: 'warband', count: 2, whose: { kind: 'row' }, words: 'warbands' },
            { kind: 'text', text: ' to ' },
            { kind: 'skull', words: 'skulls' }
        ])
    })

    it('the other rows that muster the battle say the held dice too: a Citizen’s answer, the attacker’s plans', () => {
        const battle = { attackPool: 4, defensePool: 3, defense: 6, swords: 0, skullsKilled: 0, heldAttackDice: 4 }
        const consent = row({ type: ActionType.AnswerConsent, playerId: 'Rhys', granted: false, metadata: { kind: 'joinDefence', askingPlayerId: 'Dana', battle } })
        const plans = row({ type: ActionType.CampaignAttackPlans, playerId: 'Dana', plans: [], metadata: { battle } })
        expect(describeAction(consent, names, 'Ann')).toBe('stayed out of the battle; 4 attack dice against 6 defense')
        expect(describeAction(plans, names, 'Ann')).toBe('used no battle plans; 4 attack dice against 6 defense')
    })

    it('Hospital holding the loss: the row says “lost”, as the Campaign row does, never that it died', () => {
        const text = describeAction(answerRow('kept the roll', { attackerPlayerId: 'Dana', swords: 4, defense: 6, skullsKilled: 1 }), names, 'Ann')
        expect(text).toBe('Jinx: kept the roll. 4 swords against 6 defense; Dana lost 1 warband to a skull')
        expect(text).not.toMatch(/died|killed/)
    })
})

describe('R-5.5.4-H1 — rows with nothing held read as before', () => {
    const campaign = (battle: Record<string, unknown>) => row({ type: ActionType.Campaign, playerId: 'Dana', defender: { kind: 'player', playerId: 'Bea' }, targets: [], attackDice: 4, metadata: { supplySpent: 2, battle } })
    const rolled = { attackPool: 4, defensePool: 3, defense: 6, swords: 4, skullsKilled: 1 }

    it('a Campaign rolled at once keeps its swords and skulls, with the skull a word', () => {
        const action = campaign(rolled)
        const text = describeAction(action, names, 'Ann')
        expect(text).toBe('campaigned against Bea, spending 2 Supply; 4 swords against 6 defense; lost 1 warband to skulls')
        expect(drawsSkulls(action)).toBe(false)
        expect(tokenParts(text, { warbands: true, skulls: drawsSkulls(action) }).at(-1)).toEqual({ kind: 'text', text: ' to skulls' })
    })

    it('the defender’s plans still to come: the dice, as before', () => {
        expect(describeAction(campaign({ ...rolled, defense: 0, swords: 0, skullsKilled: 0, awaitingDefender: true }), names, 'Ann')).toBe('campaigned against Bea, spending 2 Supply; 4 attack dice against 3 defense dice')
    })

    it('the defender’s plans with the attack held: the dice that will be rolled against the defense', () => {
        const defended = (extra: Record<string, unknown>) => row({ type: ActionType.CampaignDefend, playerId: 'Bea', plans: [], metadata: { plansUsed: ['Mounted Patrol'], attackPool: 2, defensePool: 3, defense: 6, swords: 0, skullsKilled: 0, ...extra } })
        expect(describeAction(defended({ heldAttackDice: 2 }), names, 'Ann')).toBe('used Mounted Patrol; 2 attack dice against 6 defense')
        expect(describeAction(defended({ swords: 3 }), names, 'Ann')).toBe('used Mounted Patrol; 3 swords against 6 defense')
    })

    it('an answer recorded before the field, and the attacker’s own Jinx, read as today', () => {
        expect(describeAction(answerRow('kept the roll'), names, 'Ann')).toBe('Jinx: kept the roll')
        expect(describeAction(answerRow('Jinx: rerolled the attack — 3 swords'), names, 'Ann')).toBe('Jinx: rerolled the attack — 3 swords')
        expect(drawsSkulls(answerRow('kept the roll'))).toBe(false)
    })
})
