import { describe, expect, it } from 'vitest'
import { ScrollSpaces, type ScrollSpaceId } from '../data/guilds.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { rowsToScrollsOffer } from '../guilds/rowsToScrolls.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import {
    setCarts,
    setJourneyman,
    setMaster,
    setRowMarkers,
    setScrolls,
    setSealPile,
    recordedText,
    setVesselsForSale,
    tableAtGuild,
    type GoodAmounts
} from '../testing/guilds.js'
import { canonicalOf } from '../testing/state.js'
import { setUp } from '../testing/improving.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { guildActionOffers, guildActionPreview } from './guildAction.js'

const Pull = { type: ActionType.GuildAction, guildId: 'knight', fn: 'pull' } as const
const Push = { type: ActionType.GuildAction, guildId: 'knight', fn: 'push' } as const

const R1C1 = 'guild.noble.scroll.r1c1'
const R1C2 = 'guild.noble.scroll.r1c2'
const R1C3 = 'guild.noble.scroll.r1c3'
const R2C1 = 'guild.noble.scroll.r2c1'
const R2C2 = 'guild.noble.scroll.r2c2'
const R3C1 = 'guild.noble.scroll.r3c1'

function journeymanTable(carts: GoodAmounts, edit?: (state: HydratedFeudumGameState) => void) {
    return tableAtGuild((state, seat, rest) => {
        setJourneyman(state, seat, 'knight', rest[0])
        setCarts(state, carts)
        setVesselsForSale(state, [])
        edit?.(state)
    })
}

function masterTable(
    filled: readonly ScrollSpaceId[],
    markers: readonly number[] = [2, 2, 2, 2],
    edit?: (state: HydratedFeudumGameState, seat: string, rest: readonly string[]) => void
) {
    return tableAtGuild((state, seat, rest) => {
        setMaster(state, seat, 'knight')
        setScrolls(state, filled)
        setRowMarkers(state, markers)
        edit?.(state, seat, rest)
    })
}

describe('GuildAction: R-4.6.4 the Knight pull', () => {
    it('R-4.6.4 a vessel from the carts: 3 vp, 2 writs drawn, 1 kept, a barrier', () => {
        const { table, playerId } = journeymanTable({ food: 1, wood: 2 })
        const before = table.hydrated()
        const score = table.seat(playerId).score
        const haversack = before.supply.haversack
        const ships = before.supply.vessels.ship
        const [action] = table.send(playerId, { ...Pull, params: { inventions: ['ship'] } })
        const after = table.hydrated()
        expect(after.guilds.alchemist.carts['guild.alchemist.cart.wood-1']).toBe(false)
        expect(after.guilds.alchemist.carts['guild.alchemist.cart.food-1']).toBe(false)
        expect(after.supply.haversack.wood).toBe(haversack.wood + 2)
        expect(after.supply.haversack.food).toBe(haversack.food + 1)
        expect(after.supply.vessels.ship).toBe(ships - 1)
        expect(after.guilds.alchemist.vesselsForSale).toEqual(['ship'])
        expect(table.seat(playerId).score).toBe(score + 3)
        expect(action).toMatchObject({
            metadata: {
                completions: 1,
                points: 3,
                drawnCount: 2,
                keep: 1,
                details: { kind: 'knight-pull', goodsUsed: { food: 1, wood: 2 }, barrels: [] }
            },
            revealsInfo: true
        })
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
    })

    it('R-4.6.4, R-4.6.6, R-4.6-H4 a krud barrel costs its first price and fills every row', () => {
        const { table, playerId } = journeymanTable({ saltpeter: 2, sulfur: 1 }, (state) => {
            setRowMarkers(state, [1, 2, 3, 6])
        })
        const before = table.hydrated()
        const [first, second, third] = before.guilds.knight.rows
        const [action] = table.send(playerId, {
            ...Pull,
            params: { inventions: ['krud-barrel'] }
        })
        expect(table.hydrated().guilds.knight.rows.map((row) => row.markers)).toEqual([3, 3, 6, 6])
        expect(action).toMatchObject({
            metadata: {
                points: 3,
                details: {
                    kind: 'knight-pull',
                    goodsUsed: { saltpeter: 2, sulfur: 1 },
                    barrels: [
                        [
                            { colour: first.colour, added: 2 },
                            { colour: second.colour, added: 1 },
                            { colour: third.colour, added: 3 }
                        ]
                    ]
                }
            }
        })
    })

    it('R-4.6.4 refuses no invention, more than one, and what the carts cannot make', () => {
        const { table, playerId } = journeymanTable({ food: 2, wood: 4 })
        const send = (inventions: ('ship' | 'submersible')[]) => () =>
            table.send(playerId, { ...Pull, params: { inventions } })
        expect(send([])).toThrow('Pick one invention.')
        expect(send(['ship', 'ship'])).toThrow('Invent at most 1.')
        expect(send(['submersible'])).toThrow('That needs 2 iron; the carts and piles hold 0.')
    })

    it('R-4.6.1 is closed when nothing can be invented, and only the journeyman pulls', () => {
        const { table, playerId } = journeymanTable({})
        expect(() => table.send(playerId, { ...Pull, params: { inventions: ['ship'] } })).toThrow(
            'Nothing can be invented from the carts and piles.'
        )
        const noRank = tableAtGuild()
        expect(() =>
            noRank.table.send(noRank.playerId, { ...Pull, params: { inventions: ['ship'] } })
        ).toThrow('Only the Knight journeyman pulls.')
    })

    it('R-4.6.4 the preview reaches the threshold and says it is a barrier', () => {
        const { table, playerId } = journeymanTable({ food: 1, wood: 2 })
        const input = { guildId: 'knight', fn: 'pull' } as const
        const state = table.hydrated()
        expect(
            guildActionPreview(state, playerId, { ...input, params: { inventions: ['ship'] } })
        ).toMatchObject({ completions: 1, points: 3, drawnCount: 2, revealsInfo: true })
        expect(guildActionPreview(state, playerId, { ...input, params: {} })).toMatchObject({
            completions: 0,
            points: 0,
            refused: 'Pick one invention.'
        })
        expect(
            guildActionOffers(state, playerId).find(
                (offer) => offer.guildId === 'knight' && offer.fn === 'pull'
            )
        ).toEqual({ guildId: 'knight', fn: 'pull', bestVp: 3 })
    })
})

