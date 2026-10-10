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
    startOnBoardThree
} from '../util/reefTestHelpers.js'

// Board 3 (docs/board-map.md): (6,0), (5,0), (6,1), (5,1) and (4,1) are rock.
const whiteCoral = (size: number): Polyp[] =>
    [at(6, 0), at(5, 0), at(6, 1), at(5, 1), at(4, 1), at(3, 1), at(2, 1)]
        .slice(0, size)
        .map((coords) => polyp(coords.row, coords.col, CoralColor.White))

function guardedBy(session: TestSession, playerId: string) {
    session.edit((draft) => {
        draft.shrimps = [{ playerId, boardId: 3, coords: at(6, 0) }]
    })
    return session
}

function opponentId(session: TestSession) {
    return (
        session.state.players.find((player) => player.playerId !== session.currentPlayerId())
            ?.playerId ?? ''
    )
}

function eat(session: TestSession, row = 5, col = 1) {
    return session.act(session.currentPlayerId(), ActionType.EatCoral, {
        boardId: 3,
        coords: at(row, col)
    })
}

function startWithOwnCoral(size: number) {
    const session = startOnBoardThree(whiteCoral(size))
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

    it('first fills an empty bonus space of the colour', () => {
        const session = startWithOwnCoral(5)
        session.edit((draft) => {
            draft.bonusPolyps[CoralColor.White] = 0
        })
        const bag = session.state.polypBag.remaining
        eat(session)
        expect(session.state.bonusPolyps[CoralColor.White]).toBe(1)
        expect(session.state.polypBag.remaining).toBe(bag + 3)
    })

    it('returns every polyp to the bag once the bonus polyps have joined it', () => {
        const session = startWithOwnCoral(5)
        session.edit((draft) => {
            draft.bonusPolyps = coralCounts(0)
            draft.bonusPolypsInBag = true
        })
        const bag = session.state.polypBag.remaining
        eat(session)
        expect(session.state.bonusPolyps[CoralColor.White]).toBe(0)
        expect(session.state.polypBag.remaining).toBe(bag + 4)
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
        const unguarded = startOnBoardThree(whiteCoral(5))
        expect(() => eat(unguarded)).toThrow()

        const theirs = startOnBoardThree(whiteCoral(5))
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
            from: { boardId: 3, coords: at(6, 0) },
            to: { boardId: 3, coords: at(5, 0) }
        })
        expect(() => eat(afterMove)).toThrow()

        const afterShrimp = startOnBoardThree([...whiteCoral(5), polyp(2, 3, CoralColor.Pink)])
        guardedBy(afterShrimp, afterShrimp.currentPlayerId())
        afterShrimp.act(afterShrimp.currentPlayerId(), ActionType.IntroduceShrimp, {
            boardId: 3,
            coords: at(2, 3)
        })
        expect(() => eat(afterShrimp)).toThrow()

        const twice = startOnBoardThree([
            ...whiteCoral(5),
            ...[at(2, 3), at(1, 3), at(0, 3), at(2, 4), at(1, 4)].map((coords) =>
                polyp(coords.row, coords.col, CoralColor.Pink)
            )
        ])
        const playerId = twice.currentPlayerId()
        twice.edit((draft) => {
            draft.shrimps = [
                { playerId, boardId: 3, coords: at(6, 0) },
                { playerId, boardId: 3, coords: at(2, 3) }
            ]
        })
        eat(twice)
        expect(() => eat(twice, 2, 3)).toThrow()
    })
})

describe('eating in the Advanced game', () => {
    function advanced(session: TestSession) {
        session.edit((draft) => {
            draft.advanced = true
        })
        return session
    }

    it('returns five polyps to the bag', () => {
        const session = advanced(startWithOwnCoral(7))
        const bag = session.state.polypBag.remaining

        eat(session)

        expect(session.state.polypBag.remaining).toBe(bag + 5)
        expect(currentPlayer(session).getKnownParrotfishPolyps()[CoralColor.White]).toBe(2)
    })

    it('still lets a coral of five be eaten, feeding the parrotfish nothing', () => {
        const session = advanced(startWithOwnCoral(5))
        const bag = session.state.polypBag.remaining

        eat(session)

        expect(session.state.polypBag.remaining).toBe(bag + 5)
        expect(currentPlayer(session).getKnownParrotfishPolyps()).toEqual(coralCounts(0))
        expect(currentPlayer(session).shrimpOnOpenSea).toBe(true)
    })

    it('still needs a coral of at least five polyps', () => {
        const session = advanced(startWithOwnCoral(4))
        expect(() => eat(session)).toThrow()
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
                player.secretScreenPolypCount = 0
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
