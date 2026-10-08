import { describe, expect, it } from 'vitest'
import { BonusChit } from '../components/bonusChits.js'
import { GOODS, Good, goodCounts, noGoods } from '../components/goods.js'
import { cityGood } from '../components/cities.js'
import { SailRouteKind } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { chooseStarts, edit, hydrated, newTable, play, type Table } from './testSupport.js'

const nothing = { goods: noGoods(), markers: [] }

function bidAround(table: Table, bids: Record<string, number[]>) {
    while (table.state.machineState === MachineState.Bidding) {
        const [playerId] = table.state.activePlayerIds
        play(table, playerId, { type: ActionType.PlaceBid, markers: bids[playerId] })
    }
}

function tableAtTurn(): Table {
    const table = newTable(3)
    chooseStarts(table, [1, 4, 7])
    bidAround(table, { p0: [0], p1: [1], p2: [2] })
    play(table, table.state.activePlayerIds[0], { type: ActionType.MoveGuildMaster, steps: 1 })
    return table
}

function setRoutes(table: Table, city: number, routes: number[]) {
    edit(table, (state) => {
        state.cities[city].routes = routes.map((value) => ({ value }))
    })
}

describe('start cities', () => {
    it('makes every player who picked an overfull city choose again', () => {
        const table = newTable(4)
        chooseStarts(table, [5, 5, 5, 2])
        expect(table.state.machineState).toBe(MachineState.ChoosingStartCities)
        expect(table.state.activePlayerIds).toEqual(['p0', 'p1', 'p2'])
        expect(table.state.cities[2].offices.map((office) => office.playerId)).toEqual(['p3'])
        const state = hydrated(table)
        expect(state.startCityOptions('p0')).not.toContain(5)
        expect(state.getPlayerState('p3').markerCount).toBe(8)
    })

    it('orders the first auction from the lowest start city', () => {
        const table = newTable(3)
        chooseStarts(table, [6, 0, 3])
        expect(table.state.machineState).toBe(MachineState.Bidding)
        expect(table.state.turnManager.turnOrder).toEqual(['p1', 'p2', 'p0'])
        expect(table.state.offer).toHaveLength(4)
    })
})

describe('the auction', () => {
    it('supplies offices first and orders players by their bids', () => {
        const table = newTable(3)
        chooseStarts(table, [1, 4, 7])
        edit(table, (state) => {
            state.supply = goodCounts({ [Good.Ore]: 10, [Good.Fur]: 10, [Good.Salt]: 10 })
            for (const player of state.players) {
                player.markers = [0, 4, 7, 7]
                player.markerCount = 4
            }
        })
        const cityGoodsBefore = table.state.cities[4].goods[Good.Fur]
        bidAround(table, { p0: [4], p1: [4, 0], p2: [7, 7] })
        expect(table.state.turnManager.turnOrder).toEqual(['p2', 'p1', 'p0'])
        expect(table.state.cities[4].offices[0].goods).toBe(1)
        expect(table.state.cities[4].goods[Good.Fur]).toBe(cityGoodsBefore + 3)
        expect(table.state.cities[7].offices[0].goods).toBe(1)
        expect(table.state.machineState).toBe(MachineState.MovingGuildMaster)
    })

    it('supplies the highest-numbered city first when goods run short', () => {
        const table = newTable(2)
        chooseStarts(table, [1, 2])
        edit(table, (state) => {
            state.supply = goodCounts({ [Good.Fur]: 3 })
        })
        bidAround(table, { p0: [3], p1: [4] })
        expect(table.state.cities[4].goods[Good.Fur]).toBe(5)
        expect(table.state.cities[3].goods[Good.Fur]).toBe(4)
    })
})