describe('GuildAction: R-4.6.5 the Knight push', () => {
    it('R-4.6.5 markers to the general supply, as many seals to scrolls unseen; no barrier', () => {
        const { table, playerId } = masterTable([R1C1, R1C3, R2C2, R3C1])
        const before = table.hydrated()
        const [first, second] = before.guilds.knight.rows
        const general = { ...before.supply.influence }
        const pile = before.supply.sealPileCount
        const top = before.requireVault().sealPile.slice(0, 2)
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, {
            ...Push,
            params: { knightRows: [0, 1], scrollSpaces: [R1C2, R2C1] }
        })
        const after = table.hydrated()
        expect(after.guilds.knight.rows.map((row) => row.markers)).toEqual([1, 1, 2, 2])
        expect(after.supply.influence[first.colour]).toBe(general[first.colour] + 1)
        expect(after.supply.influence[second.colour]).toBe(general[second.colour] + 1)
        expect(after.guilds.noble.scrolls[R1C2]).toBe(true)
        expect(after.guilds.noble.scrolls[R2C1]).toBe(true)
        expect(after.supply.sealPileCount).toBe(pile - 2)
        expect(after.requireVault().scrollSeals[R1C2]).toBe(top[0])
        expect(after.requireVault().scrollSeals[R2C1]).toBe(top[1])
        // Rows 1 and 2, or columns 1 and 2.
        expect(table.seat(playerId).score).toBe(score + 5)
        expect(action).toMatchObject({
            metadata: {
                completions: 2,
                points: 5,
                reeveOffered: true,
                drawnWritIds: [],
                details: {
                    kind: 'knight-push',
                    markers: [
                        { colour: first.colour, playerId: first.playerId },
                        { colour: second.colour, playerId: second.playerId }
                    ],
                    rows: 2,
                    columns: 2,
                    count: 'rows'
                }
            }
        })
        expect(recordedText(action)).not.toContain('seal.')
        expect(action.revealsInfo).toBeFalsy()
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.6.5 1 and 3 completions score 4 and 6', () => {
        const one = masterTable([R1C1, R2C1, R2C2])
        const score = one.table.seat(one.playerId).score
        const [action] = one.table.send(one.playerId, {
            ...Push,
            params: { knightRows: [0], scrollSpaces: [R3C1] }
        })
        expect(action).toMatchObject({ metadata: { completions: 1, points: 4 } })
        expect(one.table.seat(one.playerId).score).toBe(score + 4)

        const three = masterTable([R1C1, R1C2, R2C1])
        const [best] = three.table.send(three.playerId, {
            ...Push,
            params: { knightRows: [0, 1, 2], scrollSpaces: [R1C3, R2C2, R3C1] }
        })
        expect(best).toMatchObject({ metadata: { completions: 3, points: 6 } })
    })

    it('R-4.6.1, R-4.7-H1 a marker moved with no line completed scores no points, and offers a reeve', () => {
        const { table, playerId } = masterTable([])
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, {
            ...Push,
            params: { knightRows: [0], scrollSpaces: [R1C1] }
        })
        expect(table.seat(playerId).score).toBe(score)
        expect(action).toMatchObject({
            metadata: { completions: 0, points: 0, reevePoints: 0, reeveOffered: true }
        })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.6.1 only lines this push completes count, and never both rows and columns', () => {
        const already = masterTable([R3C1, R1C3])
        const [action] = already.table.send(already.playerId, {
            ...Push,
            params: { knightRows: [0], scrollSpaces: [R1C1] }
        })
        expect(action).toMatchObject({ metadata: { details: { rows: 0, columns: 0 } } })

        // The FAQ's example: two seals fill a row and a column, and score only one.
        const faq = masterTable([])
        const [both] = faq.table.send(faq.playerId, {
            ...Push,
            params: { knightRows: [0, 1], scrollSpaces: [R1C3, R3C1] }
        })
        expect(both).toMatchObject({
            metadata: { completions: 1, points: 4, details: { rows: 1, columns: 1 } }
        })
    })

    it('R-4.6.1 the actor counts rows or columns; absent, the higher', () => {
        const picks = { knightRows: [0, 1], scrollSpaces: [R2C1, R3C1] }
        const higher = masterTable([R2C2, R1C1])
        const [rows] = higher.table.send(higher.playerId, { ...Push, params: picks })
        expect(rows).toMatchObject({
            metadata: {
                completions: 2,
                points: 5,
                details: { rows: 2, columns: 1, count: 'rows' }
            }
        })

        const chosen = masterTable([R2C2, R1C1])
        const [columns] = chosen.table.send(chosen.playerId, {
            ...Push,
            params: { ...picks, count: 'columns' }
        })
        expect(columns).toMatchObject({
            metadata: { completions: 1, points: 4, details: { count: 'columns' } }
        })

        const mirrored = masterTable([R2C2, R1C1])
        const [columnsHigher] = mirrored.table.send(mirrored.playerId, {
            ...Push,
            params: { knightRows: [0, 1], scrollSpaces: [R1C2, R1C3] }
        })
        expect(columnsHigher).toMatchObject({
            metadata: { completions: 2, details: { rows: 1, columns: 2, count: 'columns' } }
        })
    })

    it('R-4.6.1 the range is the actor’s: one marker may move when three could', () => {
        const { table, playerId } = masterTable([])
        expect(() =>
            table.send(playerId, { ...Push, params: { knightRows: [0], scrollSpaces: [R1C1] } })
        ).not.toThrow()
    })

    it('R-4.6.5 refuses a used row, an empty row, too many, and spaces that do not match', () => {
        const { table, playerId } = masterTable([R1C1], [2, 0, 2, 2])
        const send = (knightRows: number[], scrollSpaces: ScrollSpaceId[]) => () =>
            table.send(playerId, { ...Push, params: { knightRows, scrollSpaces } })
        expect(send([], [])).toThrow('Pick up to 3 rows of different colours.')
        expect(send([0, 0], [R1C2, R1C3])).toThrow('Pick rows of different colours.')
        expect(send([1], [R1C2])).toThrow('That Knight row holds no marker.')
        expect(send([9], [R1C2])).toThrow('That Knight row holds no marker.')
        expect(send([0], [R1C2, R1C3])).toThrow('Pick one empty scroll space for each marker.')
        expect(send([0, 2], [R1C2])).toThrow('Pick one empty scroll space for each marker.')
        expect(send([0], [R1C1])).toThrow('That scroll space is not empty.')
        expect(send([0, 2], [R1C2, R1C2])).toThrow('That scroll space is not empty.')
    })

    it('R-4.6.1, R-4.6-H5, R-4.6-H9 fewer if impossible: rows, spaces and seals each limit it', () => {
        const rows = masterTable([], [1, 0, 1, 0])
        expect(rowsToScrollsOffer(rows.table.hydrated(), 3)).toMatchObject({
            movable: 2,
            knightRows: [0, 2]
        })

        const spaces = masterTable(ScrollSpaces.filter(({ id }) => id !== R1C1).map(({ id }) => id))
        expect(() =>
            spaces.table.send(spaces.playerId, {
                ...Push,
                params: { knightRows: [0, 1], scrollSpaces: [R1C1] }
            })
        ).toThrow('Move at most 1 marker.')

        const seals = masterTable([], [2, 2, 2, 2], (state, seat) => setSealPile(state, seat, 1))
        expect(() =>
            seals.table.send(seals.playerId, {
                ...Push,
                params: { knightRows: [0, 1], scrollSpaces: [R1C1, R1C2] }
            })
        ).toThrow('Move at most 1 marker.')
    })

    it('R-4.6.1 is closed with no marker in the rows, no empty space, or no seal to lay', () => {
        const send = ({ table, playerId }: ReturnType<typeof masterTable>) => {
            return () =>
                table.send(playerId, { ...Push, params: { knightRows: [0], scrollSpaces: [R1C1] } })
        }
        expect(send(masterTable([], [0, 0, 0, 0]))).toThrow('No Knight row holds a marker.')
        expect(send(masterTable(ScrollSpaces.map(({ id }) => id)))).toThrow(
            'No scroll space is empty.'
        )
        expect(
            send(masterTable([], [2, 2, 2, 2], (state, seat) => setSealPile(state, seat, 0)))
        ).toThrow('The general supply has no seal.')
        const notMaster = tableAtGuild()
        expect(() =>
            notMaster.table.send(notMaster.playerId, {
                ...Push,
                params: { knightRows: [0], scrollSpaces: [R1C1] }
            })
        ).toThrow('Only the Knight master pushes.')
    })

    it('R-1.4-H1 a dummy row gives a marker too, recorded by colour alone', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['guild', 'move', 'tax'] }), 2)
        const playerId = table.asked
        setUp(table, (state) => {
            setMaster(state, playerId, 'knight')
            setScrolls(state, [])
            setRowMarkers(state, [2, 2, 2, 2])
        })
        const index = table.hydrated().guilds.knight.rows.findIndex((row) => !row.playerId)
        const { colour } = table.hydrated().guilds.knight.rows[index]
        const general = table.hydrated().supply.influence[colour]
        const [action] = table.send(playerId, {
            ...Push,
            params: { knightRows: [index], scrollSpaces: [R1C1] }
        })
        expect(table.hydrated().supply.influence[colour]).toBe(general + 1)
        expect(action).toMatchObject({ metadata: { details: { markers: [{ colour }] } } })
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })
})

