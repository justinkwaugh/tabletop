import { describe, expect, it } from 'vitest'
import { isPlacePolyp } from '../actions/placePolyp.js'
import { CoralColor, coralCounts } from '../components/colors.js'
import {
    at,
    polyp,
    startOnBoardThree,
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
        const session = startOnBoardThree([])
        giveScreenPolyps(session, CoralColor.White, 3)
        const supply = session.state.larvaCubeSupply[CoralColor.White]

        play(session, CoralColor.White)

        expect(currentPlayer(session).getLarvaCubes()[CoralColor.White]).toBe(1)
        expect(session.state.larvaCubeSupply[CoralColor.White]).toBe(supply + 1)
        expect(session.state.turn.placing).toEqual({ color: CoralColor.White, screenPolypsLeft: 4 })
    })

    it('allows two cubes a turn, and no polyps before the first', () => {
        const session = startOnBoardThree([])
        giveScreenPolyps(session, CoralColor.White, 3)
        give(session, (player) => {
            player.larvaCubes = { ...coralCounts(0), [CoralColor.White]: 3 }
        })

        expect(() => place(session, at(6, 0))).toThrow()
        play(session, CoralColor.White)
        play(session, CoralColor.White)
        expect(() => play(session, CoralColor.White)).toThrow()
    })

    it('rejects a colour the player has no cube of', () => {
        const session = startOnBoardThree([])
        giveScreenPolyps(session, CoralColor.White, 3)
        expect(() => play(session, CoralColor.Orange)).toThrow()
    })
})

describe('placing polyps', () => {
    it('places up to four screen polyps per cube, on rock only', () => {
        const session = startOnBoardThree([])
        giveScreenPolyps(session, CoralColor.White, 6)
        play(session, CoralColor.White)

        expect(() => place(session, at(5, 2))).toThrow()
        expect(() => place(session, at(4, 0))).toThrow()
        for (const coords of [at(6, 0), at(5, 0), at(6, 1), at(5, 1)]) {
            place(session, coords)
        }
        expect(() => place(session, at(6, 3))).toThrow()
        expect(currentPlayer(session).getKnownScreenPolyps()[CoralColor.White]).toBe(2)
        expect(colorAt(session, at(5, 1))).toBe(CoralColor.White)
    })

    it('plays the polyps others saw arrive before the secret ones', () => {
        const session = startOnBoardThree([])
        give(session, (player) => {
            player.knownScreenPolyps = { ...coralCounts(0), [CoralColor.Pink]: 1 }
            player.secretScreenPolyps = { ...coralCounts(0), [CoralColor.Pink]: 2 }
            player.secretScreenPolypCount = 2
            player.larvaCubes = { ...coralCounts(0), [CoralColor.Pink]: 1 }
        })
        play(session, CoralColor.Pink)

        place(session, at(6, 0))
        expect(currentPlayer(session).getKnownScreenPolyps()[CoralColor.Pink]).toBe(0)
        expect(currentPlayer(session).getSecretScreenPolyps()[CoralColor.Pink]).toBe(2)
        place(session, at(5, 0))
        expect(currentPlayer(session).getSecretScreenPolyps()[CoralColor.Pink]).toBe(1)
        expect(currentPlayer(session).getSecretScreenPolypCount()).toBe(1)
    })

    it('places any number of consumed polyps on top of the four', () => {
        const session = startOnBoardThree([])
        giveScreenPolyps(session, CoralColor.White, 0)
        give(session, (player) => {
            player.consumedPolyps = { ...coralCounts(0), [CoralColor.White]: 5 }
        })
        play(session, CoralColor.White)

        for (const coords of [at(6, 0), at(5, 0), at(6, 1), at(5, 1), at(6, 2)]) {
            place(session, coords, true)
        }
        expect(
            session.state.players.find((p) => p.playerId === session.currentPlayerId())
                ?.consumedPolyps[CoralColor.White]
        ).toBe(0)
    })

    it('stops the first cube once a second is played', () => {
        const session = startOnBoardThree([])
        give(session, (player) => {
            player.knownScreenPolyps = {
                ...coralCounts(0),
                [CoralColor.White]: 2,
                [CoralColor.Pink]: 2
            }
            player.larvaCubes = { ...coralCounts(0), [CoralColor.White]: 1, [CoralColor.Pink]: 1 }
        })
        play(session, CoralColor.White)
        place(session, at(6, 0))
        play(session, CoralColor.Pink)

        place(session, at(2, 0))
        expect(colorAt(session, at(2, 0))).toBe(CoralColor.Pink)
        expect(currentPlayer(session).getKnownScreenPolyps()[CoralColor.White]).toBe(1)
    })

    it('never places under a shrimp', () => {
        const session = startOnBoardThree([], [{ playerId: 'p0', coords: at(6, 0) }])
        giveScreenPolyps(session, CoralColor.White, 2)
        play(session, CoralColor.White)
        expect(() => place(session, at(6, 0))).toThrow()
    })

    it('never joins two corals of the same colour that each carry a shrimp', () => {
        const session = startOnBoardThree(
            [polyp(3, 0, CoralColor.White), polyp(1, 0, CoralColor.White)],
            [
                { playerId: 'p0', coords: at(3, 0) },
                { playerId: 'p1', coords: at(1, 0) }
            ]
        )
        giveScreenPolyps(session, CoralColor.White, 2)
        play(session, CoralColor.White)

        expect(() => place(session, at(2, 0))).toThrow()
    })

    it('may join two corals when only one carries a shrimp', () => {
        const session = startOnBoardThree(
            [polyp(3, 0, CoralColor.White), polyp(1, 0, CoralColor.White)],
            [{ playerId: 'p0', coords: at(3, 0) }]
        )
        giveScreenPolyps(session, CoralColor.White, 2)
        play(session, CoralColor.White)

        place(session, at(2, 0))
        expect(colorAt(session, at(2, 0))).toBe(CoralColor.White)
    })
})

