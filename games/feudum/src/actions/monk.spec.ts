import { describe, expect, it } from 'vitest'
import type { BeadValue } from '../data/seals.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { beadValue, rosaryBeadSum } from '../model/beads.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import { writDeckCount } from '../model/writDeck.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import {
    setBeads,
    setJourneyman,
    setMaster,
    setScrolls,
    setScrollSeal,
    setShillings,
    tableAtGuild
} from '../testing/guilds.js'
import { canonicalOf } from '../testing/state.js'
import { guildActionOffers, guildActionPreview } from './guildAction.js'
import { cardTurnSeat } from '../model/turns.js'

const Trade = { type: ActionType.GuildAction, guildId: 'monk', fn: 'trade' } as const
const Pull = { type: ActionType.GuildAction, guildId: 'monk', fn: 'pull' } as const
const Push = { type: ActionType.GuildAction, guildId: 'monk', fn: 'push' } as const

const R1C1 = 'guild.noble.scroll.r1c1'
const R1C2 = 'guild.noble.scroll.r1c2'

function setCoffer(state: HydratedFeudumGameState, amount: number): void {
    state.supply.shillings -= amount - state.guilds.monk.coffer
    state.guilds.monk.coffer = amount
}

describe('GuildAction: R-4.6.3 the Monk trade', () => {
    function tradeTable(
        rosary: readonly BeadValue[] = [2, 4, 3],
        shillings = 3,
        edit?: (state: HydratedFeudumGameState, seat: string, rest: readonly string[]) => void
    ) {
        return tableAtGuild((state, seat, rest) => {
            setBeads(state, { rosary, chickens: [] })
            setShillings(state, seat, shillings)
            edit?.(state, seat, rest)
        })
    }

    it('R-4.6.3, R-4.6-H2, R-X.2 S46 3s, the draw kept, the other stays: a barrier', () => {
        const { table, playerId } = tradeTable()
        const before = table.hydrated()
        const rosary = [...before.guilds.monk.rosary]
        const score = table.seat(playerId).score

        const [action] = table.send(playerId, { ...Trade, params: {} })

        const after = table.hydrated()
        const seat = after.getPlayerState(playerId)
        const [bead] = seat.beads
        expect(seat.beads).toHaveLength(1)
        expect(rosary).toContain(bead)
        expect(after.guilds.monk.rosary).toEqual(rosary.filter((held) => held !== bead))
        expect(seat.shillings).toBe(0)
        expect(seat.score).toBe(score)
        expect(seat.guildsUsed).toContain('monk')
        expect(action).toMatchObject({
            revealsInfo: true,
            metadata: {
                details: { kind: 'monk-trade', bead, price: 3 },
                points: 0,
                reevePoints: 0,
                reeveOffered: false,
                drawnWritIds: [],
                payment: { generalSupply: 2, charity: { id: 'guild.farmer.purse', amount: 1 } }
            }
        })
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
        expect(cardTurnSeat(after)).not.toBe(playerId)
    })

    it('R-4.6-H2 the candidates are the highest and the lowest, one of them drawn', () => {
        const { table, playerId } = tradeTable()
        const [action] = table.send(playerId, { ...Trade, params: {} })
        const state = table.hydrated()
        expect(action).toMatchObject({ metadata: { details: { kind: 'monk-trade' } } })
        const [bead] = state.getPlayerState(playerId).beads
        expect([2, 4]).toContain(beadValue(bead))
        expect(rosaryBeadSum(state)).toBe(2 + 4 + 3 - beadValue(bead))
    })

    it("R-4.6.2, R-4.6-H3 the 3s split to master, journeyman and the farmer's purse", () => {
        const { table, playerId, others } = tradeTable([2, 3], 3, (state, _seat, rest) => {
            setJourneyman(state, rest[1], 'monk', rest[0])
        })
        const master = table.seat(others[0]).shillings
        const journeyman = table.seat(others[1]).shillings
        const purse = table.hydrated().guilds.farmer.purse
        const [action] = table.send(playerId, { ...Trade, params: {} })
        expect(table.seat(others[0]).shillings).toBe(master + 1)
        expect(table.seat(others[1]).shillings).toBe(journeyman + 1)
        expect(table.hydrated().guilds.farmer.purse).toBe(purse + 1)
        expect(action).toMatchObject({
            metadata: {
                payment: {
                    members: [
                        { playerId: others[0], amount: 1 },
                        { playerId: others[1], amount: 1 }
                    ],
                    charity: { id: 'guild.farmer.purse', amount: 1 },
                    generalSupply: 0
                }
            }
        })
    })

    it('R-4.6.3 needs 2 beads on the rosary', () => {
        const { table, playerId } = tradeTable([3])
        expect(() => table.send(playerId, { ...Trade, params: {} })).toThrow(
            'The rosary needs at least 2 beads.'
        )
    })

    it('R-4.6.2 needs the 3 shillings', () => {
        const { table, playerId } = tradeTable([2, 3], 2)
        expect(() => table.send(playerId, { ...Trade, params: {} })).toThrow(
            'A bead costs 3 shillings.'
        )
    })

    it('R-4.6-H2 S46 previews both beads, the payment and the barrier, reading no vault', () => {
        const { table, playerId } = tradeTable()
        const state = table.hydrated()
        const projected = table.hydrated()
        projected.vault = undefined
        const input = { guildId: 'monk', fn: 'trade', params: {} } as const
        expect(guildActionPreview(projected, playerId, input)).toMatchObject({
            revealsInfo: true,
            points: 0,
            payment: { generalSupply: 2, charity: { id: 'guild.farmer.purse', amount: 1 } },
            beadDraw: { high: expect.any(String), low: expect.any(String) }
        })
        const preview = guildActionPreview(state, playerId, input)
        expect(preview?.beadDraw && beadValue(preview.beadDraw.high)).toBe(4)
        expect(preview?.beadDraw && beadValue(preview.beadDraw.low)).toBe(2)
    })

    it('R-4.6.3 the preview gives nothing with fewer than 2 beads; the offer dims with why', () => {
        const { table, playerId } = tradeTable([3])
        const state = table.hydrated()
        expect(
            guildActionPreview(state, playerId, { guildId: 'monk', fn: 'trade', params: {} })
        ).toBeUndefined()
        expect(guildActionOffers(state, playerId)).toContainEqual({
            guildId: 'monk',
            fn: 'trade',
            bestVp: 0,
            reason: 'The rosary needs at least 2 beads.'
        })
    })
})

