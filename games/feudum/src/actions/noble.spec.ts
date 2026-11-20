import { describe, expect, it } from 'vitest'
import type { ScrollSpaceId } from '../data/guilds.js'
import type { BeadValue } from '../data/seals.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { rosaryBeadSum, unseenBeadValues } from '../model/beads.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import {
    setBeads,
    setJourneyman,
    setMaster,
    setRowMarkers,
    setScrolls,
    setScrollSeal,
    setSealPile,
    recordedText,
    tableAtGuild
} from '../testing/guilds.js'
import { canonicalOf } from '../testing/state.js'
import { guildActionOffers, guildActionPreview } from './guildAction.js'
import { knightRows, ownerSupply } from '../model/knightRows.js'
import { KnightRowIds } from '../data/guilds.js'

const Pull = { type: ActionType.GuildAction, guildId: 'noble', fn: 'pull' } as const
const Push = { type: ActionType.GuildAction, guildId: 'noble', fn: 'push' } as const

const R1C1 = 'guild.noble.scroll.r1c1'
const R1C2 = 'guild.noble.scroll.r1c2'
const R1C3 = 'guild.noble.scroll.r1c3'
const R2C1 = 'guild.noble.scroll.r2c1'
const R2C2 = 'guild.noble.scroll.r2c2'
const R3C1 = 'guild.noble.scroll.r3c1'

function journeymanTable(
    filled: readonly ScrollSpaceId[],
    markers: readonly number[] = [2, 2, 2, 2],
    edit?: (state: HydratedFeudumGameState, seat: string) => void
) {
    return tableAtGuild((state, seat, rest) => {
        setJourneyman(state, seat, 'noble', rest[0])
        setScrolls(state, filled)
        setRowMarkers(state, markers)
        edit?.(state, seat)
    })
}

function masterTable(
    seals: readonly (readonly [ScrollSpaceId, BeadValue])[],
    rosary: readonly BeadValue[] = []
) {
    return tableAtGuild((state, seat) => {
        setMaster(state, seat, 'noble')
        setBeads(state, { rosary, chickens: [] })
        setScrolls(
            state,
            seals.map(([spaceId]) => spaceId)
        )
        for (const [spaceId, value] of seals) {
            setScrollSeal(state, spaceId, value)
        }
    })
}