describe('attacking', () => {
    const whiteCoral = [polyp(3, 0, CoralColor.White), polyp(2, 0, CoralColor.White)]

    it('lets a coral of two or more replace a weaker, unprotected polyp, which the attacker keeps', () => {
        const session = startOnBoardThree([...whiteCoral, polyp(1, 0, CoralColor.Yellow)])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        const [placement] = place(session, at(1, 0))

        expect(colorAt(session, at(1, 0))).toBe(CoralColor.White)
        expect(isPlacePolyp(placement) && placement.metadata?.attacked).toBe(CoralColor.Yellow)
        const consumed = session.state.players.find(
            (p) => p.playerId === session.currentPlayerId()
        )?.consumedPolyps
        expect(consumed?.[CoralColor.Yellow]).toBe(1)
    })

    it('needs the attacking coral to have at least two polyps already', () => {
        const session = startOnBoardThree([
            polyp(2, 0, CoralColor.White),
            polyp(1, 0, CoralColor.Yellow)
        ])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)
        expect(() => place(session, at(1, 0))).toThrow()
    })

    it('does not let two single polyps attack by being joined', () => {
        const session = startOnBoardThree([
            polyp(2, 0, CoralColor.White),
            polyp(0, 0, CoralColor.White),
            polyp(1, 0, CoralColor.Yellow)
        ])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)
        expect(() => place(session, at(1, 0))).toThrow()
    })

    it('cannot attack a stronger or equal colour', () => {
        const session = startOnBoardThree([...whiteCoral, polyp(1, 0, CoralColor.Pink)])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)
        expect(() => place(session, at(1, 0))).toThrow()
    })

    it('cannot attack a polyp a shrimp protects, on it or beside it in the same coral', () => {
        const onIt = startOnBoardThree(
            [...whiteCoral, polyp(1, 0, CoralColor.Yellow)],
            [{ playerId: 'p1', coords: at(1, 0) }]
        )
        giveScreenPolyps(onIt, CoralColor.White, 1)
        play(onIt, CoralColor.White)
        expect(() => place(onIt, at(1, 0))).toThrow()

        const beside = startOnBoardThree(
            [...whiteCoral, polyp(1, 0, CoralColor.Yellow), polyp(1, 1, CoralColor.Yellow)],
            [{ playerId: 'p1', coords: at(1, 1) }]
        )
        giveScreenPolyps(beside, CoralColor.White, 1)
        play(beside, CoralColor.White)
        expect(() => place(beside, at(1, 0))).toThrow()
    })

    it('names the weaker polyps a shrimp protects from an attack beside them', () => {
        const session = startOnBoardThree(
            [...whiteCoral, polyp(1, 0, CoralColor.Yellow), polyp(1, 1, CoralColor.Yellow)],
            [{ playerId: 'p1', coords: at(1, 1) }]
        )
        expect(session.hydrated().shrimpProtectedPolyps(3, CoralColor.White)).toEqual([at(1, 0)])
        expect(session.hydrated().shrimpProtectedPolyps(3, CoralColor.Yellow)).toEqual([])
    })

    it('can attack a polyp beside a shrimp that sits on a different coral', () => {
        const session = startOnBoardThree(
            [...whiteCoral, polyp(1, 0, CoralColor.Yellow), polyp(1, 1, CoralColor.Pink)],
            [{ playerId: 'p1', coords: at(1, 1) }]
        )
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        place(session, at(1, 0))
        expect(colorAt(session, at(1, 0))).toBe(CoralColor.White)
    })
})