describe('GuildAction: R-4.6.4 the Monk pull', () => {
    function pullTable(rosary: readonly BeadValue[], sealValue: BeadValue) {
        return tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'monk', rest[0])
            setBeads(state, { rosary, chickens: [] })
            setScrolls(state, [R1C1])
            setScrollSeal(state, R1C1, sealValue)
        })
    }

    it('R-4.6.4, R-X.2 the seal flips onto the rosary, reaching 11: 3 vp, 2 writs, a barrier', () => {
        const { table, playerId } = pullTable([4, 4], 3)
        const score = table.seat(playerId).score
        const deck = writDeckCount(table.hydrated())

        const [action] = table.send(playerId, { ...Pull, params: { scrollSpaces: [R1C1] } })

        const state = table.hydrated()
        const flipped = state.guilds.monk.rosary.at(-1)
        expect(state.guilds.monk.rosary).toHaveLength(3)
        expect(flipped && beadValue(flipped)).toBe(3)
        expect(state.guilds.noble.scrolls[R1C1]).toBe(false)
        expect(state.getPlayerState(playerId).score).toBe(score + 3)
        expect(writDeckCount(state)).toBe(deck - 2)
        expect(state.machineState).toBe(MachineState.KeepingWrits)
        expect(action).toMatchObject({
            revealsInfo: true,
            metadata: {
                details: { kind: 'monk-pull', sealIds: [flipped], rosaryTotal: 11 },
                completions: 1,
                points: 3,
                drawnCount: 2,
                keep: 1
            }
        })
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-4.6.4, R-X.2 below 11 no points score, and the flip is still a barrier', () => {
        const { table, playerId } = pullTable([4, 4], 2)
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, { ...Pull, params: { scrollSpaces: [R1C1] } })
        expect(table.seat(playerId).score).toBe(score)
        expect(action).toMatchObject({
            revealsInfo: true,
            metadata: {
                details: { rosaryTotal: 10 },
                completions: 0,
                points: 0,
                reeveOffered: true,
                drawnWritIds: []
            }
        })
    })

    it('R-3.16.1 only the journeyman pulls', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'monk')
            setScrolls(state, [R1C1])
        })
        expect(() => table.send(playerId, { ...Pull, params: { scrollSpaces: [R1C1] } })).toThrow(
            'Only the Monk journeyman pulls.'
        )
    })

    it('R-4.6.1 with no seal on the scrolls the pull is closed', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'monk', rest[0])
            setScrolls(state, [])
        })
        expect(() => table.send(playerId, { ...Pull, params: {} })).toThrow(
            'No seal lies on the scrolls.'
        )
    })

    it('R-4.6.4 flips exactly one seal that lies on the scrolls', () => {
        const { table, playerId } = pullTable([4, 4], 3)
        const send = (scrollSpaces: (typeof R1C1 | typeof R1C2)[]) =>
            table.send(playerId, { ...Pull, params: { scrollSpaces } })
        expect(() => send([])).toThrow('Pick a seal on the scrolls.')
        expect(() => send([R1C2])).toThrow('No seal lies on that scroll space.')
        expect(() => send([R1C1, R1C2])).toThrow('Flip at most 1 seal.')
    })

    it('R-4.6.4, R-5-H1 previews both ends of the flip, reading no vault', () => {
        const { table, playerId } = pullTable([5, 4], 3)
        const projected = table.hydrated()
        projected.vault = undefined
        const input = { guildId: 'monk', fn: 'pull', params: {} } as const
        // Staged with no pick: refused still, but the reach is read. Lowest unseen 2, highest 4.
        expect(guildActionPreview(projected, playerId, input)).toMatchObject({
            revealsInfo: true,
            completions: 1,
            points: 3,
            drawnCount: 2,
            refused: 'Pick a seal on the scrolls.',
            sealFlip: {
                rosaryTotal: 9,
                flips: 1,
                lowestTotal: 11,
                highestTotal: 13,
                ifLowest: { points: 3, drawnCount: 2 }
            }
        })
    })

    it('R-4.6.4 names what the best seal can reach in the offer', () => {
        const reaches = pullTable([5, 4], 3)
        expect(guildActionOffers(reaches.table.hydrated(), reaches.playerId)).toContainEqual({
            guildId: 'monk',
            fn: 'pull',
            bestVp: 3
        })
        const short = pullTable([2], 3)
        expect(guildActionOffers(short.table.hydrated(), short.playerId)).toContainEqual({
            guildId: 'monk',
            fn: 'pull',
            bestVp: 0
        })
    })
})