describe('GuildAction: R-4.6.4 the Noble pull', () => {
    it('R-4.6.4, R-X.2 S45 no line completed: 2 markers out, 2 seals in unseen, no barrier', () => {
        const { table, playerId } = journeymanTable([])
        const before = table.hydrated()
        const [first, second] = knightRows(before)
        const pile = before.supply.sealPileCount
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, {
            ...Pull,
            params: { knightRows: [KnightRowIds[0], KnightRowIds[1]], scrollSpaces: [R1C1, R1C2] }
        })
        const after = table.hydrated()
        expect(knightRows(after).map(({ row }) => row.markers)).toEqual([1, 1, 2, 2])
        expect(ownerSupply(after, first.row.owner)).toBe(ownerSupply(before, first.row.owner) + 1)
        expect(ownerSupply(after, second.row.owner)).toBe(ownerSupply(before, second.row.owner) + 1)
        expect(after.guilds.noble.scrolls[R1C1]).toBe(true)
        expect(after.guilds.noble.scrolls[R1C2]).toBe(true)
        expect(after.supply.sealPileCount).toBe(pile - 2)
        expect(table.seat(playerId).score).toBe(score)
        expect(action).toMatchObject({
            metadata: {
                completions: 0,
                points: 0,
                reeveOffered: true,
                drawnWritIds: [],
                details: {
                    kind: 'noble-pull',
                    markers: [
                        { rowId: first.rowId, owner: first.row.owner },
                        { rowId: second.rowId, owner: second.row.owner }
                    ],
                    rows: 0,
                    columns: 0
                }
            }
        })
        expect(recordedText(action)).not.toContain('seal.')
        expect(action.revealsInfo).toBeFalsy()
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.6.4 a row or column reaches the threshold once: 3 vp and the writ draw, a barrier', () => {
        const { table, playerId } = journeymanTable([R1C1, R1C3, R2C2, R3C1])
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, {
            ...Pull,
            params: { knightRows: [KnightRowIds[0], KnightRowIds[1]], scrollSpaces: [R1C2, R2C1] }
        })
        expect(table.seat(playerId).score).toBe(score + 3)
        expect(action).toMatchObject({
            metadata: {
                completions: 1,
                points: 3,
                drawnCount: 2,
                keep: 1,
                details: { rows: 2, columns: 2 }
            },
            revealsInfo: true
        })
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
    })

    it('R-4.6.4 a column alone reaches it too', () => {
        const { table, playerId } = journeymanTable([R1C1, R2C2])
        const [action] = table.send(playerId, {
            ...Pull,
            params: { knightRows: [KnightRowIds[0], KnightRowIds[1]], scrollSpaces: [R1C2, R1C3] }
        })
        expect(action).toMatchObject({ metadata: { completions: 1, points: 3 } })
    })

    it('R-4.6.4 S45 refuses a used colour, an empty row, a third marker, and a filled space', () => {
        const { table, playerId } = journeymanTable([R1C1], [2, 0, 2, 2])
        const send = (rows: number[], scrollSpaces: ScrollSpaceId[]) => () =>
            table.send(playerId, {
                ...Pull,
                params: { knightRows: rows.map((row) => KnightRowIds[row]), scrollSpaces }
            })
        expect(send([0, 0], [R1C2, R1C3])).toThrow('Pick rows of different colours.')
        expect(send([0, 1], [R1C2, R1C3])).toThrow('That Knight row holds no marker.')
        expect(send([0, 2, 3], [R1C2, R1C3, R2C1])).toThrow('Move at most 2 markers.')
        expect(send([0, 2], [R1C1, R1C2])).toThrow('That scroll space is not empty.')
    })

    it('R-4.6.1, R-4.6-H5 2 must move if they can, fewer if impossible', () => {
        const { table, playerId } = journeymanTable([])
        expect(() =>
            table.send(playerId, {
                ...Pull,
                params: { knightRows: [KnightRowIds[0]], scrollSpaces: [R1C1] }
            })
        ).toThrow('2 markers can move: move them all.')

        const oneRow = journeymanTable([R1C1, R1C2], [2, 0, 0, 0])
        const [action] = oneRow.table.send(oneRow.playerId, {
            ...Pull,
            params: { knightRows: [KnightRowIds[0]], scrollSpaces: [R1C3] }
        })
        expect(action).toMatchObject({ metadata: { completions: 1, points: 3 } })

        const oneSeal = journeymanTable([], [2, 2, 2, 2], (state, seat) => {
            setSealPile(state, seat, 1)
        })
        expect(() =>
            oneSeal.table.send(oneSeal.playerId, {
                ...Pull,
                params: { knightRows: [KnightRowIds[0]], scrollSpaces: [R1C1] }
            })
        ).not.toThrow()
    })

    it('R-4.6.1 is closed when nothing can move, and only the journeyman pulls', () => {
        const noMarkers = journeymanTable([], [0, 0, 0, 0])
        expect(() =>
            noMarkers.table.send(noMarkers.playerId, {
                ...Pull,
                params: { knightRows: [KnightRowIds[0]], scrollSpaces: [R1C1] }
            })
        ).toThrow('No Knight row holds a marker.')

        const noRank = tableAtGuild()
        expect(() =>
            noRank.table.send(noRank.playerId, {
                ...Pull,
                params: { knightRows: [KnightRowIds[0]], scrollSpaces: [R1C1] }
            })
        ).toThrow('Only the Noble journeyman pulls.')
    })

    it('R-5-H1 previews without the vault; the threshold is the barrier, not the seals', () => {
        const { table, playerId } = journeymanTable([R1C1, R1C3, R2C2, R3C1])
        const state = table.hydrated()
        state.vault = undefined
        const input = { guildId: 'noble', fn: 'pull' } as const
        expect(
            guildActionPreview(state, playerId, {
                ...input,
                params: {
                    knightRows: [KnightRowIds[0], KnightRowIds[1]],
                    scrollSpaces: [R1C2, R2C1]
                }
            })
        ).toMatchObject({ completions: 1, rows: 2, columns: 2, points: 3, revealsInfo: true })
        expect(
            guildActionPreview(state, playerId, {
                ...input,
                params: { knightRows: [KnightRowIds[0]], scrollSpaces: [] }
            })
        ).toMatchObject({
            completions: 0,
            revealsInfo: false,
            refused: '2 markers can move: move them all.'
        })
        expect(guildActionOffers(state, playerId)).toContainEqual({
            guildId: 'noble',
            fn: 'pull',
            bestVp: 3
        })
    })
})

