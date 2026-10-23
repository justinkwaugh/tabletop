import { afterEach, describe, expect, it } from 'vitest'
import type { GameAction } from '@tabletop/common'
import { isAnswerQuestion, isCampaignResolveVictory, isCampaignSacrifice, ownWarbandOwner } from '@tabletop/oath'
import { disposeSessions, openSessionOn, type PlayedTable } from '$lib/testing/sessionHarness.js'
import { battleLossTable } from '$lib/testing/battleLossTable.js'
import { campaignLedgerTable } from '$lib/testing/campaignLedgerTable.js'
import { describeAction, phraseWarbandOwner } from './actionDescription.js'
import { campaignLedger, campaignStepsTo } from './campaignLedger.js'
import { seatsById } from './names.js'
import { tokenParts } from './tokenText.js'

afterEach(() => {
    disposeSessions()
})

function stepOf<T extends GameAction>(table: PlayedTable, matches: (action: GameAction) => action is T): T {
    const step = table.actions.find(matches)
    if (!step) throw Error('the table holds no such step')
    return step
}

/** The row as a seat that took no part reads it, seats by id. */
async function rowOf(table: PlayedTable, step: GameAction, viewerId?: string): Promise<string> {
    const session = await openSessionOn(table)
    return describeAction(step, seatsById(session.historyNames), viewerId)
}

async function ledgerOf(table: PlayedTable) {
    const session = await openSessionOn(table)
    return campaignLedger(table.actions, seatsById(session.historyNames), session.gameState)
}

describe("Hospital — History says where the warbands it saved went (the step that ended the Campaign records it)", () => {
    it("the spoils row: Ann's two chosen at the Plains went to Hospital's site; Rhys's one died", async () => {
        const table = battleLossTable({ hospital: true, ended: true })
        const spoils = stepOf(table, isCampaignResolveVictory)
        expect(spoils.metadata?.hospitalPlaced).toBeDefined()
        const row = await rowOf(table, spoils)
        expect(row).toContain("2 of Ann's warbands went to Hospital's site (Hospital)")
        expect(row.match(/Hospital's site/g)).toHaveLength(1)
    })

    it('control: with no Hospital the same Campaign says nothing of it', async () => {
        const table = battleLossTable({ ended: true })
        const row = await rowOf(table, stepOf(table, isCampaignResolveVictory))
        expect(row).not.toContain('Hospital')
    })

    it("a defeated attacker's Hospital: the sacrifice row that ends the Campaign says where all six went", async () => {
        const table = campaignLedgerTable({ sacrifice: 0, hospital: 'Dana' })
        const row = await rowOf(table, stepOf(table, isCampaignSacrifice), 'Ann')
        // The row starts with Dana's chip, so their warbands are "their own", as every row says it.
        expect(row).toContain('6 of their own warbands went to Hospital\'s site (Hospital)')
    })
})

describe("Hospital in the Campaign's ledger: set aside, not lost, in the History row's words", () => {
    it("Rhys's warband at the Plains, saved by their Hospital, is not killed there: the Lost line says where it went", async () => {
        const [dana, rhys] = (await ledgerOf(campaignLedgerTable({ hospital: 'Rhys' }))).sides
        expect(rhys.plan).toBe("Bear Traps: killed a warband on Dana's board; Hospital")
        expect(rhys.lost).toBe(
            "Plains, Cup of Plenty, 2 favor; 1 of Rhys's warbands went to Hospital's site (Hospital); banished to River"
        )
        // Dana used no Hospital: their losses read as before.
        expect(dana.lost).toBe('4 warbands: 2 to skulls, 1 to Bear Traps, 1 sacrificed')
    })

    it("a defeated attacker's Hospital saved every warband they lost: skulls, Bear Traps' and half their force", async () => {
        const [dana] = (await ledgerOf(campaignLedgerTable({ sacrifice: 0, hospital: 'Dana' }))).sides
        expect(dana.plan).toBe('Field Promotion; Hospital')
        expect(dana.lost).toBe("6 of Dana's warbands went to Hospital's site (Hospital)")
    })

    it('a banish that waited on Toll Roads: the answer that ended the Campaign says where it went, and the card agrees', async () => {
        const table = campaignLedgerTable({ hospital: 'Rhys', toll: true })
        const answer = stepOf(table, isAnswerQuestion)
        expect(answer.metadata?.hospitalPlaced).toBeDefined()
        expect(await rowOf(table, answer, 'Ann')).toContain(
            "1 of Rhys's warbands went to Hospital's site (Hospital)"
        )
        // The card closes on the spoils, before the answer; its steps reach the answer that ended it.
        const spoilsAt = table.actions.findIndex(isCampaignResolveVictory)
        const steps = campaignStepsTo(table.actions, spoilsAt)
        expect(steps.at(-1)).toBe(answer)
        const session = await openSessionOn(table)
        const [, rhys] = campaignLedger(steps, seatsById(session.historyNames), session.gameState).sides
        // The spoils step left the banish (and its burn) to the answer, so the card names neither.
        expect(rhys.lost).toBe("Plains, Cup of Plenty; 1 of Rhys's warbands went to Hospital's site (Hospital)")
    })

    it("the Toll Roads answer that ends the Campaign: the mover's own saved warbands are drawn as the mover's", async () => {
        const table = campaignLedgerTable({ hospital: 'Dana', toll: true })
        const answer = stepOf(table, isAnswerQuestion)
        // Rhys, banished, answered; the row starts with Dana's chip, the mover whose story it tells.
        expect(answer.playerId).toBe('Rhys')
        const row = await rowOf(table, answer, 'Ann')
        // Dana's four lost: 2 to skulls, 1 to Bear Traps, 1 sacrificed.
        expect(row).toContain("4 of their own warbands went to Hospital's site (Hospital)")
        const session = await openSessionOn(table)
        const reader = { names: seatsById(session.historyNames), viewerId: 'Ann' }
        const owners = tokenParts(row, { warbands: true, seats: reader }).flatMap((part) =>
            part.kind === 'warband' && part.count === 4
                ? [phraseWarbandOwner(part.whose, answer, reader, (playerId) => ownWarbandOwner(session.gameState, playerId))]
                : []
        )
        // The Hospital clause's token: Dana's colour, as its words say, not the answering seat's.
        expect(owners).toEqual(['Dana'])
    })

    it('control: with no Hospital the ledger counts the same losses as killed', async () => {
        const [dana, rhys] = (await ledgerOf(campaignLedgerTable({ sacrifice: 0 }))).sides
        expect(dana.lost).toBe("6 warbands: 2 to skulls, 1 to Bear Traps, 3 killed on Dana's board")
        expect(rhys.lost).toBeUndefined()
    })
})