describe('GuildAction: R-4.6.5 the Monk push', () => {
    function pushTable(
        rosary: readonly BeadValue[],
        chickens: readonly BeadValue[],
        coffer = 0,
        edit?: (state: HydratedFeudumGameState, seat: string, rest: readonly string[]) => void
    ) {
        return tableAtGuild((state, seat, rest) => {
            setMaster(state, seat, 'monk')
            setBeads(state, { rosary, chickens })
            setCoffer(state, coffer)
            edit?.(state, seat, rest)
        })
    }

    it.each<{
        rosary: readonly BeadValue[]
        chickens: readonly BeadValue[]
        total: number
        level: number
        vp: number
    }>([
        { rosary: [2, 2], chickens: [], total: 2, level: 0, vp: 0 },
        { rosary: [3, 3], chickens: [], total: 3, level: 1, vp: 4 },
        { rosary: [2, 2], chickens: [3], total: 5, level: 1, vp: 4 },
        { rosary: [3, 3], chickens: [3], total: 6, level: 2, vp: 5 },
        { rosary: [3, 3], chickens: [3, 2], total: 8, level: 2, vp: 5 },
        { rosary: [2, 2], chickens: [4, 3], total: 9, level: 3, vp: 6 }
    ])(
        'R-4.6.5, R-4.6-H2 chickens at $total: level $level, $vp vp',
        ({ rosary, chickens, total, level, vp }) => {
            const { table, playerId } = pushTable(rosary, chickens)
            const before = table.hydrated().guilds.monk.rosary
            const score = table.seat(playerId).score

            const [action] = table.send(playerId, { ...Push, params: {} })

            const state = table.hydrated()
            const space = `guild.farmer.chicken.${chickens.length + 1}` as const
            const placed = state.guilds.farmer.chickens[space]
            expect(placed).not.toBeNull()
            expect(before).toContain(placed)
            expect(state.guilds.monk.rosary).toHaveLength(before.length - 1)
            expect(action).toMatchObject({
                revealsInfo: true,
                metadata: { details: { kind: 'monk-push', chicken: space, bead: placed } }
            })
            expect(state.getPlayerState(playerId).score).toBe(score + vp)
            expect(action).toMatchObject({
                metadata: {
                    details: { chickenSum: total },
                    completions: level,
                    points: vp
                }
            })
            expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
        }
    )

    it('R-4.6.5, R-X.2, R-4.7-H1 a push reaching nothing is still a barrier, and a reeve is offered', () => {
        const { table, playerId } = pushTable([2, 2], [])
        const [action] = table.send(playerId, { ...Push, params: {} })
        expect(action).toMatchObject({
            revealsInfo: true,
            metadata: { completions: 0, points: 0, reeveOffered: true }
        })
        expect(table.hydrated().machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.7 a push that scores offers the reeve', () => {
        const { table, playerId } = pushTable([3, 3], [])
        const [action] = table.send(playerId, { ...Push, params: {} })
        expect(action).toMatchObject({ metadata: { reeveOffered: true } })
        expect(table.hydrated().machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.6.5 splits the coffer with the journeyman, the odd shilling to the master', () => {
        const { table, playerId, others } = pushTable([2, 2], [], 5, (state, seat, rest) => {
            setJourneyman(state, rest[0], 'monk', seat)
        })
        const mine = table.seat(playerId).shillings
        const theirs = table.seat(others[0]).shillings
        const [action] = table.send(playerId, { ...Push, params: {} })
        expect(table.seat(playerId).shillings).toBe(mine + 3)
        expect(table.seat(others[0]).shillings).toBe(theirs + 2)
        expect(table.hydrated().guilds.monk.coffer).toBe(0)
        expect(action).toMatchObject({
            metadata: {
                split: {
                    pot: 'guild.monk.coffer',
                    shares: [
                        { playerId, amount: 3 },
                        { playerId: others[0], amount: 2 }
                    ],
                    stays: 0
                }
            }
        })
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-4.6.5 with no journeyman, that half stays in the coffer', () => {
        const { table, playerId } = pushTable([2, 2], [], 5, (state) => {
            delete state.guilds.tracks.monk.journeyman
        })
        const mine = table.seat(playerId).shillings
        const [action] = table.send(playerId, { ...Push, params: {} })
        expect(table.seat(playerId).shillings).toBe(mine + 3)
        expect(table.hydrated().guilds.monk.coffer).toBe(2)
        expect(action).toMatchObject({ metadata: { split: { stays: 2 } } })
    })

    it('R-4.6.5 needs 2 beads on the rosary', () => {
        const { table, playerId } = pushTable([3], [])
        expect(() => table.send(playerId, { ...Push, params: {} })).toThrow(
            'The rosary needs at least 2 beads.'
        )
    })

    it('R-4.6.5 needs an empty chicken', () => {
        const { table, playerId } = pushTable([2, 2], [2, 2, 2, 2])
        expect(() => table.send(playerId, { ...Push, params: {} })).toThrow('No chicken is empty.')
    })

    it('R-3.16.1 only the master pushes', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'monk', rest[0])
            setBeads(state, { rosary: [2, 2], chickens: [] })
        })
        expect(() => table.send(playerId, { ...Push, params: {} })).toThrow(
            'Only the Monk master pushes.'
        )
    })

    it('R-4.6.5, R-4.6-H2 previews both beads and the split, changing nothing and reading no vault', () => {
        const { table, playerId, others } = pushTable([2, 4], [2], 5, (state, seat, rest) => {
            setJourneyman(state, rest[0], 'monk', seat)
        })
        const projected = table.hydrated()
        projected.vault = undefined
        const before = table.seat(playerId).shillings
        const preview = guildActionPreview(projected, playerId, {
            guildId: 'monk',
            fn: 'push',
            params: {}
        })
        expect(preview).toMatchObject({
            revealsInfo: true,
            completions: 2,
            points: 5,
            split: {
                pot: 'guild.monk.coffer',
                shares: [
                    { playerId, amount: 3 },
                    { playerId: others[0], amount: 2 }
                ],
                stays: 0
            },
            beadDraw: { ifLow: { completions: 1, points: 4 } }
        })
        expect(projected.getPlayerState(playerId).shillings).toBe(before)
        expect(projected.guilds.monk.coffer).toBe(5)
    })

    it('R-4.6.5 gives no preview without a bead or a chicken, and dims the offer with why', () => {
        const { table, playerId } = pushTable([2, 2], [2, 2, 2, 2])
        const state = table.hydrated()
        expect(
            guildActionPreview(state, playerId, { guildId: 'monk', fn: 'push', params: {} })
        ).toBeUndefined()
        expect(guildActionOffers(state, playerId)).toContainEqual({
            guildId: 'monk',
            fn: 'push',
            bestVp: 6,
            reason: 'No chicken is empty.'
        })
    })

    it('R-4.6.5 names the best the high bead can reach', () => {
        const { table, playerId } = pushTable([2, 4], [2])
        expect(guildActionOffers(table.hydrated(), playerId)).toContainEqual({
            guildId: 'monk',
            fn: 'push',
            bestVp: 5
        })
    })
})
