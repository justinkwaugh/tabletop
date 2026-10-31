import { describe, expect, it } from 'vitest'
import { BOARD_GRID, PROMONTORY, type SpaceId } from '../components/board.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { RED_TILE_KIND_IDS, isRedTile } from '../components/townTiles.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { withEmptyBag, withTrack } from '../testing/fixtures.js'
import { startGame } from '../testing/startGame.js'
import { GameEndReason, gameEndReason, uncoveredRedTileCount } from './gameEnd.js'

function townSpaceIds(state: PromontoryPointGameState, red: boolean): SpaceId[] {
    return BOARD_GRID.spaces()
        .map((space) => space.spaceId)
        .filter((spaceId) => spaceId in state.towns && isRedTile(state.towns[spaceId]) === red)
}

function covered(state: PromontoryPointGameState, spaceIds: SpaceId[]): PromontoryPointGameState {
    return withTrack(
        state,
        spaceIds.map((spaceId, index): [SpaceId, RailroadId] => [
            spaceId,
            RAILROAD_IDS[index % RAILROAD_IDS.length]
        ])
    )
}

describe('Promontory Point end test', () => {
    const { state } = startGame()
    const red = townSpaceIds(state, true)
    const price = townSpaceIds(state, false)

    it('R-6.1-H1: counts the 16 red tiles, Dividend and Repairs, while uncovered', () => {
        expect(red).toHaveLength(16)
        expect(new Set(red.map((spaceId) => state.towns[spaceId]))).toEqual(
            new Set(RED_TILE_KIND_IDS)
        )
        expect(uncoveredRedTileCount(state)).toBe(16)
        expect(
            uncoveredRedTileCount(covered(state, [...red.slice(0, 5), ...price.slice(0, 20)]))
        ).toBe(11)
        expect(gameEndReason(state)).toBeUndefined()
    })

    it('R-6.1, R-6.1-H1: ends with at most one red tile uncovered and Promontory covered', () => {
        expect(gameEndReason(covered(state, [...red.slice(1), PROMONTORY.spaceId]))).toBe(
            GameEndReason.RedTilesCovered
        )
        expect(gameEndReason(covered(state, [...red, PROMONTORY.spaceId]))).toBe(
            GameEndReason.RedTilesCovered
        )
    })

    it('R-6.1: does not end with two red tiles uncovered, with price towns covered', () => {
        expect(
            gameEndReason(
                covered(state, [...red.slice(2), ...price.slice(0, 20), PROMONTORY.spaceId])
            )
        ).toBeUndefined()
    })

    it('R-6.1: does not end with every red tile covered while Promontory is empty', () => {
        expect(gameEndReason(covered(state, red))).toBeUndefined()
    })

    it('R-6.1, R-6.1-H2: ends once the bag is empty, whatever the board', () => {
        expect(gameEndReason(withEmptyBag(state))).toBe(GameEndReason.BagEmpty)
        expect(gameEndReason(withEmptyBag(covered(state, red.slice(3))))).toBe(
            GameEndReason.BagEmpty
        )
    })
})
