import { describe, expect, it } from 'vitest'
import { isEatCoral } from '../actions/eatCoral.js'
import { CoralColor, coralCounts } from '../components/colors.js'
import type { Polyp } from '../model/reef.js'
import { ActionType } from './actions.js'
import type { TestSession } from '../util/testHelper.js'
import {
    at,
    currentPlayer,
    give,
    giveScreenPolyps,
    play,
    polyp,
    startOnBoardOne
} from '../util/reefTestHelpers.js'

// Board 1 (docs/board-map.md): (0,0), (0,1), (1,0), (1,1) and (1,2) are rock.
const whiteCoral = (size: number): Polyp[] =>
    [at(0, 0), at(0, 1), at(1, 0), at(1, 1), at(1, 2), at(1, 3), at(1, 4)]
        .slice(0, size)
        .map((coords) => polyp(coords.row, coords.col, CoralColor.White))

function guardedBy(session: TestSession, playerId: string) {
    session.edit((draft) => {
        draft.shrimps = [{ playerId, boardId: 1, coords: at(0, 0) }]
    })
    return session
}

function opponentId(session: TestSession) {
    return (
        session.state.players.find((player) => player.playerId !== session.currentPlayerId())
            ?.playerId ?? ''
    )
}

function eat(session: TestSession, row = 1, col = 1) {
    return session.act(session.currentPlayerId(), ActionType.EatCoral, {
        boardId: 1,
        coords: at(row, col)
    })
}

function startWithOwnCoral(size: number) {
    const session = startOnBoardOne(whiteCoral(size))
    return guardedBy(session, session.currentPlayerId())
}

describe('eating a coral', () => {
    it('returns four polyps to the bag and feeds the rest, with the shrimp, to the parrotfish', () => {
        const session = startWithOwnCoral(6)
        const bag = session.state.polypBag.remaining

        const [eaten] = eat(session)

        expect(session.state.reefs[0].polyps).toEqual([])
        expect(session.state.shrimps).toEqual([])
        expect(session.state.polypBag.remaining).toBe(bag + 4)
        const player = currentPlayer(session)
        expect(player.getKnownParrotfishPolyps()).toEqual({
            ...coralCounts(0),
            [CoralColor.White]: 2
        })
        expect(player.shrimpOnOpenSea).toBe(true)
        expect(player.getShrimpsInParrotfish()).toBe(0)
        expect(isEatCoral(eaten) && eaten.metadata).toEqual({
            color: CoralColor.White,
            polyps: 6,
            returnedToBag: 4,
            shrimpToOpenSea: true
        })
    })

    it('puts later shrimps inside the parrotfish', () => {
        const session = startWithOwnCoral(5)
        give(session, (player) => {
            player.shrimpOnOpenSea = true
        })
        eat(session)
        expect(currentPlayer(session).getShrimpsInParrotfish()).toBe(1)
    })

    it('scores the eaten polyps', () => {
        const session = startWithOwnCoral(7)
        const before = session.hydrated().scores()[session.currentPlayerId()].total
        eat(session)
        const white = session.hydrated().scores()[session.currentPlayerId()]
        expect(white.parrotfishPolyps[CoralColor.White]).toBeGreaterThanOrEqual(3)
        expect(white.total).toBeGreaterThan(before)
    })

    it('needs a coral of at least five polyps', () => {
        const session = startWithOwnCoral(4)
        expect(() => eat(session)).toThrow()
    })

    it('needs the coral guarded by the player’s own shrimp', () => {
        const unguarded = startOnBoardOne(whiteCoral(5))
        expect(() => eat(unguarded)).toThrow()

        const theirs = startOnBoardOne(whiteCoral(5))
        guardedBy(theirs, opponentId(theirs))
        expect(() => eat(theirs)).toThrow()
    })

    it('comes before every other action, once a turn', () => {
        const afterCube = startWithOwnCoral(5)
        giveScreenPolyps(afterCube, CoralColor.Pink, 1)
        play(afterCube, CoralColor.Pink)
        expect(() => eat(afterCube)).toThrow()

        const afterMove = startWithOwnCoral(5)
        afterMove.act(afterMove.currentPlayerId(), ActionType.MoveShrimp, {
            from: { boardId: 1, coords: at(0, 0) },
            to: { boardId: 1, coords: at(0, 1) }
        })
        expect(() => eat(afterMove)).toThrow()

        const afterShrimp = startOnBoardOne([...whiteCoral(5), polyp(3, 4, CoralColor.Pink)])
        guardedBy(afterShrimp, afterShrimp.currentPlayerId())
        afterShrimp.act(afterShrimp.currentPlayerId(), ActionType.IntroduceShrimp, {
            boardId: 1,
            coords: at(3, 4)
        })
        expect(() => eat(afterShrimp)).toThrow()

        const twice = startOnBoardOne([
            ...whiteCoral(5),
            ...[at(3, 4), at(3, 5), at(3, 6), at(4, 4), at(4, 5)].map((coords) =>
                polyp(coords.row, coords.col, CoralColor.Pink)
            )
        ])
        const playerId = twice.currentPlayerId()
        twice.edit((draft) => {
            draft.shrimps = [
                { playerId, boardId: 1, coords: at(0, 0) },
                { playerId, boardId: 1, coords: at(3, 4) }
            ]
        })
        eat(twice)
        expect(() => eat(twice, 3, 4)).toThrow()
    })
})

describe('breaking ties', () => {
    it('compares consumed polyps first, then polyps in corals the player’s shrimps guard', () => {
        const session = startWithOwnCoral(3)
        const playerId = session.currentPlayerId()
        const opponent = opponentId(session)
        session.edit((draft) => {
            for (const player of draft.players) {
                player.secretParrotfishPolyps = coralCounts(0)
                player.knownParrotfishPolyps = coralCounts(0)
                player.larvaCubes = coralCounts(0)
                player.knownScreenPolyps = coralCounts(0)
                player.secretScreenPolyps = coralCounts(0)
                player.consumedPolyps = coralCounts(0)
            }
        })
        expect(session.hydrated().leadingPlayerIds()).toEqual([playerId])

        session.edit((draft) => {
            const rival = draft.players.find((player) => player.playerId === opponent)
            if (rival) rival.consumedPolyps = { ...coralCounts(0), [CoralColor.Grey]: 1 }
        })
        expect(session.hydrated().leadingPlayerIds()).toEqual([opponent])
    })
})
