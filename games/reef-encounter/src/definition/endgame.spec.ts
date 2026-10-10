import { describe, expect, it } from 'vitest'
import { isEndGame } from '../actions/endGame.js'
import { isEatCoral } from '../actions/eatCoral.js'
import { isPlayAlgaCylinder } from '../actions/playAlgaCylinder.js'
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
    startOnBoardThree
} from '../util/reefTestHelpers.js'

// Board 3 (docs/board-map.md): (6,0), (5,0), (6,1), (5,1), (4,1), (3,1) and (2,1) are rock.
const coral = (size: number, color = CoralColor.White): Polyp[] =>
    [at(6, 0), at(5, 0), at(6, 1), at(5, 1), at(4, 1), at(3, 1), at(2, 1)]
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
        boardId: 3,
        coords: at(6, 0)
    })
}

function endedWithReveal(session: TestSession) {
    return session.actions.some((action) => isEndGame(action) && action.revealsInfo === true)
}

describe('locking the last coral tile', () => {
    it('ends the turn at once and gives every other player a final turn', () => {
        const session = startOnBoardThree([], [], 3)
        const [first, second, third] = session.state.turnManager.turnOrder
        lastTileLeft(session)
        expect(session.hydrated().lockingStartsFinalTurns(1)).toBe(true)

        const lock = lockLastTile(session).find((action) => isPlayAlgaCylinder(action))

        expect(isPlayAlgaCylinder(lock) && lock.metadata?.startsFinalTurns).toBe(true)
        expect(session.hydrated().lastFinalTurnPlayerId()).toBe(third)
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
        const session = startOnBoardThree(coral(5))
        const [first, second] = session.state.turnManager.turnOrder
        session.edit((draft) => {
            draft.shrimps = [{ playerId: first, boardId: 3, coords: at(6, 0) }]
        })
        give(session, (player) => {
            player.shrimpOnOpenSea = true
            player.shrimpsInParrotfish = 2
            player.shrimpsBehindScreen = 0
        })
        expect(session.hydrated().eatingStartsFinalTurns(first)).toBe(true)

        const eaten = eat(session).find((action) => isEatCoral(action))

        expect(isEatCoral(eaten) && eaten.metadata?.startsFinalTurns).toBe(true)
        expect(session.state.machineState).toBe(MachineState.FinalTurns)
        expect(session.state.endReason).toBe(GameEndReason.FourShrimpsEaten)
        expect(session.currentPlayerId()).toBe(second)
    })
})

describe('final turns', () => {
    function startFinalTurns() {
        const session = startOnBoardThree(coral(6))
        const [, second] = session.state.turnManager.turnOrder
        session.edit((draft) => {
            draft.shrimps = [{ playerId: second, boardId: 3, coords: at(6, 0) }]
        })
        lastTileLeft(session)
        lockLastTile(session)
        return session
    }

    it('lets a player eat one coral, returning five polyps to the bag', () => {
        const session = startFinalTurns()
        const bag = session.state.polypBag.remaining

        const eaten = eat(session).find((action) => isEatCoral(action))

        expect(isEatCoral(eaten) && eaten.metadata?.startsFinalTurns).toBeUndefined()
        expect(session.state.polypBag.remaining).toBe(bag + 5)
        expect(session.state.machineState).toBe(MachineState.EndOfGame)
        const eater = session.state.players.find(
            (player) => player.playerId === session.state.turnManager.turnOrder[1]
        )
        expect(eater?.knownParrotfishPolyps?.[CoralColor.White]).toBe(1)
    })

    it('returns six polyps in the Advanced game', () => {
        const session = startOnBoardThree(coral(7))
        const [, second] = session.state.turnManager.turnOrder
        session.edit((draft) => {
            draft.advanced = true
            draft.shrimps = [{ playerId: second, boardId: 3, coords: at(6, 0) }]
        })
        lastTileLeft(session)
        lockLastTile(session)
        const bag = session.state.polypBag.remaining

        eat(session)

        expect(session.state.polypBag.remaining).toBe(bag + 6)
        const eater = session.state.players.find((player) => player.playerId === second)
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
        const filled = (boardId: 3 | 4) =>
            ReefBoards[boardId].rock.map((coords) => polyp(coords.row, coords.col, CoralColor.Grey))
        const boardThree = filled(3).filter((p) => !(p.coords.row === 6 && p.coords.col === 0))
        const session = startOnBoardThree(boardThree)
        session.edit((draft) => {
            draft.reefs[1].polyps = filled(4)
        })
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        place(session, at(6, 0))

        expect(session.state.machineState).toBe(MachineState.EndOfGame)
        expect(session.state.endReason).toBe(GameEndReason.NoRockLeft)
        expect(session.state.endingPlayerId).toBeUndefined()
        expect(endedWithReveal(session)).toBe(true)
    })
})
