import { afterEach, describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ActionType,
    CampaignTargetKind,
    isCampaignSacrifice,
    ownWarbandOwner
} from '@tabletop/oath'
import { disposeSessions, openSessionOn, type PlayedTable } from '$lib/testing/sessionHarness.js'
import { PLAINS, campaignLedgerTable } from '$lib/testing/campaignLedgerTable.js'
import { campaignLedger, makeupWords, sideWarbandOwner } from './campaignLedger.js'
import { seatsById } from './names.js'
import { tokenParts } from './tokenText.js'

afterEach(() => {
    disposeSessions()
})

const SEATS = ['Dana', 'Rhys', 'Ann']

/** A recorded step from its fields, as History reads it. */
function row(
    fields: { type: ActionType; playerId?: string } & Record<string, unknown>
): GameAction {
    return { id: `a-${fields.type}`, gameId: 'g1', source: ActionSource.User, ...fields }
}

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

const attacker = {
    seatId: 'Dana',
    role: 'attacked',
    dice: '10 (Plains +1); 9 rolled (Bear Traps −1)',
    plan: 'Field Promotion: gained 3 of their own warbands',
    lost: '4 warbands: 2 to skulls, 1 to Bear Traps, 1 sacrificed',
    gained: 'Plains (2 warbands placed), Cup of Plenty, 3 of their own warbands'
}

const defender = {
    seatId: 'Rhys',
    role: 'defended',
    dice: '5 (Plains 1, Cup of Plenty 2, pawn 2)',
    plan: "Bear Traps: killed a warband on Dana's board"
}

