import { describe, expect, it } from 'vitest'
import { isPlacePolyp } from '../actions/placePolyp.js'
import { CoralColor, coralCounts } from '../components/colors.js'
import {
    at,
    polyp,
    startOnBoardOne,
    give,
    giveScreenPolyps,
    play,
    place,
    colorAt,
    currentPlayer
} from '../util/reefTestHelpers.js'
import { newTurnRecord } from '../model/turn.js'

describe('playing a larva cube', () => {
    it('returns the cube to the supply and lets polyps of its colour follow', () => {
        const session = startOnBoardOne([])
        giveScreenPolyps(session, CoralColor.White, 3)
        const supply = session.state.larvaCubeSupply[CoralColor.White]

        play(session, CoralColor.White)

        expect(currentPlayer(session).getLarvaCubes()[CoralColor.White]).toBe(1)
        expect(session.state.larvaCubeSupply[CoralColor.White]).toBe(supply + 1)
        expect(session.state.turn.placing).toEqual({ color: CoralColor.White, screenPolypsLeft: 4 })
    })

    it('allows two cubes a turn, and no polyps before the first', () => {
        const session = startOnBoardOne([])
        giveScreenPolyps(session, CoralColor.White, 3)
        give(session, (player) => {
            player.larvaCubes = { ...coralCounts(0), [CoralColor.White]: 3 }
        })

        expect(() => place(session, at(0, 0))).toThrow()
        play(session, CoralColor.White)
        play(session, CoralColor.White)
        expect(() => play(session, CoralColor.White)).toThrow()
    })

    it('rejects a colour the player has no cube of', () => {
        const session = startOnBoardOne([])
        giveScreenPolyps(session, CoralColor.White, 3)
        expect(() => play(session, CoralColor.Orange)).toThrow()
    })
})

describe('placing polyps', () => {
    it('places up to four screen polyps per cube, on rock only', () => {
        const session = startOnBoardOne([])
        giveScreenPolyps(session, CoralColor.White, 6)
        play(session, CoralColor.White)

        expect(() => place(session, at(2, 1))).toThrow()
        expect(() => place(session, at(0, 2))).toThrow()
        for (const coords of [at(0, 0), at(0, 1), at(1, 0), at(1, 1)]) {
            place(session, coords)
        }
        expect(() => place(session, at(3, 0))).toThrow()
        expect(currentPlayer(session).getKnownScreenPolyps()[CoralColor.White]).toBe(2)
        expect(colorAt(session, at(1, 1))).toBe(CoralColor.White)
    })

    it('plays the polyps others saw arrive before the secret ones', () => {
        const session = startOnBoardOne([])
        give(session, (player) => {
            player.knownScreenPolyps = { ...coralCounts(0), [CoralColor.Pink]: 1 }
            player.secretScreenPolyps = { ...coralCounts(0), [CoralColor.Pink]: 2 }
            player.secretScreenPolypCount = 2
            player.larvaCubes = { ...coralCounts(0), [CoralColor.Pink]: 1 }
        })
        play(session, CoralColor.Pink)

        place(session, at(0, 0))
        expect(currentPlayer(session).getKnownScreenPolyps()[CoralColor.Pink]).toBe(0)
        expect(currentPlayer(session).getSecretScreenPolyps()[CoralColor.Pink]).toBe(2)
        place(session, at(0, 1))
        expect(currentPlayer(session).getSecretScreenPolyps()[CoralColor.Pink]).toBe(1)
        expect(currentPlayer(session).getSecretScreenPolypCount()).toBe(1)
    })

    it('places any number of consumed polyps on top of the four', () => {
        const session = startOnBoardOne([])
        giveScreenPolyps(session, CoralColor.White, 0)
        give(session, (player) => {
            player.consumedPolyps = { ...coralCounts(0), [CoralColor.White]: 5 }
        })
        play(session, CoralColor.White)

        for (const coords of [at(0, 0), at(0, 1), at(1, 0), at(1, 1), at(2, 0)]) {
            place(session, coords, true)
        }
        expect(
            session.state.players.find((p) => p.playerId === session.currentPlayerId())
                ?.consumedPolyps[CoralColor.White]
        ).toBe(0)
    })

    it('stops the first cube once a second is played', () => {
        const session = startOnBoardOne([])
        give(session, (player) => {
            player.knownScreenPolyps = {
                ...coralCounts(0),
                [CoralColor.White]: 2,
                [CoralColor.Pink]: 2
            }
            player.larvaCubes = { ...coralCounts(0), [CoralColor.White]: 1, [CoralColor.Pink]: 1 }
        })
        play(session, CoralColor.White)
        place(session, at(0, 0))
        play(session, CoralColor.Pink)

        place(session, at(0, 4))
        expect(colorAt(session, at(0, 4))).toBe(CoralColor.Pink)
        expect(currentPlayer(session).getKnownScreenPolyps()[CoralColor.White]).toBe(1)
    })

    it('never places under a shrimp', () => {
        const session = startOnBoardOne([], [{ playerId: 'p0', coords: at(0, 0) }])
        giveScreenPolyps(session, CoralColor.White, 2)
        play(session, CoralColor.White)
        expect(() => place(session, at(0, 0))).toThrow()
    })

    it('never joins two corals of the same colour that each carry a shrimp', () => {
        const session = startOnBoardOne(
            [polyp(0, 3, CoralColor.White), polyp(0, 5, CoralColor.White)],
            [
                { playerId: 'p0', coords: at(0, 3) },
                { playerId: 'p1', coords: at(0, 5) }
            ]
        )
        giveScreenPolyps(session, CoralColor.White, 2)
        play(session, CoralColor.White)

        expect(() => place(session, at(0, 4))).toThrow()
    })

    it('may join two corals when only one carries a shrimp', () => {
        const session = startOnBoardOne(
            [polyp(0, 3, CoralColor.White), polyp(0, 5, CoralColor.White)],
            [{ playerId: 'p0', coords: at(0, 3) }]
        )
        giveScreenPolyps(session, CoralColor.White, 2)
        play(session, CoralColor.White)

        place(session, at(0, 4))
        expect(colorAt(session, at(0, 4))).toBe(CoralColor.White)
    })
})