describe('the guild master', () => {
    it('skips raided cities and ends the game on his second lap', () => {
        const table = newTable(2)
        chooseStarts(table, [1, 2])
        edit(table, (state) => {
            state.guildMaster = { city: 3, startCity: 4, distance: 15 }
            state.cities[4].raiders = ['p1']
        })
        bidAround(table, { p0: [0], p1: [1] })
        const [first] = table.state.activePlayerIds
        play(table, first, { type: ActionType.MoveGuildMaster, steps: 2 })
        expect(table.state.guildMaster.city).toBe(6)
        expect(table.state.machineState).toBe(MachineState.EndOfGame)
    })
})

describe('sailing', () => {
    it('charges for every move after the first', () => {
        const table = tableAtTurn()
        const playerId = table.state.activePlayerIds[0]
        const city = hydrated(table).getPlayerState(playerId).location()
        const next = (city + 1) % 9
        setRoutes(table, city, [next, (city + 2) % 9])
        setRoutes(table, next, [(next + 1) % 9, (next + 2) % 9])
        const route = { kind: SailRouteKind.Route, slot: 0 }
        play(table, playerId, { type: ActionType.Sail, route, payment: nothing })
        expect(hydrated(table).moveCost(playerId, false)).toBe(1)
        expect(() =>
            play(table, playerId, { type: ActionType.Sail, route, payment: nothing })
        ).toThrow()
        play(table, playerId, {
            type: ActionType.Sail,
            route,
            payment: { goods: goodCounts({ [Good.Ore]: 1 }), markers: [] }
        })
        expect(hydrated(table).getPlayerState(playerId).location()).toBe((next + 1) % 9)
    })

    it('makes the second move free with the bonus and the secret passage cost one more', () => {
        const table = tableAtTurn()
        const playerId = table.state.activePlayerIds[0]
        edit(table, (state) => {
            const player = state.players.find((candidate) => candidate.playerId === playerId)
            player?.bonusChits.push(BonusChit.MoveTwo, BonusChit.SecretPassage)
        })
        const state = hydrated(table)
        expect(state.moveCost(playerId, false)).toBe(0)
        expect(state.moveCost(playerId, true)).toBe(1)
        state.activeTurn(playerId).moves = 1
        expect(state.moveCost(playerId, false)).toBe(0)
        expect(state.moveCost(playerId, true)).toBe(1)
        state.activeTurn(playerId).moves = 2
        expect(state.moveCost(playerId, false)).toBe(1)
        expect(state.moveCost(playerId, true)).toBe(2)
    })

    it('ends the movement when a hidden marker leads into an own raided city', () => {
        const table = tableAtTurn()
        const playerId = table.state.activePlayerIds[0]
        const city = hydrated(table).getPlayerState(playerId).location()
        const banned = (city + 3) % 9
        edit(table, (state) => {
            state.cities[city].routes[0] = { hidden: { playerId: 'someone', value: banned } }
            state.cities[banned].raiders = [playerId]
        })
        const [sail] = play(table, playerId, {
            type: ActionType.Sail,
            route: { kind: SailRouteKind.Route, slot: 0 },
            payment: nothing
        })
        expect(sail.revealsInfo).toBe(true)
        const state = hydrated(table)
        expect(state.getPlayerState(playerId).location()).toBe(city)
        expect(state.cities[city].routes[0]).toEqual({ value: banned })
        expect(state.sailOptions(playerId)).toEqual([])
    })
})

describe('trading with a city', () => {
    it('needs a move to another city and goods of different kinds', () => {
        const table = tableAtTurn()
        const playerId = table.state.activePlayerIds[0]
        const state = hydrated(table)
        expect(state.canTradeGoods(playerId)).toBe(false)
        const turn = state.activeTurn(playerId)
        turn.moves = 1
        const player = state.getPlayerState(playerId)
        const market = state.cogCity(playerId).goods
        market[Good.Amber] = 3
        market[Good.Ore] = 3
        turn.startCity = (player.location() + 1) % 9
        expect(state.canTradeGoods(playerId)).toBe(true)
        const give = goodCounts({ [Good.Ore]: 1 })
        expect(state.isValidTrade(playerId, give, goodCounts({ [Good.Amber]: 2 }))).toBe(true)
        expect(state.isValidTrade(playerId, give, goodCounts({ [Good.Amber]: 3 }))).toBe(false)
        expect(state.isValidTrade(playerId, give, goodCounts({ [Good.Ore]: 2 }))).toBe(false)
        expect(state.isValidTrade(playerId, give, noGoods())).toBe(false)
    })
})