describe('GuildAction: Knight push offers and preview', () => {
    it('R-4.6.1 offers rows and empty spaces, and "up to" reads the best of them', () => {
        const { table, playerId } = masterTable([R1C1, R1C3, R2C2, R3C1])
        const state = table.hydrated()
        expect(rowsToScrollsOffer(state, 3)).toEqual({
            movable: 2,
            knightRows: [0, 1, 2, 3],
            scrollSpaces: [R1C2, R2C1]
        })
        expect(
            guildActionOffers(state, playerId).find(
                (offer) => offer.guildId === 'knight' && offer.fn === 'push'
            )
        ).toEqual({ guildId: 'knight', fn: 'push', bestVp: 5 })
    })

    it('R-5-H1 previews the counts and points without the vault, and no barrier', () => {
        const { table, playerId } = masterTable([R2C2, R1C1])
        const state = table.hydrated()
        state.vault = undefined
        const input = { guildId: 'knight', fn: 'push' } as const
        expect(
            guildActionPreview(state, playerId, {
                ...input,
                params: { knightRows: [0, 1], scrollSpaces: [R2C1, R3C1] }
            })
        ).toMatchObject({ completions: 2, rows: 2, columns: 1, points: 5, revealsInfo: false })
        expect(
            guildActionPreview(state, playerId, { ...input, params: { knightRows: [0] } })
        ).toMatchObject({
            completions: 0,
            refused: 'Pick one empty scroll space for each marker.'
        })
        expect(
            guildActionPreview(state, playerId, { ...input, params: { knightRows: [0, 0] } })
        ).toBeUndefined()
    })
})
