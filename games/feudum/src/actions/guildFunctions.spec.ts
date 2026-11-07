import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { writDeckCount } from '../model/writDeck.js'
import {
    ruleFarm,
    setBarn,
    setBeads,
    setJourneyman,
    setMarket,
    setMaster,
    setPawns,
    tableAtGuild
} from '../testing/guilds.js'
import {
    GuildAction,
    guildActionOffers,
    guildActionPreview,
    reasonGuildActionRefused
} from './guildAction.js'

const FarmerPush = { type: ActionType.GuildAction, guildId: 'farmer', fn: 'push' } as const
const FarmerPull = { type: ActionType.GuildAction, guildId: 'farmer', fn: 'pull' } as const

/** Every bin full but the last space of the three named; the barn holds exactly those goods. */
function threeBinsOpen(state: HydratedFeudumGameState): void {
    setMarket(state, { saltpeter: 3, sulfur: 3, iron: 3, wood: 4, food: 4 })
    setBarn(state, { saltpeter: 1, sulfur: 1, iron: 1 })
}

describe('GuildAction: R-3.16.2 a guild not used this round', () => {
    it('R-3.16.2 records the guild used', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            threeBinsOpen(state)
        })
        table.send(playerId, { ...FarmerPush, params: { goods: ['saltpeter', 'sulfur', 'iron'] } })
        expect(table.seat(playerId).guildsUsed).toEqual(['farmer'])
    })

    it('R-3.16.2 a guild used this round is refused, a feast counting as using it', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            threeBinsOpen(state)
            // What a feast leaves behind.
            state.getPlayerState(seat).guildsUsed = ['farmer']
        })
        expect(() =>
            table.send(playerId, {
                ...FarmerPush,
                params: { goods: ['saltpeter', 'sulfur', 'iron'] }
            })
        ).toThrow('You have already used the Farmer Guild this round.')
    })

    it('R-3.16.2 Repeat replaying Guild must use a different guild', () => {
        const { table, playerId } = tableAtGuild(
            (state, seat) => {
                setMaster(state, seat, 'farmer')
                threeBinsOpen(state)
                const player = state.getPlayerState(seat)
                player.played = [{ kind: 'guild', use: 'regular' }]
                player.guildsUsed = ['farmer']
            },
            ['repeat', 'move', 'tax']
        )
        expect(() =>
            table.send(playerId, {
                ...FarmerPush,
                asRepeat: 'repeat',
                params: { goods: ['saltpeter', 'sulfur', 'iron'] }
            })
        ).toThrow('You have already used the Farmer Guild this round.')
    })

    it('R-3.2 the Guild card must be in the hand, and the Action is offered with it', () => {
        const held = tableAtGuild()
        expect(held.table.offered(held.playerId)).toContain(ActionType.GuildAction)
        const without = tableAtGuild(() => {}, ['move', 'tax'])
        expect(without.table.offered(without.playerId)).not.toContain(ActionType.GuildAction)
        expect(() => without.table.send(without.playerId, { ...FarmerPull, params: {} })).toThrow(
            "Guild isn't in your hand."
        )
    })

    it('R-3.16 is in the API action schemas', () => {
        expect(FeudumApiActions[ActionType.GuildAction]).toBe(GuildAction)
    })
})

describe('GuildAction: R-3.16.1 who may perform which function', () => {
    it('R-3.16.1 only the journeyman pulls and only the master pushes', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [2, 3], chickens: [] })
            threeBinsOpen(state)
        })
        const state = table.hydrated()
        const push = { guildId: 'farmer', fn: 'push', params: {} } as const
        const pull = { guildId: 'farmer', fn: 'pull', params: {} } as const
        expect(reasonGuildActionRefused(state, playerId, push)).toBe(
            'Only the Farmer master pushes.'
        )
        expect(reasonGuildActionRefused(state, playerId, pull)).toBeUndefined()
    })

    it('R-3.16.1 the master does not pull', () => {
        const { table, playerId } = tableAtGuild((state, seat) => setMaster(state, seat, 'farmer'))
        expect(() => table.send(playerId, { ...FarmerPull, params: {} })).toThrow(
            'Only the Farmer journeyman pulls.'
        )
    })

    it('R-3.16.1 a seat with no rank anywhere may still trade', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setPawns(state, seat, [])
            state.recomputeRanks(seat)
            ruleFarm(state, seat, { wood: 2 })
        })
        expect(table.hydrated().guilds.tracks.farmer.master?.playerId).not.toBe(playerId)
        const [offer] = guildActionOffers(table.hydrated(), playerId)
        expect(offer).toMatchObject({ guildId: 'farmer', fn: 'trade' })
        expect(offer.reason).toBeUndefined()
    })
})

