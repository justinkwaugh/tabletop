import { describe, expect, it } from 'vitest'
import { BOARD_GRID, BoardNodeKind, PROMONTORY, type SpaceId } from '../components/board.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { pathFromHome, withTrack } from '../testing/fixtures.js'
import { startGame } from '../testing/startGame.js'
import { hasOpenSpace, isOpenTo, networkSpaceIds, openSpaceIds } from './network.js'

function homeNeighbours(railroadId: RailroadId): SpaceId[] {
    return BOARD_GRID.spacesAdjacentTo(BOARD_GRID.homeHex(railroadId).coords).map(
        (space) => space.spaceId
    )
}

function neighbours(spaceId: SpaceId): SpaceId[] {
    return BOARD_GRID.spacesAdjacentTo(BOARD_GRID.requireSpace(spaceId).coords).map(
        (space) => space.spaceId
    )
}

function sorted(ids: SpaceId[]): SpaceId[] {
    return [...ids].sort()
}

describe('Promontory Point network and open spaces', () => {
    it('R-3.3: at game start each railroad has exactly its four home neighbours open', () => {
        const { state } = startGame()
        for (const railroadId of RAILROAD_IDS) {
            expect(networkSpaceIds(state.track, railroadId)).toEqual([])
            expect(openSpaceIds(state.track, railroadId)).toHaveLength(4)
            expect(sorted(openSpaceIds(state.track, railroadId))).toEqual(
                sorted(homeNeighbours(railroadId))
            )
        }
    })

    it('R-3.3: a placed piece joins the network, leaves the open spaces and opens its empty neighbours', () => {
        const [first, ...otherHomeNeighbours] = homeNeighbours('railroad.cp')
        const state = withTrack(startGame().state, [[first, 'railroad.cp']])

        expect(networkSpaceIds(state.track, 'railroad.cp')).toEqual([first])
        const open = openSpaceIds(state.track, 'railroad.cp')
        expect(open).not.toContain(first)
        expect(sorted(open)).toEqual(
            sorted(
                [...new Set([...otherHomeNeighbours, ...neighbours(first)])].filter(
                    (id) => id !== first
                )
            )
        )
        expect(isOpenTo(state.track, 'railroad.cp', first)).toBe(false)
    })

    it('R-3.3: a piece of another railroad blocks its space and does not extend the network', () => {
        const [blocked] = homeNeighbours('railroad.cp')
        const state = withTrack(startGame().state, [[blocked, 'railroad.up']])

        expect(isOpenTo(state.track, 'railroad.cp', blocked)).toBe(false)
        const reachedOnlyThroughBlocked = neighbours(blocked).filter(
            (spaceId) => !homeNeighbours('railroad.cp').includes(spaceId)
        )
        for (const spaceId of reachedOnlyThroughBlocked) {
            expect(isOpenTo(state.track, 'railroad.cp', spaceId)).toBe(false)
        }
        expect(networkSpaceIds(state.track, 'railroad.cp')).toEqual([])
        expect(networkSpaceIds(state.track, 'railroad.up')).toEqual([blocked])
    })

    it('R-3.3: a railroad whose home neighbours are all taken by other railroads has no open space', () => {
        const state = withTrack(
            startGame().state,
            homeNeighbours('railroad.cp').map((spaceId) => [spaceId, 'railroad.up'])
        )

        expect(openSpaceIds(state.track, 'railroad.cp')).toEqual([])
        expect(hasOpenSpace(state.track, 'railroad.cp')).toBe(false)
        expect(hasOpenSpace(state.track, 'railroad.kp')).toBe(true)
    })

    it('R-3.3: Promontory and towns are spaces a network grows onto, each step open in turn', () => {
        const towns = BOARD_GRID.spaces().filter((space) => space.kind === BoardNodeKind.Town)
        for (const [index, railroadId] of RAILROAD_IDS.entries()) {
            for (const target of [PROMONTORY.spaceId, towns[index * 12].spaceId]) {
                const path = pathFromHome(railroadId, target)
                let { state } = startGame()
                for (const spaceId of path) {
                    expect(isOpenTo(state.track, railroadId, spaceId)).toBe(true)
                    state = withTrack(state, [[spaceId, railroadId]])
                }
                expect(sorted(networkSpaceIds(state.track, railroadId))).toEqual(sorted(path))
            }
        }
    })
})
