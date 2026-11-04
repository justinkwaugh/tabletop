import { afterEach, describe, expect, it } from 'vitest'
import type { GameAction } from '@tabletop/common'
import {
    isCampaign,
    isCampaignDefeatKills,
    isCampaignDefend,
    ownWarbandOwner
} from '@tabletop/oath'
import { disposeSessions, openSessionOn, type PlayedTable } from '$lib/testing/sessionHarness.js'
import { campaignLedgerTable } from '$lib/testing/campaignLedgerTable.js'
import { describeAction, phraseWarbandOwner } from './actionDescription.js'
import { MajorEventKind, historyRows } from './majorEvents.js'
import { seatsById } from './names.js'
import { tokenParts } from './tokenText.js'

afterEach(() => {
    disposeSessions()
})

async function namesOf(table: PlayedTable) {
    return (await openSessionOn(table)).historyNames
}

function stepOf<T extends GameAction>(
    table: PlayedTable,
    matches: (action: GameAction) => action is T
): T {
    const step = table.actions.find(matches)
    if (!step) throw Error('the table holds no such step')
    return step
}

describe('the closing card and every step below it', () => {
    it('the card that closes a Campaign carries that Campaign’s steps; every step is still a row', async () => {
        const table = campaignLedgerTable()
        const rows = historyRows(table.actions, {
            viewerId: 'Dana',
            nameOf: (playerId) => playerId,
            oathType: (await openSessionOn(table)).gameState.oathType,
            seatsById: true
        })
        expect(rows.map((row) => row.action)).toEqual([...table.actions].reverse())
        const [close, ...steps] = rows
        expect(close.event?.kind).toBe(MajorEventKind.CampaignWon)
        expect(close.campaignSteps).toEqual(table.actions)
        for (const step of steps) expect(step.campaignSteps).toBeUndefined()
    })

    it('a closing step whose declaration the History does not hold keeps today’s card, with no ledger', async () => {
        const table = campaignLedgerTable()
        const close = table.actions.slice(-1)
        const [row] = historyRows(close, {
            viewerId: 'Dana',
            nameOf: (playerId) => playerId,
            oathType: (await openSessionOn(table)).gameState.oathType,
            seatsById: true
        })
        expect(row.event?.kind).toBe(MajorEventKind.CampaignWon)
        expect(row.campaignSteps).toBeUndefined()
    })
})

describe('the three facts the step rows dropped', () => {
    it('R-5.5.5 — the defend row names the attacker’s warbands lost to skulls, in the attacker’s colour', async () => {
        const table = campaignLedgerTable()
        const names = await namesOf(table)
        const defend = stepOf(table, isCampaignDefend)
        const text = describeAction(defend, seatsById(names), 'Rhys', stepOf(table, isCampaign))
        expect(text).toBe(
            "used Bear Traps; 9 swords against 9 defense; Dana lost 2 warbands to skulls; killed a warband on Dana's board (Bear Traps)"
        )
        const session = await openSessionOn(table)
        const reader = { names, viewerId: 'Rhys' }
        const owners = tokenParts(text, { warbands: true, seats: reader }).flatMap((part) =>
            part.kind === 'warband'
                ? [
                      phraseWarbandOwner(part.whose, defend, reader, (playerId) =>
                          ownWarbandOwner(session.gameState, playerId)
                      )
                  ]
                : []
        )
        expect(owners).toEqual(['Dana', 'Dana'])
    })

    it('R-5.5.6.a — the picked losses say where they were killed', async () => {
        const table = campaignLedgerTable({ revision: 0 })
        const kills = stepOf(table, isCampaignDefeatKills)
        expect(describeAction(kills, seatsById(await namesOf(table)), 'Dana')).toBe(
            "picked the defense's losses: 1 warband killed at Plains"
        )
    })
})
