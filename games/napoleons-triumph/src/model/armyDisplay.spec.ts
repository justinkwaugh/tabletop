import { describe, expect, it } from 'vitest'
import { STARTING_ARMIES, Side, type Face } from '../components/pieces.js'
import { NapoleonsTriumphRuntime } from '../definition/runtime.js'
import { TestGame, arrangeBattlefield, guard, infantry } from '../testing/harness.js'
import { HydratedNapoleonsTriumphGameState } from './gameState.js'

const ALLIED_RESERVE = 106
const FRENCH_RESERVE = 23

function sorted(faces: readonly Face[]): string[] {
    return faces.map((face) => JSON.stringify(face)).sort()
}

function arranged(): TestGame {
    const game = new TestGame()
    game.deployBoth()
    arrangeBattlefield(game, [
        { id: 'A01', side: Side.Allied, face: guard(), locale: ALLIED_RESERVE },
        { id: 'A02', side: Side.Allied, face: infantry(2), locale: ALLIED_RESERVE },
        { id: 'F01', side: Side.French, face: infantry(3), locale: FRENCH_RESERVE }
    ])
    return game
}

describe("Napoleon's Triumph army display", () => {
    it('starts with the whole army once the sides are chosen', () => {
        const game = new TestGame()
        game.deployBoth()
        for (const side of [Side.French, Side.Allied]) {
            expect(sorted(game.hydrated.playerOf(side).armyDisplay ?? [])).toEqual(
                sorted(STARTING_ARMIES[side])
            )
        }
    })

    it('replaces a reduced unit with its weaker face', () => {
        const game = arranged()
        game.arrange((state) => {
            state.takeLoss(state.unit('A01'), 1)
        })
        expect(sorted(game.hydrated.playerOf(Side.Allied).armyDisplay ?? [])).toEqual(
            sorted([infantry(2), infantry(2)])
        )
    })

    it('takes an eliminated unit off the display', () => {
        const game = arranged()
        game.arrange((state) => {
            state.takeLoss(state.unit('A02'), 2)
        })
        expect(game.hydrated.playerOf(Side.Allied).armyDisplay).toEqual([guard()])
    })

    it('shows both players the display while the faces stay hidden', () => {
        const game = arranged()
        game.arrange((state) => {
            state.takeLoss(state.unit('A01'), 2)
        })
        const french = game.playerOf(Side.French)
        const view = NapoleonsTriumphRuntime.visibility.state.project(
            game.canonical,
            { kind: 'player', playerId: french },
            { config: game.game.config }
        )
        const allied = view.players.find((player) => player.side === Side.Allied)
        expect(sorted(allied?.armyDisplay ?? [])).toEqual(sorted([infantry(1), infantry(2)]))
        expect(view.units.find((unit) => unit.id === 'A02')).not.toHaveProperty('face')
    })

    it('fills in the display for a game begun before it was recorded', () => {
        const game = arranged()
        const legacy = structuredClone(game.canonical)
        for (const player of legacy.players) {
            delete player.armyDisplay
        }
        const hydrated = new HydratedNapoleonsTriumphGameState(legacy)
        expect(sorted(hydrated.playerOf(Side.Allied).armyDisplay ?? [])).toEqual(
            sorted([guard(), infantry(2)])
        )
        const view = NapoleonsTriumphRuntime.visibility.state.project(
            legacy,
            { kind: 'player', playerId: game.playerOf(Side.French) },
            { config: game.game.config }
        )
        expect(view.players.find((player) => player.side === Side.Allied)?.armyDisplay).toEqual([
            guard(),
            infantry(2)
        ])
    })
})
