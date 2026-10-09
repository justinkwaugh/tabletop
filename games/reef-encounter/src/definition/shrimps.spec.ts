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
    startOnBoardOne
} from '../util/reefTestHelpers.js'

// Board 1 (docs/board-map.md): (0,0)-(0,1) form a white coral and (1,0) a pink one;
// (1,1) and (0,3) are bare rock.
const corals = [
    polyp(0, 0, CoralColor.White),
    polyp(0, 1, CoralColor.White),
    polyp(1, 0, CoralColor.Pink),
    polyp(0, 4, CoralColor.Grey)
]
const onBoard = (row: number, col: number, boardId: ReefBoardId = 1): ReefSquare => ({
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
    const session = startOnBoardOne(corals)
    session.edit((draft) => {
        draft.shrimps = squares.map((coords) => ({
            playerId: session.currentPlayerId(),
            boardId: 1,
            coords
        }))
    })
    return session
}

describe('introducing a shrimp', () => {
    it('puts one from behind the screen onto a coral, once a turn', () => {
        const session = startOnBoardOne(corals)
        introduce(session, onBoard(0, 0))

        expect(shrimpSquares(session)).toEqual([
            { playerId: session.currentPlayerId(), boardId: 1, row: 0, col: 0 }
        ])
        expect(currentPlayer(session).getShrimpsBehindScreen()).toBe(3)
        expect(() => introduce(session, onBoard(1, 0))).toThrow()
    })

    it('needs a coral without a shrimp, and never bare rock', () => {
        const session = startOnBoardOne(corals)
        session.edit((draft) => {
            draft.shrimps = [{ playerId: opponentId(session), boardId: 1, coords: at(0, 1) }]
        })
        expect(() => introduce(session, onBoard(0, 0))).toThrow()
        expect(() => introduce(session, onBoard(1, 1))).toThrow()
        introduce(session, onBoard(1, 0))
    })

    it('keeps at most two of a player’s own shrimps on one board', () => {
        const session = startWithOwnShrimps([at(0, 0), at(1, 0)])
        session.edit((draft) => {
            draft.reefs[1].polyps = [polyp(0, 0, CoralColor.Grey)]
        })
        expect(() => introduce(session, onBoard(0, 4))).toThrow()
        introduce(session, onBoard(0, 0, 2))
    })

    it('needs a shrimp left behind the screen', () => {
        const session = startOnBoardOne(corals)
        session.edit((draft) => {
            const player = draft.players.find((p) => p.playerId === session.currentPlayerId())
            if (player) player.shrimpsBehindScreen = 0
        })
        expect(
            session.hydrated().canIntroduceShrimp(session.currentPlayerId(), onBoard(0, 0))
        ).toBe(false)
        expect(session.hydrated().hasShrimpIntroduction(session.currentPlayerId())).toBe(false)
    })

    it('finishes the larva cube being played', () => {
        const session = startOnBoardOne(corals)
        giveScreenPolyps(session, CoralColor.White, 4)
        play(session, CoralColor.White)
        place(session, at(0, 3))
        introduce(session, onBoard(0, 0))

        expect(() => place(session, at(1, 1))).toThrow()
        play(session, CoralColor.White)
        place(session, at(1, 1))
    })
})

describe('moving a shrimp', () => {
    it('moves within its coral, to another coral, or back behind the screen', () => {
        const session = startWithOwnShrimps([at(0, 0)])
        move(session, onBoard(0, 0), onBoard(0, 1))
        move(session, onBoard(0, 1), onBoard(1, 0))
        expect(shrimpSquares(session)).toMatchObject([{ row: 1, col: 0 }])

        const behind = currentPlayer(session).getShrimpsBehindScreen()
        move(session, onBoard(1, 0))
        expect(session.state.shrimps).toEqual([])
        expect(currentPlayer(session).getShrimpsBehindScreen()).toBe(behind + 1)
    })

    it('can be done any number of times without finishing the cube being played', () => {
        const session = startWithOwnShrimps([at(0, 0)])
        giveScreenPolyps(session, CoralColor.White, 4)
        play(session, CoralColor.White)
        move(session, onBoard(0, 0), onBoard(0, 1))
        move(session, onBoard(0, 1), onBoard(0, 0))
        place(session, at(1, 1))
    })

    it('must go somewhere new', () => {
        const session = startWithOwnShrimps([at(0, 0)])
        expect(() => move(session, onBoard(0, 0), onBoard(0, 0))).toThrow()
    })

    it('moves only the player’s own shrimps', () => {
        const session = startOnBoardOne(corals)
        session.edit((draft) => {
            draft.shrimps = [{ playerId: opponentId(session), boardId: 1, coords: at(0, 0) }]
        })
        expect(() => move(session, onBoard(0, 0), onBoard(1, 0))).toThrow()
        expect(() => move(session, onBoard(0, 0))).toThrow()
    })

    it('never puts two shrimps on one coral or three of a player’s own on one board', () => {
        const session = startOnBoardOne(corals)
        const playerId = session.currentPlayerId()
        session.edit((draft) => {
            draft.reefs[1].polyps = [polyp(0, 0, CoralColor.Grey)]
            draft.shrimps = [
                { playerId: opponentId(session), boardId: 1, coords: at(0, 1) },
                { playerId, boardId: 1, coords: at(1, 0) },
                { playerId, boardId: 1, coords: at(0, 4) },
                { playerId, boardId: 2, coords: at(0, 0) }
            ]
        })
        expect(() => move(session, onBoard(1, 0), onBoard(0, 0))).toThrow()
        expect(() => move(session, onBoard(0, 0, 2), onBoard(1, 1))).toThrow()
        move(session, onBoard(1, 0), onBoard(1, 1))
    })

    it('may rest on bare rock, but not at the end of the turn', () => {
        const session = startWithOwnShrimps([at(0, 0)])
        move(session, onBoard(0, 0), onBoard(1, 1))

        const state = session.hydrated()
        expect(
            CoralColors.some((color) => state.canTakeOpenSeaSpace(session.currentPlayerId(), color))
        ).toBe(false)
        expect(() => endTurn(session)).toThrow()
        move(session, onBoard(1, 1), onBoard(0, 1))
        endTurn(session)
    })
})
