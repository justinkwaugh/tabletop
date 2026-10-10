import { describe, expect, it } from 'vitest'
import { CoralColor, CoralColors } from '../components/colors.js'
import type { ReefBoardId } from '../components/reefBoards.js'
import type { ReefSquare } from '../model/reef.js'
import { ActionType } from './actions.js'
import type { TestSession } from '../util/testHelper.js'
import {
    at,
    currentPlayer,
    giveScreenPolyps,
    place,
    play,
    polyp,
    startOnBoardThree
} from '../util/reefTestHelpers.js'

// Board 3 (docs/board-map.md): (6,0)-(5,0) form a white coral and (6,1) a pink one;
// (5,1) and (3,0) are bare rock.
const corals = [
    polyp(6, 0, CoralColor.White),
    polyp(5, 0, CoralColor.White),
    polyp(6, 1, CoralColor.Pink),
    polyp(2, 0, CoralColor.Grey)
]
const onBoard = (row: number, col: number, boardId: ReefBoardId = 3): ReefSquare => ({
    boardId,
    coords: at(row, col)
})

function opponentId(session: TestSession) {
    const opponent = session.state.players.find(
        (player) => player.playerId !== session.currentPlayerId()
    )
    return opponent?.playerId ?? ''
}

function introduce(session: TestSession, square: ReefSquare) {
    return session.act(session.currentPlayerId(), ActionType.IntroduceShrimp, square)
}

function move(session: TestSession, from: ReefSquare, to?: ReefSquare) {
    return session.act(session.currentPlayerId(), ActionType.MoveShrimp, { from, to })
}

function endTurn(session: TestSession) {
    return session.act(session.currentPlayerId(), ActionType.TakeOpenSeaSpace, {
        larvaColor: CoralColor.White
    })
}

function shrimpSquares(session: TestSession) {
    return session.state.shrimps.map((shrimp) => ({
        playerId: shrimp.playerId,
        boardId: shrimp.boardId,
        ...shrimp.coords
    }))
}

function startWithOwnShrimps(squares: { row: number; col: number }[]) {
    const session = startOnBoardThree(corals)
    session.edit((draft) => {
        draft.shrimps = squares.map((coords) => ({
            playerId: session.currentPlayerId(),
            boardId: 3,
            coords
        }))
    })
    return session
}

describe('introducing a shrimp', () => {
    it('puts one from behind the screen onto a coral, once a turn', () => {
        const session = startOnBoardThree(corals)
        introduce(session, onBoard(6, 0))

        expect(shrimpSquares(session)).toEqual([
            { playerId: session.currentPlayerId(), boardId: 3, row: 6, col: 0 }
        ])
        expect(currentPlayer(session).getShrimpsBehindScreen()).toBe(3)
        expect(() => introduce(session, onBoard(6, 1))).toThrow()
    })

    it('needs a coral without a shrimp, and never bare rock', () => {
        const session = startOnBoardThree(corals)
        session.edit((draft) => {
            draft.shrimps = [{ playerId: opponentId(session), boardId: 3, coords: at(5, 0) }]
        })
        expect(() => introduce(session, onBoard(6, 0))).toThrow()
        expect(() => introduce(session, onBoard(5, 1))).toThrow()
        introduce(session, onBoard(6, 1))
    })

    it('keeps at most two of a player’s own shrimps on one board', () => {
        const session = startWithOwnShrimps([at(6, 0), at(6, 1)])
        session.edit((draft) => {
            draft.reefs[1].polyps = [polyp(0, 5, CoralColor.Grey)]
        })
        expect(() => introduce(session, onBoard(2, 0))).toThrow()
        introduce(session, onBoard(0, 5, 4))
    })

    it('needs a shrimp left behind the screen', () => {
        const session = startOnBoardThree(corals)
        session.edit((draft) => {
            const player = draft.players.find((p) => p.playerId === session.currentPlayerId())
            if (player) player.shrimpsBehindScreen = 0
        })
        expect(
            session.hydrated().canIntroduceShrimp(session.currentPlayerId(), onBoard(6, 0))
        ).toBe(false)
        expect(session.hydrated().hasShrimpIntroduction(session.currentPlayerId())).toBe(false)
    })

    it('finishes the larva cube being played', () => {
        const session = startOnBoardThree(corals)
        giveScreenPolyps(session, CoralColor.White, 4)
        play(session, CoralColor.White)
        place(session, at(3, 0))
        introduce(session, onBoard(6, 0))

        expect(() => place(session, at(5, 1))).toThrow()
        play(session, CoralColor.White)
        place(session, at(5, 1))
    })
})

describe('moving a shrimp', () => {
    it('moves within its coral, to another coral, or back behind the screen', () => {
        const session = startWithOwnShrimps([at(6, 0)])
        move(session, onBoard(6, 0), onBoard(5, 0))
        move(session, onBoard(5, 0), onBoard(6, 1))
        expect(shrimpSquares(session)).toMatchObject([{ row: 6, col: 1 }])

        const behind = currentPlayer(session).getShrimpsBehindScreen()
        move(session, onBoard(6, 1))
        expect(session.state.shrimps).toEqual([])
        expect(currentPlayer(session).getShrimpsBehindScreen()).toBe(behind + 1)
    })

    it('can be done any number of times without finishing the cube being played', () => {
        const session = startWithOwnShrimps([at(6, 0)])
        giveScreenPolyps(session, CoralColor.White, 4)
        play(session, CoralColor.White)
        move(session, onBoard(6, 0), onBoard(5, 0))
        move(session, onBoard(5, 0), onBoard(6, 0))
        place(session, at(5, 1))
    })

    it('must go somewhere new', () => {
        const session = startWithOwnShrimps([at(6, 0)])
        expect(() => move(session, onBoard(6, 0), onBoard(6, 0))).toThrow()
    })

    it('moves only the player’s own shrimps', () => {
        const session = startOnBoardThree(corals)
        session.edit((draft) => {
            draft.shrimps = [{ playerId: opponentId(session), boardId: 3, coords: at(6, 0) }]
        })
        expect(() => move(session, onBoard(6, 0), onBoard(6, 1))).toThrow()
        expect(() => move(session, onBoard(6, 0))).toThrow()
    })

    it('never puts two shrimps on one coral or three of a player’s own on one board', () => {
        const session = startOnBoardThree(corals)
        const playerId = session.currentPlayerId()
        session.edit((draft) => {
            draft.reefs[1].polyps = [polyp(0, 5, CoralColor.Grey)]
            draft.shrimps = [
                { playerId: opponentId(session), boardId: 3, coords: at(5, 0) },
                { playerId, boardId: 3, coords: at(6, 1) },
                { playerId, boardId: 3, coords: at(2, 0) },
                { playerId, boardId: 4, coords: at(0, 5) }
            ]
        })
        expect(() => move(session, onBoard(6, 1), onBoard(6, 0))).toThrow()
        expect(() => move(session, onBoard(0, 5, 4), onBoard(5, 1))).toThrow()
        move(session, onBoard(6, 1), onBoard(5, 1))
    })

    it('may rest on bare rock, but not at the end of the turn', () => {
        const session = startWithOwnShrimps([at(6, 0)])
        move(session, onBoard(6, 0), onBoard(5, 1))

        const state = session.hydrated()
        expect(
            CoralColors.some((color) => state.canTakeOpenSeaSpace(session.currentPlayerId(), color))
        ).toBe(false)
        expect(() => endTurn(session)).toThrow()
        move(session, onBoard(5, 1), onBoard(5, 0))
        endTurn(session)
    })
})
