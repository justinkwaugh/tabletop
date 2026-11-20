import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Goods } from '../data/components.js'
import { Spaces } from '../data/board.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { Table } from '../testing/table.js'
import {
    isChooseStartingGoods,
    reasonStartingGoodRefused,
    startingGoodOffers
} from './chooseStartingGoods.js'
import { isPlaceStartingPawn, startingPawnOffers, StartingSpaceIds } from './placeStartingPawn.js'

const DESERT_3 = 'space.desert.3'
const STARTING_SPACE_COUNT = 6

function choose(table: Table, playerId: string, goods: string[], sulfurToBarrel?: boolean) {
    return table.send(playerId, {
        type: ActionType.ChooseStartingGoods,
        goods,
        ...(sulfurToBarrel === undefined ? {} : { sulfurToBarrel })
    })
}

function place(table: Table, playerId: string, character: string, spaceId: string = DESERT_3) {
    return table.send(playerId, { type: ActionType.PlaceStartingPawn, character, spaceId })
}

function tableAtPawns(numPlayers = 4): Table {
    const table = new Table(numPlayers)
    for (const playerId of table.order) {
        choose(table, playerId, ['saltpeter', 'sulfur', 'iron'])
    }
    return table
}

describe('ChooseStartingGoods', () => {
    it('R-1.4.8 moves three different goods from the haversack to the personal supply', () => {
        const table = new Table()
        const [first] = table.order
        const before = structuredClone(table.state.supply.haversack)
        const food = table.seat(first).goods.food

        const processed = choose(table, first, ['saltpeter', 'iron', 'food'])

        expect(table.seat(first).goods).toMatchObject({
            saltpeter: 1,
            iron: 1,
            food: food + 1,
            sulfur: 0
        })
        expect(table.state.supply.haversack).toEqual({
            ...before,
            saltpeter: before.saltpeter - 1,
            iron: before.iron - 1,
            food: before.food - 1
        })
        expect(table.seat(first).barrel).toBe(0)
        expect(processed).toHaveLength(1)
        expect(isChooseStartingGoods(processed[0])).toBe(true)
    })

    it('R-1.4.8 a sulfur goes to the personal supply or the barrel, the seat choosing (S1)', () => {
        const table = new Table()
        const [first, second] = table.order

        choose(table, first, ['saltpeter', 'sulfur', 'food'], true)
        choose(table, second, ['saltpeter', 'sulfur', 'food'], false)

        expect(table.seat(first).barrel).toBe(1)
        expect(table.seat(first).goods.sulfur).toBe(0)
        expect(table.seat(second).barrel).toBe(0)
        expect(table.seat(second).goods.sulfur).toBe(1)
    })

    it('R-1.4.8 refuses anything but three different goods, with the reason', () => {
        const table = new Table()
        const [first] = table.order
        expect(() => choose(table, first, ['iron', 'wood'])).toThrow('Choose 3 goods.')
        expect(() => choose(table, first, ['iron', 'iron', 'wood'])).toThrow(
            'Choose 3 different goods.'
        )
    })

    it('R-1.4.8 refuses a good the haversack lacks, and the offers dim it', () => {
        const table = new Table()
        const [first] = table.order
        const { haversack } = table.state.supply
        const row = table.state.players.find((player) => player.playerId === first)
        assertExists(row, 'The first seat has a row')
        row.goods.food += haversack.food
        haversack.food = 0

        expect(() => choose(table, first, ['iron', 'wood', 'food'])).toThrow(
            'The haversack holds no food.'
        )
        expect(startingGoodOffers(table.hydrated())).toEqual(Goods.filter((g) => g !== 'food'))
        expect(reasonStartingGoodRefused(table.hydrated(), 'food')).toBe(
            'The haversack holds no food.'
        )
        expect(reasonStartingGoodRefused(table.hydrated(), 'iron')).toBeUndefined()
    })

    it('R-1.4.8 refuses the barrel without a sulfur', () => {
        const table = new Table()
        const [first] = table.order
        expect(() => choose(table, first, ['iron', 'wood', 'food'], true)).toThrow(
            'Only sulfur goes in the barrel.'
        )
    })

    it('R-X.2 is not a barrier and needs no metadata: the input names everything', () => {
        const table = new Table()
        const [action] = choose(table, table.order[0], ['iron', 'wood', 'food'])
        expect(action.revealsInfo).toBeFalsy()
        expect(action).not.toHaveProperty('metadata')
    })

    it('R-1.4.8 asks each seat in turn order, then the first seat for its pawn (S1)', () => {
        const table = new Table()
        expect(table.asked).toBe(table.order[0])

        table.order.forEach((playerId, index) => {
            expect(table.asked).toBe(playerId)
            expect(table.hydrated().turnManager.currentTurn()?.playerId).toBe(playerId)
            expect(table.state.machineState).toBe(MachineState.ChoosingStartingGoods)
            expect(table.offered(playerId)).toEqual([ActionType.ChooseStartingGoods])
            expect(table.offered(table.order[index + 1] ?? table.order[0])).toEqual([])
            expect(() => choose(table, table.order[index + 1] ?? 'nobody', ['iron'])).toThrow()
            choose(table, playerId, ['iron', 'wood', 'food'])
        })

        expect(table.state.machineState).toBe(MachineState.PlacingStartingPawn)
        expect(table.asked).toBe(table.order[0])
        expect(table.hydrated().turnManager.currentTurn()?.playerId).toBe(table.order[0])
    })
})