describe('extra growth', () => {
    it('grows a bonus polyp into the empty starfish square, outside the four-polyp limit', () => {
        const session = startOnBoardThree([])
        giveScreenPolyps(session, CoralColor.White, 4)
        const bonusBefore = session.state.bonusPolyps[CoralColor.White]
        const bagBefore = session.state.polypBag.remaining
        play(session, CoralColor.White)

        const [placement] = place(session, at(2, 2))

        expect(colorAt(session, at(3, 2))).toBe(CoralColor.White)
        expect(isPlacePolyp(placement) && placement.metadata?.extraGrowth).toEqual(at(3, 2))
        expect(session.state.turn.placing?.screenPolypsLeft).toBe(3)
        expect(session.state.bonusPolyps[CoralColor.White]).toBe(bonusBefore)
        expect(session.state.polypBag.remaining).toBe(bagBefore - 1)
    })

    it('does not grow when the starfish square is already filled', () => {
        const session = startOnBoardThree([polyp(3, 2, CoralColor.Pink)])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        const [placement] = place(session, at(2, 2))
        expect(isPlacePolyp(placement) && placement.metadata?.extraGrowth).toBeUndefined()
        expect(colorAt(session, at(3, 2))).toBe(CoralColor.Pink)
    })

    it('does not grow when no bonus polyp of that colour is left', () => {
        const session = startOnBoardThree([])
        giveScreenPolyps(session, CoralColor.White, 1)
        session.edit((draft) => {
            draft.bonusPolyps[CoralColor.White] = 0
        })
        play(session, CoralColor.White)

        place(session, at(2, 2))
        expect(colorAt(session, at(3, 2))).toBeUndefined()
    })

    it('does not grow where the bonus polyp would join two guarded corals', () => {
        const session = startOnBoardThree(
            [polyp(3, 1, CoralColor.White), polyp(4, 2, CoralColor.Pink)],
            [{ playerId: 'p1', coords: at(3, 1) }]
        )
        session.edit((draft) => {
            draft.shrimps.push({ playerId: 'p0', boardId: 3, coords: at(1, 2) })
            draft.reefs[0].polyps.push(polyp(1, 2, CoralColor.White))
        })
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        place(session, at(2, 2))
        expect(colorAt(session, at(3, 2))).toBeUndefined()
    })
})

describe('extra growth in the Advanced game', () => {
    it('never happens', () => {
        const session = startOnBoardThree([])
        session.edit((draft) => {
            draft.advanced = true
        })
        giveScreenPolyps(session, CoralColor.White, 1)
        const bonusBefore = session.state.bonusPolyps[CoralColor.White]
        play(session, CoralColor.White)

        const [placement] = place(session, at(2, 2))

        expect(isPlacePolyp(placement) && placement.metadata?.extraGrowth).toBeUndefined()
        expect(colorAt(session, at(3, 2))).toBeUndefined()
        expect(session.state.bonusPolyps[CoralColor.White]).toBe(bonusBefore)
    })
})

describe('the end of a turn', () => {
    it('clears the played cubes for the next player', () => {
        const session = startOnBoardThree([])
        giveScreenPolyps(session, CoralColor.White, 1)
        play(session, CoralColor.White)

        session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.Grey)
        expect(session.state.turn).toEqual(newTurnRecord())
    })
})