describe('GuildAction: R-4.6.1, R-4.6-H5 moves as many as fit and scores the level', () => {
    it('R-4.6-H5 moves fewer than stated when only that many fit, and scores what it reached', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { saltpeter: 3, sulfur: 4, iron: 4, wood: 4, food: 4 })
            setBarn(state, { saltpeter: 3, iron: 5 })
        })
        const [action] = table.send(playerId, { ...FarmerPush, params: { goods: ['saltpeter'] } })
        const state = table.hydrated()
        expect(state.guilds.merchant.market['guild.merchant.space.saltpeter-4']).toBe(true)
        expect(state.guilds.farmer.barn.saltpeter).toBe(2)
        // One bin and one space-number line complete; either counts once.
        expect(action).toMatchObject({ metadata: { completions: 1, points: 4 } })
    })

    it('R-4.6.1 at least one must move: with no room the function is closed', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { saltpeter: 4, sulfur: 4, iron: 4, wood: 4, food: 4 })
            setBarn(state, { wood: 5 })
        })
        expect(() => table.send(playerId, { ...FarmerPush, params: { goods: ['wood'] } })).toThrow(
            'No barn good fits in the market.'
        )
        const offer = guildActionOffers(table.hydrated(), playerId).find(({ fn }) => fn === 'push')
        expect(offer?.reason).toBe('No barn good fits in the market.')
    })

    it('R-4.6.1, R-4.6-H5 must move as many as fit: fewer is refused', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 3, wood: 3, food: 3 })
            setBarn(state, { saltpeter: 2, wood: 1 })
        })
        expect(() => table.send(playerId, { ...FarmerPush, params: { goods: ['wood'] } })).toThrow(
            '2 goods fit: move them all.'
        )
    })

    it('R-4.6.5 a push takes at most its stated number', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, {})
            setBarn(state, { wood: 4, iron: 4 })
        })
        expect(() =>
            table.send(playerId, {
                ...FarmerPush,
                params: { goods: ['wood', 'wood', 'wood', 'wood', 'iron', 'iron'] }
            })
        ).toThrow('Move at most 5 goods.')
    })

    it('R-4.6.1 a good the barn lacks, or its bin has no room for, is refused', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { wood: 3 })
            setBarn(state, { wood: 3, iron: 1 })
        })
        expect(() =>
            table.send(playerId, { ...FarmerPush, params: { goods: ['iron', 'iron'] } })
        ).toThrow('The barn holds only 1 iron.')
        expect(() =>
            table.send(playerId, { ...FarmerPush, params: { goods: ['wood', 'wood', 'iron'] } })
        ).toThrow('The wood bin has room for 1.')
    })

    it('R-4.6.1 counts rows or columns, never both, as the actor chooses', () => {
        const edit = (state: HydratedFeudumGameState, seat: string) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 3, wood: 3, food: 3 })
            setBarn(state, { saltpeter: 1, sulfur: 1, iron: 1, wood: 1, food: 1 })
        }
        const goods = ['saltpeter', 'sulfur', 'iron', 'wood', 'food']

        const byRows = tableAtGuild(edit)
        const [rows] = byRows.table.send(byRows.playerId, {
            ...FarmerPush,
            params: { goods, count: 'rows' }
        })
        expect(rows).toMatchObject({
            metadata: { completions: 5, points: 6, details: { rows: 5, columns: 1, count: 'rows' } }
        })

        const byColumns = tableAtGuild(edit)
        const [columns] = byColumns.table.send(byColumns.playerId, {
            ...FarmerPush,
            params: { goods, count: 'columns' }
        })
        expect(columns).toMatchObject({
            metadata: {
                completions: 1,
                points: 4,
                details: { rows: 5, columns: 1, count: 'columns' }
            }
        })
    })

    it('R-4.6.1 with no count named, the higher of the two scores', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            threeBinsOpen(state)
        })
        const [action] = table.send(playerId, {
            ...FarmerPush,
            params: { goods: ['saltpeter', 'sulfur', 'iron'] }
        })
        expect(action).toMatchObject({
            metadata: { completions: 3, details: { rows: 3, columns: 1, count: 'rows' } }
        })
    })

    it('R-4.6.1 only lines this action completed count', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            // Wood and food are full already, and space 3 of each bin but one is filled.
            setMarket(state, { saltpeter: 2, sulfur: 3, iron: 3, wood: 4, food: 4 })
            setBarn(state, { saltpeter: 1 })
        })
        const [action] = table.send(playerId, {
            ...FarmerPush,
            params: { goods: ['saltpeter'] }
        })
        expect(action).toMatchObject({
            metadata: { completions: 1, points: 4, details: { rows: 0, columns: 1 } }
        })
    })
})

