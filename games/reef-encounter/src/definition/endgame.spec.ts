import { describe, expect, it } from 'vitest'
import { isEndGame } from '../actions/endGame.js'
import { AlgaColor, CoralColor, coralCounts } from '../components/colors.js'
import { ReefBoards } from '../components/reefBoards.js'
import { GameEndReason } from '../model/gameState.js'
import type { Polyp } from '../model/reef.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import type { TestSession } from '../util/testHelper.js'
import {
    at,
    give,
    giveScreenPolyps,
    place,
    play,
    polyp,
    startOnBoardOne
} from '../util/reefTestHelpers.js'

// Board 1 (docs/board-map.md): (0,0), (0,1), (1,0), (1,1), (1,2) and (1,3) are rock.
const coral = (size: number, color = CoralColor.White): Polyp[] =>
    [at(0, 0), at(0, 1), at(1, 0), at(1, 1), at(1, 2), at(1, 3)]
        .slice(0, size)
        .map((coords) => polyp(coords.row, coords.col, color))

// Every tile but tile 1 (large blue alga, starfish side up) already carries a cylinder.
function lastTileLeft(session: TestSession) {
    session.edit((draft) => {
        for (const tile of draft.coralTiles) {
            if (tile.tileId !== 1) tile.cylinder = AlgaColor.Red
        }
    })
    give(session, (player) => {
        player.shrimpOnOpenSea = true
        player.consumedPolyps = { ...coralCounts(0), [CoralColor.Grey]: 1 }
        player.knownParrotfishPolyps = { ...coralCounts(0), [CoralColor.Grey]: 2 }
    })
}

function lockLastTile(session: TestSession) {
    return session.act(session.currentPlayerId(), ActionType.PlayAlgaCylinder, {
        consumedColor: CoralColor.Grey,
        alga: AlgaColor.Blue,
        tileId: 1
    })
}

function pass(session: TestSession) {
    return session.act(session.currentPlayerId(), ActionType.PassFinalTurn)
}

function eat(session: TestSession) {
    return session.act(session.currentPlayerId(), ActionType.EatCoral, {
        boardId: 1,
        coords: at(0, 0)
    })
}

function endedWithReveal(session: TestSession) {
    return session.actions.some((action) => isEndGame(action) && action.revealsInfo === true)
}

describe('locking the last coral tile', () => {
    it('ends the turn at once and gives every other player a final turn', () => {
        const session = startOnBoardOne([], [], 3)
        const [first, second, third] = session.state.turnManager.turnOrder
        lastTileLeft(session)

        lockLastTile(session)

        expect(session.state.machineState).toBe(MachineState.FinalTurns)
        expect(session.state.endReason).toBe(GameEndReason.AllTilesLocked)
        expect(session.state.endingPlayerId).toBe(first)
        expect(session.currentPlayerId()).toBe(second)
        pass(session)
        expect(session.currentPlayerId()).toBe(third)
        pass(session)

        expect(session.state.machineState).toBe(MachineState.EndOfGame)
        expect(session.state.result).toBeDefined()
        expect(endedWithReveal(session)).toBe(true)
    })
})

describe('eating the fourth shrimp', () => {
    it('ends the turn at once and gives the other players a final turn', () => {
        const session = startOnBoardOne(coral(5))
        const [first, second] = session.state.turnManager.turnOrder
        session.edit((draft) => {
            draft.shrimps = [{ playerId: first, boardId: 1, coords: at(0, 0) }]
        })
        give(session, (player) => {
            player.shrimpOnOpenSea = true
            player.shrimpsInParrotfish = 2
            player.shrimpsBehindScreen = 0
        })

        eat(session)

        expect(session.state.machineState).toBe(MachineState.FinalTurns)
        expect(session.state.endReason).toBe(GameEndReason.FourShrimpsEaten)
        expect(session.currentPlayerId()).toBe(second)
    })
})

describe('final turns', () => {
    function startFinalTurns() {
        const session = startOnBoardOne(coral(6))
        const [, second] = session.state.turnManager.turnOrder
        session.edit((draft) => {
            draft.shrimps = [{ playerId: second, boardId: 1, coords: at(0, 0) }]
        })
        lastTileLeft(session)
        lockLastTile(session)
        return session
    }

    it('lets a player eat one coral, returning five polyps to the bag', () => {
        const session = startFinalTurns()
        const bag = session.state.polypBag.remaining

        eat(session)

        expect(session.state.polypBag.remaining).toBe(bag + 5)
        expect(session.state.machineState).toBe(MachineState.EndOfGame)
        const eater = session.state.players.find(
            (player) => player.playerId === session.state.turnManager.turnOrder[1]
        )
        expect(eater?.knownParrotfishPolyps?.[CoralColor.White]).toBe(1)
    })

    it('allows nothing but eating or passing', () => {
        const session = startFinalTurns()
        giveScreenPolyps(session, CoralColor.Pink, 1)
        expect(() => play(session, CoralColor.Pink)).toThrow()
        expect(() =>
            session.act(session.currentPlayerId(), ActionType.TakeOpenSeaSpace, {
                larvaColor: CoralColor.White
            })
        ).toThrow()
        expect(() => eat(session)).not.toThrow()
    })
})

describe('running out of rock', () => {
    it('ends the game at once, with no final turns', () => {
        const filled = (boardId: 1 | 2) =>
            ReefBoards[boardId].rock.map((coords) => polyp(coords.row, coords.col, CoralColor.Grey))
        const boardOne = filled(1).filter((p) => !(p.coords.row === 0 && p.coords.col === 0))
        const session = startOnBoardOne(boardOne)
        session.edit((draft) => {
            draft.reefs[1].polyps = filled(2)
        })
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        place(session, at(0, 0))

        expect(session.state.machineState).toBe(MachineState.EndOfGame)
        expect(session.state.endReason).toBe(GameEndReason.NoRockLeft)
        expect(session.state.endingPlayerId).toBeUndefined()
        expect(endedWithReveal(session)).toBe(true)
    })
})
