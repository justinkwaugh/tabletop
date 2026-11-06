import { describe, expect, it } from 'vitest'
import { GuildIds, type GuildId } from '../data/components.js'
import { FarmerPurse, MonkCoffer } from '../data/guilds.js'
import { ProvisionalGuilds } from '../data/provisional.guilds.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { initialState } from '../testing/state.js'
import {
    canCoverWithWildTiles,
    canPayGoods,
    canPayGuild,
    canSpendWildTiles,
    goodsShort,
    guildSplit,
    payGoods,
    payGuild,
    spendWildTiles
} from './payments.js'
import { goodCounts } from './stateSchemas.js'

function table(guild: GuildId, master?: string, journeyman?: string): HydratedFeudumGameState {
    const state = initialState()
    state.supply.shillings = 20
    state.guilds.farmer.purse = 0
    state.guilds.monk.coffer = 0
    for (const player of state.players) {
        player.shillings = 10
    }
    state.guilds.tracks[guild] = {
        ...(master ? { master: { playerId: master, reeve: false } } : {}),
        ...(journeyman ? { journeyman: { playerId: journeyman, reeve: false } } : {})
    }
    return state
}

function charityTotal(state: HydratedFeudumGameState): number {
    return state.guilds.farmer.purse + state.guilds.monk.coffer
}

function shillingsInPlay(state: HydratedFeudumGameState): number {
    return (
        state.supply.shillings +
        charityTotal(state) +
        state.players.reduce((sum, player) => sum + player.shillings, 0)
    )
}

describe('R-4.6.2 paying a guild splits master, journeyman, charity, repeating', () => {
    it.each([
        { price: 0, master: 0, journeyman: 0, charity: 0 },
        { price: 1, master: 1, journeyman: 0, charity: 0 },
        { price: 2, master: 1, journeyman: 1, charity: 0 },
        { price: 3, master: 1, journeyman: 1, charity: 1 },
        { price: 4, master: 2, journeyman: 1, charity: 1 },
        { price: 5, master: 2, journeyman: 2, charity: 1 },
        { price: 6, master: 2, journeyman: 2, charity: 2 },
        { price: 7, master: 3, journeyman: 2, charity: 2 }
    ])('a price of $price', ({ price, master, journeyman, charity }) => {
        const state = table('knight', 'p2', 'p3')
        payGuild(state, 'p1', 'knight', price)

        expect(state.getPlayerState('p1').shillings).toBe(10 - price)
        expect(state.getPlayerState('p2').shillings).toBe(10 + master)
        expect(state.getPlayerState('p3').shillings).toBe(10 + journeyman)
        expect(charityTotal(state)).toBe(charity)
        expect(state.supply.shillings).toBe(20)
    })

    it('an absent master and journeyman leave their shares to the general supply', () => {
        const state = table('merchant')
        payGuild(state, 'p1', 'merchant', 7)

        expect(state.supply.shillings).toBe(25)
        expect(charityTotal(state)).toBe(2)
    })

    it('an absent journeyman alone leaves their share to the general supply', () => {
        const state = table('merchant', 'p2')
        payGuild(state, 'p1', 'merchant', 3)

        expect(state.getPlayerState('p2').shillings).toBe(11)
        expect(state.supply.shillings).toBe(21)
        expect(charityTotal(state)).toBe(1)
    })

    it('an absent master alone leaves their share to the general supply', () => {
        const state = table('merchant', undefined, 'p2')
        payGuild(state, 'p1', 'merchant', 3)

        expect(state.getPlayerState('p2').shillings).toBe(11)
        expect(state.supply.shillings).toBe(21)
        expect(charityTotal(state)).toBe(1)
    })

    it('a member pays themselves, and gets their own share back', () => {
        const state = table('knight', 'p1', 'p2')
        payGuild(state, 'p1', 'knight', 3)

        expect(state.getPlayerState('p1').shillings).toBe(8)
        expect(state.getPlayerState('p2').shillings).toBe(11)
        expect(charityTotal(state)).toBe(1)
    })

    it('a member must hold the full price even though part comes back', () => {
        const state = table('knight', 'p1', 'p2')
        state.getPlayerState('p1').shillings = 2

        expect(canPayGuild(state, 'p1', 3)).toBe(false)
        expect(() => payGuild(state, 'p1', 'knight', 3)).toThrow('R-4.6.2')
        expect(state.getPlayerState('p1').shillings).toBe(2)

        state.getPlayerState('p1').shillings = 3
        expect(canPayGuild(state, 'p1', 3)).toBe(true)
        payGuild(state, 'p1', 'knight', 3)
        expect(state.getPlayerState('p1').shillings).toBe(1)
    })

    it('moves no shilling in or out of play', () => {
        for (const guild of GuildIds) {
            const state = table(guild, 'p2')
            const before = shillingsInPlay(state)
            payGuild(state, 'p1', guild, 5)
            expect(shillingsInPlay(state), guild).toBe(before)
        }
    })

    it('previews what the payment does without doing it', () => {
        const state = table('noble', 'p2')
        const split = guildSplit(state, 'noble', 6)

        expect(split).toEqual({
            members: [{ playerId: 'p2', amount: 2 }],
            charity: { id: ProvisionalGuilds.charity.placeholder.noble, amount: 2 },
            generalSupply: 2
        })
        expect(state.getPlayerState('p2').shillings).toBe(10)
    })
})