describe('GuildAction: R-4.6.5 a push scores 4/5/6', () => {
    it.each([
        {
            fills: ['saltpeter'],
            market: { saltpeter: 3, sulfur: 4, iron: 4, wood: 2, food: 2 },
            vp: 4
        },
        {
            fills: ['saltpeter', 'sulfur'],
            market: { saltpeter: 3, sulfur: 3, iron: 4, wood: 2, food: 2 },
            vp: 5
        },
        {
            fills: ['saltpeter', 'sulfur', 'iron'],
            market: { saltpeter: 3, sulfur: 3, iron: 3, wood: 2, food: 2 },
            vp: 6
        }
    ])('R-4.6.5 $fills.length completed scores $vp', ({ fills, market, vp }) => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, market)
            const barn = Object.fromEntries(fills.map((good) => [good, 1]))
            setBarn(state, barn)
        })
        const before = table.seat(playerId).score
        const [action] = table.send(playerId, {
            ...FarmerPush,
            params: { goods: fills, count: 'rows' }
        })
        expect(action).toMatchObject({
            metadata: { completions: fills.length, points: vp, reevePoints: 0 }
        })
        expect(table.seat(playerId).score).toBe(before + vp)
    })

    it('R-4.6.1, R-4.6.5 a push reaching nothing scores 0, with no writ, and is no barrier', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { saltpeter: 1, sulfur: 1, iron: 1, wood: 1, food: 1 })
            setBarn(state, { wood: 1 })
        })
        const before = table.seat(playerId).score
        const deck = writDeckCount(table.hydrated())
        const [action] = table.send(playerId, { ...FarmerPush, params: { goods: ['wood'] } })
        expect(action).toMatchObject({ metadata: { completions: 0, points: 0, reevePoints: 0 } })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.seat(playerId).score).toBe(before)
        expect(writDeckCount(table.hydrated())).toBe(deck)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })
})

describe('GuildAction: R-4.6.5 the Farmer push moves goods and splits the purse', () => {
    it('R-4.6.5 goods leave the barn for their bins, lowest empty space first', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { wood: 1 })
            setBarn(state, { wood: 2 })
        })
        const [action] = table.send(playerId, {
            ...FarmerPush,
            params: { goods: ['wood', 'wood'] }
        })
        const { market } = table.hydrated().guilds.merchant
        expect(market['guild.merchant.space.wood-2']).toBe(true)
        expect(market['guild.merchant.space.wood-3']).toBe(true)
        expect(market['guild.merchant.space.wood-4']).toBe(false)
        expect(table.hydrated().guilds.farmer.barn.wood).toBe(0)
        expect(action).toMatchObject({
            metadata: {
                details: {
                    kind: 'farmer-push',
                    spaces: ['guild.merchant.space.wood-2', 'guild.merchant.space.wood-3']
                }
            }
        })
    })

    it('R-4.6.5 splits the purse with the journeyman, the odd shilling to the master', () => {
        const { table, playerId, others } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, rest[0], 'farmer', seat)
            setMarket(state, { wood: 3 })
            setBarn(state, { wood: 1 })
            state.supply.shillings -= 5
            state.guilds.farmer.purse = 5
        })
        const master = table.seat(playerId).shillings
        const journeyman = table.seat(others[0]).shillings
        const [action] = table.send(playerId, { ...FarmerPush, params: { goods: ['wood'] } })
        expect(table.seat(playerId).shillings).toBe(master + 3)
        expect(table.seat(others[0]).shillings).toBe(journeyman + 2)
        expect(table.hydrated().guilds.farmer.purse).toBe(0)
        expect(action).toMatchObject({
            metadata: {
                split: {
                    pot: 'guild.farmer.purse',
                    shares: [
                        { playerId, amount: 3 },
                        { playerId: others[0], amount: 2 }
                    ],
                    stays: 0
                }
            }
        })
    })

    it('R-4.6.5 with no journeyman, that half stays in the purse', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setMaster(state, seat, 'farmer')
            for (const other of rest) {
                setPawns(state, other, [])
            }
            state.recomputeRanks(seat)
            setMarket(state, { wood: 3 })
            setBarn(state, { wood: 1 })
            state.supply.shillings -= 5
            state.guilds.farmer.purse = 5
        })
        expect(table.hydrated().guilds.tracks.farmer.journeyman).toBeUndefined()
        const master = table.seat(playerId).shillings
        const [action] = table.send(playerId, { ...FarmerPush, params: { goods: ['wood'] } })
        expect(table.seat(playerId).shillings).toBe(master + 3)
        expect(table.hydrated().guilds.farmer.purse).toBe(2)
        expect(action).toMatchObject({ metadata: { split: { stays: 2 } } })
    })
})

