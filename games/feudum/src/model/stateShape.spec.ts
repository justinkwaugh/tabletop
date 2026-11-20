import { describe, expect, it } from 'vitest'
import { ComponentTotals, StartingSupply } from '../data/components.js'
import { GuildSetupSpaces, KnightRowIds } from '../data/guilds.js'
import { FeudumColors } from '../definition/colors.js'
import { initialState } from '../testing/state.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { FeudumGameStateValidator } from './gameState.js'
import { knightRows } from './knightRows.js'

const RowMarkers = GuildSetupSpaces.knight.markersPerRow

describe('the general supply keeps each seat by its id', () => {
    it.each([2, 3, 4, 5])(
        'R-1.4.2 at %i seats the markers are counted per seat; a dummy colour apart',
        (numPlayers) => {
            const state = initialState(numPlayers)
            const seats = state.players.map(({ playerId }) => playerId)
            const left = ComponentTotals.markersPerColour - StartingSupply.markers - RowMarkers
            expect(state.supply.influence).toEqual(
                Object.fromEntries(seats.map((playerId) => [playerId, left]))
            )
            const unused = FeudumColors.filter(
                (colour) => !state.players.some((player) => player.color === colour)
            ).slice(0, Math.max(4 - numPlayers, 0))
            expect(state.supply.dummyInfluence).toEqual(
                Object.fromEntries(
                    unused.map((colour) => [colour, ComponentTotals.markersPerColour - RowMarkers])
                )
            )
        }
    )
})

describe('a Knight row names its owner', () => {
    it('R-1.4-H1 a seat row by its playerId, a dummy row by its colour, each under a row id', () => {
        const state = initialState(2)
        const rows = knightRows(state)
        expect(rows.map(({ rowId }) => rowId)).toEqual(KnightRowIds.slice(0, 4))
        expect(rows.map(({ row }) => row.owner)).toEqual([
            ...state.players.map(({ playerId }) => ({ playerId })),
            ...FeudumColors.filter(
                (colour) => !state.players.some((player) => player.color === colour)
            )
                .slice(0, 2)
                .map((dummyColour) => ({ dummyColour }))
        ])
        for (const { row } of rows) {
            expect(Object.keys(row).sort()).toEqual(['markers', 'owner'])
        }
    })

    it('R-1.4-H1 a row has one owner, never both', () => {
        const state = initialState(2).dehydrate()
        const [{ rowId }] = knightRows(state)
        state.guilds.knight.rows[rowId] = {
            owner: { playerId: 'p1', dummyColour: FeudumColors[0] } as never,
            markers: 2
        }
        expect(FeudumGameStateValidator.Check(state)).toBe(false)
    })
})

describe('the state keeps no copy of what it can derive', () => {
    it('R-4.1 a location holds its kind and disc, nothing derived from the disc', () => {
        const state = initialState()
        for (const space of Object.values(state.spaces)) {
            expect(Object.keys(space.location).sort()).toEqual(['discId', 'kind'])
        }
    })

    it('R-4.2.4 who controls a monster is on the monster alone', () => {
        expect(Object.keys(initialState().guilds.knight)).toEqual(['rows'])
    })

    it('R-X.3 the revision is a whole number', () => {
        const state = initialState().dehydrate()
        expect(FeudumGameStateValidator.Check({ ...state, feudumRevision: 1.5 })).toBe(false)
    })

    it('R-1.4.8 setup asks its seat through the turn manager, not the flow', () => {
        const state = initialState()
        expect(state.flow).toEqual({})
        expect(state.turnManager.currentTurn()?.playerId).toBe(state.startingPlayerId)
    })

    it('R-3.2 the card turn keeps what the card leaves; the turn manager keeps whose turn', () => {
        const table = tableAtPlayingCards()
        expect(table.state.flow.turn).toEqual({ secondCard: false, followUps: [] })
        expect(table.hydrated().turnManager.currentTurn()?.playerId).toBe(table.asked)
    })
})