describe('PlaceStartingPawn', () => {
    it('R-1.4.9 turns one pawn to the character on the starting space (S2)', () => {
        const table = tableAtPawns()
        const [first] = table.order

        const processed = place(table, first, 'knight')

        expect(table.seat(first).pawns).toEqual([
            { n: 1, spaceId: DESERT_3, character: 'knight' },
            { n: 2 },
            { n: 3 }
        ])
        expect(processed).toHaveLength(1)
        expect(isPlaceStartingPawn(processed[0])).toBe(true)
        expect(processed[0].revealsInfo).toBeFalsy()
    })

    it('R-1.4.9 several seats may share a starting space, whatever their characters', () => {
        const table = tableAtPawns()
        const [first, second] = table.order
        place(table, first, 'knight')
        place(table, second, 'monk')
        expect(table.seat(second).pawns[0].spaceId).toBe(DESERT_3)
    })

    it('R-1.4.9 offers the six printed starting spaces and refuses any other', () => {
        const table = tableAtPawns()
        const [first] = table.order
        const other = Spaces.find((space) => !space.startingSpace)?.id ?? ''

        expect(StartingSpaceIds).toHaveLength(STARTING_SPACE_COUNT)
        expect(startingPawnOffers(table.hydrated(), first).spaces).toEqual(StartingSpaceIds)
        expect(() => place(table, first, 'knight', other)).toThrow(
            `${other} is not a starting space.`
        )
    })

    it('R-1.4.9, R-4.5-H1 the marker takes master, by the recompute, and is in metadata (S2)', () => {
        const table = tableAtPawns()
        const [first] = table.order
        const supply = table.seat(first).influenceSupply

        const [action] = place(table, first, 'knight')

        expect(table.state.guilds.tracks.knight.master).toMatchObject({ playerId: first })
        expect(table.seat(first).influenceSupply).toBe(supply - 1)
        expect(action).toMatchObject({
            metadata: { rankChanges: [{ guildId: 'knight', playerId: first, to: 'master' }] }
        })
    })

    it('R-1.4.9, R-4.5-H1 the same character at 4 players: journeyman, apprentice, none (S3)', () => {
        const table = tableAtPawns(4)
        const [first, second, third, fourth] = table.order
        place(table, first, 'knight')

        expect(place(table, second, 'knight')[0]).toMatchObject({
            metadata: { rankChanges: [{ guildId: 'knight', playerId: second, to: 'journeyman' }] }
        })
        expect(place(table, third, 'knight')[0]).toMatchObject({
            metadata: { rankChanges: [{ guildId: 'knight', playerId: third, to: 'apprentice' }] }
        })
        const supply = table.seat(fourth).influenceSupply
        expect(place(table, fourth, 'knight')[0]).toMatchObject({ metadata: { rankChanges: [] } })

        expect(table.seat(fourth).influenceSupply).toBe(supply)
        expect(table.state.guilds.tracks.knight).toMatchObject({
            master: { playerId: first },
            journeyman: { playerId: second },
            apprentice: { playerId: third }
        })
    })

    it('R-1.4.9, R-4.5.3 at 3 players there is no apprentice space', () => {
        const table = tableAtPawns(3)
        const [first, second, third] = table.order
        place(table, first, 'monk')
        place(table, second, 'monk')
        expect(place(table, third, 'monk')[0]).toMatchObject({ metadata: { rankChanges: [] } })
        expect(table.state.guilds.tracks.monk.apprentice).toBeUndefined()
    })

    it('R-1.4.9, R-4.5.3 the rank chips follow the tracks at 5 players (S3)', () => {
        const table = tableAtPawns(5)
        const rankOffered = (playerId: string) =>
            startingPawnOffers(table.hydrated(), playerId).characters.find(
                (offer) => offer.character === 'knight'
            )?.rank
        const expected = ['master', 'journeyman', 'apprentice', undefined, undefined]

        table.order.forEach((playerId, index) => {
            expect(rankOffered(playerId)).toBe(expected[index])
            place(table, playerId, 'knight')
        })
    })

    it('R-4.5-H1 the offers leave the table as it was', () => {
        const table = tableAtPawns()
        const before = structuredClone(table.state)
        startingPawnOffers(table.hydrated(), table.order[0])
        expect(table.state).toEqual(before)
    })

    it('R-1.4.9 asks each seat in turn order, then opens hand selection', () => {
        const table = tableAtPawns()

        table.order.forEach((playerId) => {
            expect(table.asked).toBe(playerId)
            expect(table.state.machineState).toBe(MachineState.PlacingStartingPawn)
            expect(table.offered(playerId)).toEqual([ActionType.PlaceStartingPawn])
            place(table, playerId, 'noble')
        })

        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.hydrated().turnManager.currentTurn()?.playerId).toBeUndefined()
        expect(table.state.flow.selection).toEqual({ finalised: [] })
        expect(table.asked).toBe(table.order[0])
    })
})