describe('R-4.6-H3 the charity share goes where the registry says', () => {
    it.each(GuildIds)('%s', (guild) => {
        const state = table(guild, 'p2', 'p3')
        const charity = ProvisionalGuilds.charity.placeholder[guild]

        payGuild(state, 'p1', guild, 3)

        expect(state.guilds.farmer.purse).toBe(charity === FarmerPurse.id ? 1 : 0)
        expect(state.guilds.monk.coffer).toBe(charity === MonkCoffer.id ? 1 : 0)
    })
})

describe('R-4.3.3, R-4.4-H1 a wild tile covers a good', () => {
    function holding(): HydratedFeudumGameState {
        const state = initialState()
        const player = state.getPlayerState('p1')
        player.regionTiles = ['tile.sea.i', 'tile.forest.ii']
        player.goods = goodCounts({ food: 1 })
        state.supply.haversack = goodCounts({ food: 5, wood: 2 })
        return state
    }

    it('leaves the game for a good of the choice from the haversack', () => {
        const state = holding()
        spendWildTiles(state, 'p1', [{ tileId: 'tile.sea.i', good: 'wood' }])

        const player = state.getPlayerState('p1')
        expect(player.regionTiles).toEqual(['tile.forest.ii'])
        expect(player.goods).toEqual(goodCounts({ food: 1, wood: 1 }))
        expect(state.supply.haversack).toEqual(goodCounts({ food: 5, wood: 1 }))
        expect(state.tilesOutOfGame).toContain('tile.sea.i')
    })

    it('is spent first, so the payment takes the good it brought', () => {
        const state = holding()
        const price = { wood: 1, food: 1 }
        const tiles = [{ tileId: 'tile.sea.i', good: 'wood' }] as const

        expect(canPayGoods(state, 'p1', price)).toBe(false)
        expect(canPayGoods(state, 'p1', price, tiles)).toBe(true)
        payGoods(state, 'p1', price, tiles)

        const player = state.getPlayerState('p1')
        expect(player.goods).toEqual(goodCounts())
        expect(player.regionTiles).toEqual(['tile.forest.ii'])
        expect(state.supply.haversack).toEqual(goodCounts({ food: 6, wood: 2 }))
    })

    it('must be held, and is spent once', () => {
        const state = holding()
        expect(canSpendWildTiles(state, 'p1', [{ tileId: 'tile.desert.i', good: 'food' }])).toBe(
            false
        )
        expect(
            canSpendWildTiles(state, 'p1', [
                { tileId: 'tile.sea.i', good: 'food' },
                { tileId: 'tile.sea.i', good: 'food' }
            ])
        ).toBe(false)
        expect(() =>
            spendWildTiles(state, 'p1', [{ tileId: 'tile.desert.i', good: 'food' }])
        ).toThrow('R-4.3.3')
    })

    it('R-4.3-H2 cannot name a good the haversack does not hold', () => {
        const state = holding()
        expect(canSpendWildTiles(state, 'p1', [{ tileId: 'tile.sea.i', good: 'iron' }])).toBe(false)
        state.supply.haversack = goodCounts({ wood: 1 })
        expect(
            canSpendWildTiles(state, 'p1', [
                { tileId: 'tile.sea.i', good: 'wood' },
                { tileId: 'tile.forest.ii', good: 'wood' }
            ])
        ).toBe(false)
        expect(state.getPlayerState('p1').regionTiles).toHaveLength(2)
    })

    it('never covers shillings', () => {
        const state = table('knight', 'p2', 'p3')
        const player = state.getPlayerState('p1')
        player.shillings = 2
        player.regionTiles = ['tile.sea.i']

        expect(canPayGuild(state, 'p1', 3)).toBe(false)
        expect(canCoverWithWildTiles(state, 'p1', {})).toBe(true)
    })

    it('R-4.4-H1 is offered when a payment falls short and tiles can make it up', () => {
        const state = holding()

        expect(goodsShort(state, 'p1', { food: 2, wood: 1 })).toEqual(
            goodCounts({ food: 1, wood: 1 })
        )
        expect(canCoverWithWildTiles(state, 'p1', { food: 2, wood: 1 })).toBe(true)
        expect(canCoverWithWildTiles(state, 'p1', { food: 3, wood: 1 })).toBe(false)
        expect(canCoverWithWildTiles(state, 'p1', { iron: 1 })).toBe(false)
    })

    it('a payment too short for its tiles changes nothing', () => {
        const state = holding()
        const tiles = [{ tileId: 'tile.sea.i', good: 'wood' }] as const

        expect(() => payGoods(state, 'p1', { wood: 2 }, tiles)).toThrow('R-4.4-H1')
        expect(state.getPlayerState('p1').regionTiles).toHaveLength(2)
        expect(state.supply.haversack.wood).toBe(2)
    })

    it('R-1.4.4 a payment goes to the haversack and conserves the goods', () => {
        const state = holding()
        const player = state.getPlayerState('p1')
        player.goods = goodCounts({ food: 2 })

        payGoods(state, 'p1', { food: 2 })

        expect(player.goods.food).toBe(0)
        expect(state.supply.haversack.food).toBe(7)
    })
})
