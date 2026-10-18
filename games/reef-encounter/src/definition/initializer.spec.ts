import { describe, expect, it } from 'vitest'
import { CoralColors, countColors, totalCount } from '../components/colors.js'
import { OpenSeaOrder, spacesClockwiseFrom, StartingOpenSeaPolyps } from '../components/openSea.js'
import { ReefBoards } from '../components/reefBoards.js'
import { ReefEncounterGameStateValidator } from '../model/gameState.js'
import { startTestGame } from '../util/testHelper.js'
import { LarvaCubesPerColor, PolypsPerColor, SetupDeal } from './initializer.js'
import { MachineState } from './states.js'

describe('setup', () => {
    it.each([2, 3, 4])('lays out a %i-player game by the rulebook', (playerCount) => {
        const session = startTestGame(playerCount)
        const state = session.state
        expect(ReefEncounterGameStateValidator.Check(state)).toBe(true)

        expect(state.reefs).toHaveLength(playerCount)
        expect(new Set(state.reefs.map((reef) => reef.boardId)).size).toBe(playerCount)
        for (const reef of state.reefs) {
            expect(reef.polyps).toEqual(ReefBoards[reef.boardId].startingPolyps)
        }

        const dealt = session
            .hydrated()
            .players.map((player) => totalCount(player.getSecretSupplyPolyps()))
        expect(dealt).toEqual(SetupDeal[playerCount])
        expect(state.players.map((player) => player.playerId)).toEqual(state.turnManager.turnOrder)

        const openSeaPolyps = state.openSea.reduce((total, space) => total + space.polyps.length, 0)
        const dealtTotal = dealt.reduce((total, count) => total + count, 0)
        expect(state.polypBag.remaining).toBe(
            PolypsPerColor * CoralColors.length - playerCount * 5 - 5 - openSeaPolyps - dealtTotal
        )
        expect(state.polypBag.items).toHaveLength(state.polypBag.remaining)
        expect(state.bonusPolyps).toEqual(countColors(CoralColors))
        expect(state.larvaCubeSupply).toEqual(
            Object.fromEntries(CoralColors.map((color) => [color, LarvaCubesPerColor - 1]))
        )
    })

    it('conserves every polyp of each colour', () => {
        const session = startTestGame(4)
        const state = session.state
        const players = session.hydrated().players
        const placed = [
            ...state.reefs.flatMap((reef) => reef.polyps.map((polyp) => polyp.color)),
            ...state.openSea.flatMap((space) => space.polyps),
            ...state.polypBag.items
        ]
        const counts = countColors(placed)
        for (const color of CoralColors) {
            const inSupplies = players.reduce(
                (total, player) => total + player.getSecretSupplyPolyps()[color],
                0
            )
            expect(counts[color] + inSupplies + state.bonusPolyps[color]).toBe(PolypsPerColor)
        }
    })

    it('fills the open sea 3, 3, 3, 2, 1 clockwise from one space', () => {
        const state = startTestGame(3).state
        expect(state.openSea.map((space) => space.larvaColor)).toEqual(OpenSeaOrder)
        const polypsOn = (color: string) =>
            state.openSea.find((space) => space.larvaColor === color)?.polyps.length
        const rotations = OpenSeaOrder.map((start) => spacesClockwiseFrom(start).map(polypsOn))
        expect(rotations).toContainEqual([...StartingOpenSeaPolyps])
    })

    it('shows the same side on every coral tile', () => {
        const sides = new Set(startTestGame(2).state.coralTiles.map((tile) => tile.starfishSideUp))
        expect(sides.size).toBe(1)
    })

    it('plays the Advanced game only when the option is chosen', () => {
        expect(startTestGame(2).state.advanced).toBe(false)
        expect(startTestGame(2, { advanced: true }).state.advanced).toBe(true)
    })

    it('waits for every player to feed their parrotfish', () => {
        const state = startTestGame(3).state
        expect(state.machineState).toBe(MachineState.ChoosingParrotfishPolyp)
        expect(state.activePlayerIds).toEqual(state.turnManager.turnOrder)
    })

    it('sets up the same game from the same seed', () => {
        const { id: _first, ...first } = startTestGame(4).state
        const { id: _second, ...second } = startTestGame(4).state
        expect(first).toEqual(second)
    })
})