describe('offices', () => {
    it('costs the three foreign goods and one or two markers of the city', () => {
        const table = tableAtTurn()
        const playerId = table.state.activePlayerIds[0]
        const state = hydrated(table)
        const city = state.getPlayerState(playerId).location()
        const cost = state.officeCost(city)
        expect(cost.markers).toEqual([city, city])
        expect(GOODS.map((good) => cost.goods[good])).toEqual(
            GOODS.map((good) => (good === cityGood(city) ? 0 : 1))
        )
        expect(state.officeCost((city + 1) % 9).markers).toEqual([(city + 1) % 9])
    })

    it('wins at once with a fifth development point', () => {
        const table = tableAtTurn()
        const playerId = table.state.activePlayerIds[0]
        edit(table, (state) => {
            const player = state.players.find((candidate) => candidate.playerId === playerId)
            if (!player) {
                throw Error('missing player')
            }
            player.bonusChits = [BonusChit.ThreeForOne, BonusChit.MoveTwo, BonusChit.MoveTwo]
            player.goods = goodCounts({
                [Good.Ore]: 1,
                [Good.Fur]: 1,
                [Good.Amber]: 1,
                [Good.Salt]: 1
            })
            const city = player.city ?? 0
            player.markers = [city, city]
            player.markerCount = 2
        })
        play(table, playerId, { type: ActionType.BuildOffice })
        expect(table.state.machineState).toBe(MachineState.EndOfGame)
        expect(table.state.winningPlayerIds).toEqual([playerId])
    })
})

describe('raids', () => {
    it('lets the victim split the cargo, the robber choose and the next player expel', () => {
        const table = tableAtTurn()
        const [raiderId] = table.state.activePlayerIds
        const victimId = table.state.turnManager.turnOrder.find((id) => id !== raiderId) ?? ''
        edit(table, (state) => {
            const raider = state.players.find((player) => player.playerId === raiderId)
            const victim = state.players.find((player) => player.playerId === victimId)
            if (!raider || !victim) {
                throw Error('missing players')
            }
            victim.city = raider.city
            victim.goods = goodCounts({ [Good.Salt]: 3, [Good.Ore]: 2 })
        })
        play(table, raiderId, { type: ActionType.RaidCog, victimId })
        expect(table.state.activePlayerIds).toEqual([victimId])
        expect(() =>
            play(table, victimId, {
                type: ActionType.DivideSpoils,
                pile: goodCounts({ [Good.Ore]: 1 })
            })
        ).toThrow()
        play(table, victimId, {
            type: ActionType.DivideSpoils,
            pile: goodCounts({ [Good.Ore]: 2 })
        })
        play(table, raiderId, { type: ActionType.ChooseSpoils, pile: 1 })
        const afterChoice = hydrated(table)
        expect(afterChoice.getPlayerState(victimId).goods[Good.Salt]).toBe(0)
        expect(afterChoice.getPlayerState(raiderId).goods[Good.Salt]).toBe(3)
        const raid = afterChoice.raid
        expect(raid?.expellerId).toBe(afterChoice.turnManager.nextPlayer(raiderId))
        const raidedCity = afterChoice.getPlayerState(raiderId).location()
        play(table, raid?.expellerId ?? '', { type: ActionType.ExpelRaider, slot: 0 })
        const after = hydrated(table)
        expect(after.getPlayerState(raiderId).location()).not.toBe(raidedCity)
        expect(after.city(raidedCity).raiders).toEqual([raiderId])
        expect(after.getPlayerState(raiderId).raidMarkers).toBe(0)
        expect(after.turn?.playerId).not.toBe(raiderId)
    })
})