describe('GuildAction: R-4.6.5 the Noble push', () => {
    it('R-4.6.5, R-X.2 2 seals flip onto the rosary, named by this Action: a barrier', () => {
        const { table, playerId } = masterTable(
            [
                [R1C1, 2],
                [R2C2, 3]
            ],
            [2]
        )
        const before = table.hydrated()
        const first = before.requireVault().scrollSeals[R1C1]
        const second = before.requireVault().scrollSeals[R2C2]
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, {
            ...Push,
            params: { scrollSpaces: [R1C1, R2C2] }
        })
        const after = table.hydrated()
        expect(after.guilds.noble.scrolls[R1C1]).toBe(false)
        expect(after.guilds.noble.scrolls[R2C2]).toBe(false)
        expect(after.guilds.monk.rosary).toEqual(expect.arrayContaining([first, second]))
        expect(after.requireVault().scrollSeals[R1C1]).toBeUndefined()
        expect(rosaryBeadSum(after)).toBe(7)
        expect(table.seat(playerId).score).toBe(score + 4)
        expect(action).toMatchObject({
            metadata: {
                completions: 1,
                points: 4,
                reeveOffered: true,
                details: { kind: 'noble-push', sealIds: [first, second], rosaryTotal: 7 }
            },
            revealsInfo: true
        })
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it.each<[string, BeadValue[], BeadValue, BeadValue, number, number]>([
        ['below 5', [], 2, 2, 0, 0],
        ['exactly 5', [], 2, 3, 1, 4],
        ['exactly 11', [2, 4], 2, 3, 2, 5],
        ['exactly 17', [3, 3, 5], 2, 4, 3, 6]
    ])('R-4.6.5 the rosary total %s', (_name, rosary, first, second, completions, points) => {
        const { table, playerId } = masterTable(
            [
                [R1C1, first],
                [R1C2, second]
            ],
            rosary
        )
        const [action] = table.send(playerId, {
            ...Push,
            params: { scrollSpaces: [R1C1, R1C2] }
        })
        expect(action).toMatchObject({ metadata: { completions, points }, revealsInfo: true })
    })

    it('R-4.6.1, R-4.6-H5 2 must flip if they can, fewer if impossible', () => {
        const two = masterTable([
            [R1C1, 2],
            [R1C2, 2]
        ])
        expect(() =>
            two.table.send(two.playerId, { ...Push, params: { scrollSpaces: [R1C1] } })
        ).toThrow('2 seals can flip: pick them all.')

        const one = masterTable([[R1C1, 5]])
        const [action] = one.table.send(one.playerId, {
            ...Push,
            params: { scrollSpaces: [R1C1] }
        })
        expect(action).toMatchObject({ metadata: { completions: 1, points: 4 } })
    })

    it('R-4.6.5 refuses more than 2, an empty space and one space twice', () => {
        const { table, playerId } = masterTable([
            [R1C1, 2],
            [R1C2, 2],
            [R1C3, 2]
        ])
        const send = (scrollSpaces: ScrollSpaceId[]) => () =>
            table.send(playerId, { ...Push, params: { scrollSpaces } })
        expect(send([R1C1, R1C2, R1C3])).toThrow('Flip at most 2 seals.')
        expect(send([R1C1, R2C1])).toThrow('No seal lies on that scroll space.')
        expect(send([R1C1, R1C1])).toThrow('No seal lies on that scroll space.')
    })

    it('R-4.6.1 is closed with no seal on the scrolls, and only the master pushes', () => {
        const none = masterTable([])
        expect(() =>
            none.table.send(none.playerId, { ...Push, params: { scrollSpaces: [R1C1] } })
        ).toThrow('No seal lies on the scrolls.')
        const noRank = tableAtGuild()
        expect(() =>
            noRank.table.send(noRank.playerId, { ...Push, params: { scrollSpaces: [R1C1] } })
        ).toThrow('Only the Noble master pushes.')
    })

    it('R-5-H1 the preview reads no vault: the unseen seals give its lowest and highest', () => {
        const { table, playerId } = masterTable(
            [
                [R1C1, 2],
                [R3C1, 2]
            ],
            [2, 2]
        )
        const state = table.hydrated()
        state.vault = undefined
        // 17 seals less the two beads shown: seven 2s, five 3s, two 4s and a 5.
        expect(unseenBeadValues(state)).toEqual([2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 5])
        const input = { guildId: 'noble', fn: 'push' } as const
        const preview = guildActionPreview(state, playerId, {
            ...input,
            params: { scrollSpaces: [R1C1, R3C1] }
        })
        expect(preview).toMatchObject({
            completions: 2,
            points: 5,
            revealsInfo: true,
            sealFlip: {
                rosaryTotal: 4,
                flips: 2,
                lowestTotal: 8,
                highestTotal: 13,
                ifLowest: { completions: 1, points: 4 }
            }
        })
        expect(
            guildActionPreview(state, playerId, { ...input, params: { scrollSpaces: [R2C1] } })
        ).toBeUndefined()
        expect(guildActionPreview(state, playerId, { ...input, params: {} })).toMatchObject({
            refused: '2 seals can flip: pick them all.'
        })
        expect(guildActionOffers(state, playerId)).toContainEqual({
            guildId: 'noble',
            fn: 'push',
            bestVp: 5
        })
    })
})