describe('attacking', () => {
    const whiteCoral = [polyp(0, 3, CoralColor.White), polyp(0, 4, CoralColor.White)]

    it('lets a coral of two or more replace a weaker, unprotected polyp, which the attacker keeps', () => {
        const session = startOnBoardOne([...whiteCoral, polyp(0, 5, CoralColor.Yellow)])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        const [placement] = place(session, at(0, 5))

        expect(colorAt(session, at(0, 5))).toBe(CoralColor.White)
        expect(isPlacePolyp(placement) && placement.metadata?.attacked).toBe(CoralColor.Yellow)
        const consumed = session.state.players.find(
            (p) => p.playerId === session.currentPlayerId()
        )?.consumedPolyps
        expect(consumed?.[CoralColor.Yellow]).toBe(1)
    })

    it('needs the attacking coral to have at least two polyps already', () => {
        const session = startOnBoardOne([
            polyp(0, 4, CoralColor.White),
            polyp(0, 5, CoralColor.Yellow)
        ])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)
        expect(() => place(session, at(0, 5))).toThrow()
    })

    it('does not let two single polyps attack by being joined', () => {
        const session = startOnBoardOne([
            polyp(0, 4, CoralColor.White),
            polyp(0, 6, CoralColor.White),
            polyp(0, 5, CoralColor.Yellow)
        ])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)
        expect(() => place(session, at(0, 5))).toThrow()
    })

    it('cannot attack a stronger or equal colour', () => {
        const session = startOnBoardOne([...whiteCoral, polyp(0, 5, CoralColor.Pink)])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)
        expect(() => place(session, at(0, 5))).toThrow()
    })

    it('cannot attack a polyp a shrimp protects, on it or beside it in the same coral', () => {
        const onIt = startOnBoardOne(
            [...whiteCoral, polyp(0, 5, CoralColor.Yellow)],
            [{ playerId: 'p1', coords: at(0, 5) }]
        )
        giveScreenPolyps(onIt, CoralColor.White, 1)
        play(onIt, CoralColor.White)
        expect(() => place(onIt, at(0, 5))).toThrow()

        const beside = startOnBoardOne(
            [...whiteCoral, polyp(0, 5, CoralColor.Yellow), polyp(1, 5, CoralColor.Yellow)],
            [{ playerId: 'p1', coords: at(1, 5) }]
        )
        giveScreenPolyps(beside, CoralColor.White, 1)
        play(beside, CoralColor.White)
        expect(() => place(beside, at(0, 5))).toThrow()
    })

    it('can attack a polyp beside a shrimp that sits on a different coral', () => {
        const session = startOnBoardOne(
            [...whiteCoral, polyp(0, 5, CoralColor.Yellow), polyp(1, 5, CoralColor.Pink)],
            [{ playerId: 'p1', coords: at(1, 5) }]
        )
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        place(session, at(0, 5))
        expect(colorAt(session, at(0, 5))).toBe(CoralColor.White)
    })
})