describe('R-5.5 — the closing card’s ledger, from the Campaign’s own records', () => {
    it('from revision 25: the result, each side under their chip, the dice as rolled and the defense made up', async () => {
        const table = campaignLedgerTable()
        const ledger = campaignLedger(table.actions, seatsById(await namesOf(table)))
        expect(ledger.result).toBe('Dana against Rhys at Plains: 10 attack to 9 defense.')
        const [dana, rhys] = ledger.sides
        expect(dana).toMatchObject(attacker)
        expect(dana.attackFaces?.length).toBe(9)
        expect(dana.attackFaces?.filter((face) => face.skulls > 0).length).toBe(2)
        expect(rhys).toMatchObject({
            ...defender,
            lost: '1 warband killed at Plains, Plains, Cup of Plenty, 2 favor; banished to River'
        })
        expect(rhys.gained).toBeUndefined()
        expect(rhys.defenseFaces?.length).toBe(5)
        expect(rhys.makeup).toEqual({
            shields: 3,
            doublings: 1,
            doubled: 6,
            warbands: 3,
            bandits: 0,
            defense: 9
        })
        expect(rhys.makeup && makeupWords(rhys.makeup)).toBe(
            ' doubled to 6, + 3 warbands: 9 defense'
        )
    })

    it('before revision 25 (no roll recorded): the same ledger without the faces and the makeup', async () => {
        const table = campaignLedgerTable({ revision: 24 })
        const ledger = campaignLedger(table.actions, seatsById(await namesOf(table)))
        expect(ledger.result).toBe('Dana against Rhys at Plains: 10 attack to 9 defense.')
        const [dana, rhys] = ledger.sides
        expect(dana).toMatchObject(attacker)
        expect(rhys).toMatchObject(defender)
        // Neither picked nor rolled on the record: how many, not where.
        expect(rhys.lost).toBe(
            '1 warband killed, Plains, Cup of Plenty, 2 favor; banished to River'
        )
        for (const side of ledger.sides) {
            expect(side.attackFaces).toBeUndefined()
            expect(side.defenseFaces).toBeUndefined()
            expect(side.makeup).toBeUndefined()
        }
    })

    it('R-5.5.6.a — the defense’s losses picked at a place are lost at that place', async () => {
        const table = campaignLedgerTable({ revision: 0 })
        const [dana, rhys] = campaignLedger(table.actions, seatsById(await namesOf(table))).sides
        expect(rhys.lost).toBe(
            '1 warband killed at Plains, Plains, Cup of Plenty, 2 favor; banished to River'
        )
        expect(dana.gained).toBe('Plains (2 warbands placed), Cup of Plenty, 3 warbands')
    })

    it('R-5.5.6 — a loss nobody was asked to pick is taken from the rolled force in its order, and read where it fell', () => {
        // Rhys defends with 1 warband at the Plains and 2 on their board; the default takes the
        // force's groups in order, so 2 killed are the Plains one and one from the board.
        const roll = {
            attackFaces: [],
            defenseFaces: [],
            swords: 6,
            skulls: 0,
            shields: 0,
            doubled: false,
            defendingForce: [
                { at: { kind: 'site', siteId: PLAINS }, owner: 'Rhys', count: 1 },
                { at: { kind: 'board', playerId: 'Rhys' }, owner: 'Rhys', count: 2 }
            ],
            defendingBandits: 0,
            defense: 3
        }
        const steps = (defeatKilled: number, rolled: Record<string, unknown> = { roll }) => [
            row({
                type: ActionType.Campaign,
                playerId: 'Dana',
                defender: { kind: 'player', playerId: 'Rhys' },
                targets: [{ kind: CampaignTargetKind.Site, siteId: PLAINS }],
                attackDice: 6,
                plans: [],
                metadata: {
                    supplySpent: 1,
                    battle: {
                        attackPool: 6,
                        defensePool: 1,
                        defense: 3,
                        swords: 6,
                        skullsKilled: 0
                    }
                }
            }),
            row({
                type: ActionType.CampaignSacrifice,
                playerId: 'Dana',
                sacrifice: 0,
                metadata: {
                    attack: 6,
                    defense: 3,
                    attackerVictorious: true,
                    sacrificed: 0,
                    defeatKilled,
                    ...rolled
                }
            }),
            row({
                type: ActionType.CampaignResolveVictory,
                playerId: 'Dana',
                placements: [],
                metadata: {
                    warbandsPlaced: 0,
                    relicsTaken: [],
                    bannersSeized: [],
                    seizeBurned: 0,
                    favorBurned: 0,
                    relicsRevealed: 0,
                    defenderPlayerId: 'Rhys'
                }
            })
        ]
        const names = { player: (playerId: string) => playerId, site: () => 'Plains', seats: SEATS }
        const lostBy = (defeatKilled: number, rolled?: Record<string, unknown>) =>
            campaignLedger(steps(defeatKilled, rolled), names).sides[1].lost
        expect(lostBy(1)).toBe('1 warband killed at Plains, Plains')
        expect(lostBy(2)).toBe("2 warbands: 1 killed on Rhys's board, 1 killed at Plains, Plains")
        // Before revision 25 nothing recorded the force: how many, not where.
        expect(lostBy(1, {})).toBe('1 warband killed, Plains')
    })

    it('a lost Campaign closes on the sacrifice: the attacker’s losses, nothing gained', async () => {
        const table = campaignLedgerTable({ sacrifice: 0 })
        const close = stepOf(table, isCampaignSacrifice)
        expect(close.metadata?.attackerVictorious).toBe(false)
        const ledger = campaignLedger(table.actions, seatsById(await namesOf(table)))
        expect(ledger.result).toBe('Dana against Rhys at Plains: 9 attack to 9 defense.')
        const [dana, rhys] = ledger.sides
        expect(dana.plan).toBe('Field Promotion')
        expect(dana.lost).toBe("6 warbands: 2 to skulls, 1 to Bear Traps, 3 killed on Dana's board")
        expect(dana.gained).toBeUndefined()
        expect(rhys.lost).toBeUndefined()
        expect(rhys.gained).toBeUndefined()
    })

    it('R-5.5.6 — against the bandits: "the bandits" defend, and no Lost line for them', () => {
        const steps = [
            row({
                type: ActionType.Campaign,
                playerId: 'Dana',
                defender: { kind: 'bandits' },
                targets: [{ kind: CampaignTargetKind.Site, siteId: PLAINS }],
                attackDice: 3,
                plans: [],
                metadata: {
                    supplySpent: 1,
                    battle: {
                        attackPool: 3,
                        defensePool: 1,
                        defense: 3,
                        swords: 4,
                        skullsKilled: 0
                    }
                }
            }),
            row({
                type: ActionType.CampaignSacrifice,
                playerId: 'Dana',
                sacrifice: 0,
                metadata: {
                    attack: 4,
                    defense: 3,
                    attackerVictorious: true,
                    sacrificed: 0,
                    defeatKilled: 0
                }
            }),
            row({
                type: ActionType.CampaignResolveVictory,
                playerId: 'Dana',
                placements: [{ siteId: PLAINS, owner: 'Dana', count: 1 }],
                metadata: {
                    warbandsPlaced: 1,
                    relicsTaken: [],
                    bannersSeized: [],
                    seizeBurned: 0,
                    favorBurned: 0,
                    relicsRevealed: 0
                }
            })
        ]
        const names = { player: (playerId: string) => playerId, site: () => 'Plains', seats: SEATS }
        const ledger = campaignLedger(steps, names)
        expect(ledger.result).toBe('Dana against the bandits at Plains: 4 attack to 3 defense.')
        const [dana, bandits] = ledger.sides
        expect(dana).toMatchObject({ dice: '3', gained: 'Plains (1 warband placed)' })
        expect(dana.lost).toBeUndefined()
        expect(bandits).toMatchObject({ seatId: undefined, role: 'defended', dice: '1 (Plains 1)' })
        expect(bandits.lost).toBeUndefined()
    })

    it('R-10.13 — a side’s warbands are its own; a board its words name is that seat’s', async () => {
        const table = campaignLedgerTable()
        const session = await openSessionOn(table)
        const reader = { names: session.historyNames, viewerId: 'Rhys' }
        const own = (playerId: string) => ownWarbandOwner(session.gameState, playerId)
        const [, rhys] = campaignLedger(table.actions, seatsById(session.historyNames)).sides
        const owners = (text: string | undefined) =>
            tokenParts(text ?? '', { warbands: true, seats: reader }).flatMap((part) =>
                part.kind === 'warband'
                    ? [sideWarbandOwner(part.whose, rhys.seatId, reader, own)]
                    : []
            )
        expect(owners(rhys.plan)).toEqual(['Dana'])
        expect(owners(rhys.lost)).toEqual(['Rhys'])
    })
})