describe('GuildAction: preview', () => {
    it('R-4.6.5 a Farmer push previews the market spaces each good would land in', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setBarn(state, { iron: 1, wood: 1 })
            setMarket(state, {})
        })
        const preview = guildActionPreview(table.hydrated(), playerId, {
            guildId: 'farmer',
            fn: 'push',
            params: { goods: ['iron', 'wood'] }
        })
        expect(preview?.details).toMatchObject({
            kind: 'farmer-push',
            spaces: ['guild.merchant.space.iron-1', 'guild.merchant.space.wood-1']
        })
    })

    it('R-4.6.5, R-4.6.1 gives points, completions, the split, reeve points and no barrier', () => {
        const { table, playerId, others } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, rest[0], 'farmer', seat)
            threeBinsOpen(state)
            state.supply.shillings -= 3
            state.guilds.farmer.purse = 3
        })
        const state = table.hydrated()
        const before = state.dehydrate()
        const preview = guildActionPreview(state, playerId, {
            guildId: 'farmer',
            fn: 'push',
            params: { goods: ['saltpeter', 'sulfur', 'iron'] }
        })
        expect(preview).toMatchObject({
            completions: 3,
            rows: 3,
            columns: 1,
            points: 6,
            reevePoints: 1,
            reeveOffered: true,
            drawnCount: 0,
            revealsInfo: false,
            split: {
                pot: 'guild.farmer.purse',
                shares: [
                    { playerId, amount: 2 },
                    { playerId: others[0], amount: 1 }
                ],
                stays: 0
            }
        })
        expect(preview?.refused).toBeUndefined()
        // The preview works on a copy.
        expect(state.dehydrate()).toEqual(before)
    })

    it('R-4.6-H5 reads a staged input short of the count, naming what still refuses it', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            threeBinsOpen(state)
        })
        expect(
            guildActionPreview(table.hydrated(), playerId, {
                guildId: 'farmer',
                fn: 'push',
                params: { goods: ['saltpeter'] }
            })
        ).toMatchObject({
            completions: 1,
            points: 4,
            refused: '3 goods fit: move them all.'
        })
    })

    it('R-4.6.1 gives nothing for picks that cannot happen', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { wood: 4 })
            setBarn(state, { wood: 1 })
        })
        expect(
            guildActionPreview(table.hydrated(), playerId, {
                guildId: 'farmer',
                fn: 'push',
                params: { goods: ['wood'] }
            })
        ).toBeUndefined()
    })

    it('R-5-H1 reads no vault and draws nothing, so a projected state can preview', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [2, 3], chickens: [3] })
        })
        const state = table.hydrated()
        state.vault = undefined
        const before = state.dehydrate()
        expect(
            guildActionPreview(state, playerId, { guildId: 'farmer', fn: 'pull', params: {} })
        ).toMatchObject({ drawnCount: 2, points: 3, revealsInfo: true })
        expect(state.dehydrate()).toEqual(before)
    })
})

describe('GuildAction: offers', () => {
    it('R-3.16.2 leaves out a guild used this round, and dims a function with its reason', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [3, 4], chickens: [] })
        })
        const offers = guildActionOffers(table.hydrated(), playerId)
        expect(offers.find(({ fn }) => fn === 'pull')?.reason).toBeUndefined()
        expect(offers.find(({ fn }) => fn === 'push')?.reason).toBe(
            'Only the Farmer master pushes.'
        )

        const used = table.hydrated()
        used.getPlayerState(playerId).guildsUsed = ['farmer']
        expect(guildActionOffers(used, playerId).filter((o) => o.guildId === 'farmer')).toEqual([])
    })

    it('R-4.6.5 names the best a push can reach', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            threeBinsOpen(state)
        })
        expect(
            guildActionOffers(table.hydrated(), playerId).find(({ fn }) => fn === 'push')?.bestVp
        ).toBe(6)
    })
})