describe('extra growth', () => {
    it('grows a bonus polyp into the empty starfish square, outside the four-polyp limit', () => {
        const session = startOnBoardOne([])
        giveScreenPolyps(session, CoralColor.White, 4)
        const bonusBefore = session.state.bonusPolyps[CoralColor.White]
        const bagBefore = session.state.polypBag.remaining
        play(session, CoralColor.White)

        const [placement] = place(session, at(2, 4))

        expect(colorAt(session, at(2, 3))).toBe(CoralColor.White)
        expect(isPlacePolyp(placement) && placement.metadata?.extraGrowth).toEqual(at(2, 3))
        expect(session.state.turn.placing?.screenPolypsLeft).toBe(3)
        expect(session.state.bonusPolyps[CoralColor.White]).toBe(bonusBefore)
        expect(session.state.polypBag.remaining).toBe(bagBefore - 1)
    })

    it('does not grow when the starfish square is already filled', () => {
        const session = startOnBoardOne([polyp(2, 3, CoralColor.Pink)])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        const [placement] = place(session, at(2, 4))
        expect(isPlacePolyp(placement) && placement.metadata?.extraGrowth).toBeUndefined()
        expect(colorAt(session, at(2, 3))).toBe(CoralColor.Pink)
    })

    it('does not grow when no bonus polyp of that colour is left', () => {
        const session = startOnBoardOne([])
        giveScreenPolyps(session, CoralColor.White, 1)
        session.edit((draft) => {
            draft.bonusPolyps[CoralColor.White] = 0
        })
        play(session, CoralColor.White)

        place(session, at(2, 4))
        expect(colorAt(session, at(2, 3))).toBeUndefined()
    })

    it('does not grow where the bonus polyp would join two guarded corals', () => {
        const session = startOnBoardOne(
            [polyp(1, 3, CoralColor.White), polyp(2, 2, CoralColor.Pink)],
            [{ playerId: 'p1', coords: at(1, 3) }]
        )
        session.edit((draft) => {
            draft.shrimps.push({ playerId: 'p0', boardId: 1, coords: at(2, 5) })
            draft.reefs[0].polyps.push(polyp(2, 5, CoralColor.White))
        })
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        place(session, at(2, 4))
        expect(colorAt(session, at(2, 3))).toBeUndefined()
    })
})

describe('extra growth in the Advanced game', () => {
    it('never happens', () => {
        const session = startOnBoardOne([])
        session.edit((draft) => {
            draft.advanced = true
        })
        giveScreenPolyps(session, CoralColor.White, 1)
        const bonusBefore = session.state.bonusPolyps[CoralColor.White]
        play(session, CoralColor.White)

        const [placement] = place(session, at(2, 4))

        expect(isPlacePolyp(placement) && placement.metadata?.extraGrowth).toBeUndefined()
        expect(colorAt(session, at(2, 3))).toBeUndefined()
        expect(session.state.bonusPolyps[CoralColor.White]).toBe(bonusBefore)
    })
})

describe('the end of a turn', () => {
    it('clears the played cubes for the next player', () => {
        const session = startOnBoardOne([])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.Grey)
        expect(session.state.turn).toEqual(newTurnRecord())
    })
})
