import { describe, expect, it } from 'vitest'
import { isPlayAlgaCylinder } from '../actions/playAlgaCylinder.js'
import { AlgaColor, CoralColor, coralCounts } from '../components/colors.js'
import { ActionType } from './actions.js'
import type { TestSession } from '../util/testHelper.js'
import {
    give,
    giveSupplyPolyps,
    place,
    play,
    at,
    startOnBoardThree
} from '../util/reefTestHelpers.js'

const Blue = AlgaColor.Blue
const Red = AlgaColor.Red
const Green = AlgaColor.Green

// Every tile starts starfish side up. Large algae there: blue on tiles 1, 7 and 10; red on
// 6 and 8; green on 2, 3 and 4. The reverse of tiles 1 and 10 shows a large red alga.
function startWithConsumed(count = 3, shrimpOnOpenSea = false) {
    const session = startOnBoardThree([])
    give(session, (player) => {
        player.consumedPolyps = { ...coralCounts(0), [CoralColor.Grey]: count }
        player.shrimpOnOpenSea = shrimpOnOpenSea
    })
    return session
}

function playAlga(session: TestSession, alga: AlgaColor, tileId?: number) {
    return session.act(session.currentPlayerId(), ActionType.PlayAlgaCylinder, {
        consumedColor: CoralColor.Grey,
        alga,
        tileId
    })
}

function flipped(session: TestSession) {
    return session.state.coralTiles
        .filter((tile) => !tile.starfishSideUp)
        .map((tile) => tile.tileId)
        .sort((a, b) => a - b)
}

function tile(session: TestSession, tileId: number) {
    return session.state.coralTiles.find((candidate) => candidate.tileId === tileId)
}

describe('playing an alga cylinder on the open-sea space', () => {
    it('spends a consumed polyp and flips every tile showing its large alga', () => {
        const session = startWithConsumed()
        const bag = session.state.polypBag.remaining

        const [played] = playAlga(session, Blue)

        expect(flipped(session)).toEqual([1, 7, 10])
        expect(session.state.openSeaAlga).toBe(Blue)
        expect(session.state.algaSupply[Blue]).toBe(4)
        expect(
            session.state.players.find((p) => p.playerId === session.currentPlayerId())
                ?.consumedPolyps[CoralColor.Grey]
        ).toBe(2)
        expect(session.state.polypBag.remaining).toBe(bag + 1)
        expect(isPlayAlgaCylinder(played) && played.metadata).toEqual({
            flippedTileIds: [1, 7, 10]
        })
    })

    it('replaces the cylinder already there, any number of times a turn', () => {
        const session = startWithConsumed()
        playAlga(session, Blue)
        const [played] = playAlga(session, Red)

        expect(flipped(session)).toEqual([6, 7, 8])
        expect(session.state.openSeaAlga).toBe(Red)
        expect(session.state.algaSupply[Blue]).toBe(5)
        expect(isPlayAlgaCylinder(played) && played.metadata?.replacedCylinder).toBe(Blue)
        playAlga(session, Green)
    })

    it('needs a consumed polyp and a cylinder of the colour in the supply', () => {
        const none = startWithConsumed(0)
        const state = none.hydrated()
        expect(state.canPlayAlgaCylinder(none.currentPlayerId(), CoralColor.Grey, Blue)).toBe(false)
        expect(state.hasAlgaCylinderPlay(none.currentPlayerId())).toBe(false)

        const empty = startWithConsumed()
        empty.edit((draft) => {
            draft.algaSupply[Blue] = 0
        })
        expect(() => playAlga(empty, Blue)).toThrow()
    })

    it('finishes the larva cube being played', () => {
        const session = startWithConsumed()
        giveSupplyPolyps(session, CoralColor.White, 4)
        play(session, CoralColor.White)
        playAlga(session, Blue)
        expect(() => place(session, at(6, 0))).toThrow()
    })

    it('waits while a bought larva cube is still to be played', () => {
        const session = startWithConsumed()
        session.act(session.currentPlayerId(), ActionType.ExchangeConsumedPolyp, {
            color: CoralColor.Grey
        })
        expect(() => playAlga(session, Blue)).toThrow()
    })
})

describe('locking a coral tile', () => {
    it('keeps the tile as it is and flips the other uncovered tiles with that large alga', () => {
        const session = startWithConsumed(3, true)
        playAlga(session, Blue, 1)

        expect(tile(session, 1)).toMatchObject({ starfishSideUp: true, cylinder: Blue })
        expect(flipped(session)).toEqual([7, 10])
        expect(session.state.openSeaAlga).toBeUndefined()
    })

    it('leaves locked tiles alone afterwards', () => {
        const session = startWithConsumed(3, true)
        playAlga(session, Blue, 1)
        playAlga(session, Blue)
        expect(tile(session, 1)?.starfishSideUp).toBe(true)
    })

    it('happens once a turn, though open-sea cylinders may follow', () => {
        const session = startWithConsumed(3, true)
        playAlga(session, Blue, 1)
        expect(() => playAlga(session, Green, 2)).toThrow()
        playAlga(session, Green)
    })

    it('needs the player’s shrimp on the open-sea board', () => {
        const session = startWithConsumed(3, false)
        expect(() => playAlga(session, Blue, 1)).toThrow()
    })

    it('needs the cylinder to match the tile’s large alga, and an uncovered tile', () => {
        const session = startWithConsumed(3, true)
        expect(() => playAlga(session, Blue, 2)).toThrow()
        session.edit((draft) => {
            draft.coralTiles[0].cylinder = Blue
        })
        expect(() => playAlga(session, Blue, 1)).toThrow()
    })

    it('locks the last uncovered tile only with two polyps in the parrotfish', () => {
        const session = startWithConsumed(3, true)
        session.edit((draft) => {
            for (const coralTile of draft.coralTiles) {
                if (coralTile.tileId !== 1) coralTile.cylinder = Red
            }
        })
        give(session, (player) => {
            player.secretParrotfishPolyps = { ...coralCounts(0), [CoralColor.Pink]: 1 }
            player.knownParrotfishPolyps = coralCounts(0)
        })
        expect(() => playAlga(session, Blue, 1)).toThrow()

        give(session, (player) => {
            player.knownParrotfishPolyps = { ...coralCounts(0), [CoralColor.White]: 1 }
        })
        playAlga(session, Blue, 1)
    })
})
