import { describe, expect, it } from 'vitest'
import { CoralColor, coralCounts } from '../components/colors.js'
import { ActionType } from './actions.js'
import type { TestSession } from '../util/testHelper.js'
import {
    at,
    currentPlayer,
    give,
    giveScreenPolyps,
    place,
    play,
    polyp,
    startOnBoardOne
} from '../util/reefTestHelpers.js'

const White = CoralColor.White
const Pink = CoralColor.Pink

function buyCube(session: TestSession, color: CoralColor) {
    return session.act(session.currentPlayerId(), ActionType.ExchangeConsumedPolyp, { color })
}

function sellCube(session: TestSession, color: CoralColor) {
    return session.act(session.currentPlayerId(), ActionType.ExchangeLarvaCube, { color })
}

// The player holds one consumed white polyp, one pink larva cube, and four white screen polyps.
function startWithConsumedWhite() {
    const session = startOnBoardOne([polyp(0, 0, White)])
    giveScreenPolyps(session, White, 4)
    give(session, (player) => {
        player.larvaCubes = { ...coralCounts(0), [Pink]: 1 }
        player.consumedPolyps = { ...coralCounts(0), [White]: 1 }
    })
    return session
}

function setBag(session: TestSession, items: CoralColor[]) {
    session.edit((draft) => {
        draft.polypBag = { items, remaining: items.length }
    })
}

describe('exchanging a consumed polyp for a larva cube', () => {
    it('takes a cube from the supply and puts the polyp in the bag', () => {
        const session = startWithConsumedWhite()
        const supply = session.state.larvaCubeSupply[White]
        const bag = session.state.polypBag.remaining

        buyCube(session, White)

        const player = currentPlayer(session)
        expect(player.consumedPolyps[White]).toBe(0)
        expect(player.getLarvaCubes()[White]).toBe(1)
        expect(session.state.larvaCubeSupply[White]).toBe(supply - 1)
        expect(session.state.polypBag.remaining).toBe(bag + 1)
        expect(session.state.turn.cubeToPlay).toBe(White)
    })

    it('must be followed by playing that cube, though shrimps may still move', () => {
        const session = startWithConsumedWhite()
        const playerId = session.currentPlayerId()
        session.edit((draft) => {
            draft.shrimps = [{ playerId, boardId: 1, coords: at(0, 0) }]
            draft.reefs[0].polyps.push(polyp(1, 0, Pink))
        })
        give(session, (player) => {
            player.consumedPolyps = { ...coralCounts(0), [White]: 2 }
        })
        buyCube(session, White)

        expect(() => play(session, Pink)).toThrow()
        expect(() => buyCube(session, White)).toThrow()
        expect(() =>
            session.act(playerId, ActionType.IntroduceShrimp, { boardId: 1, coords: at(1, 0) })
        ).toThrow()
        expect(() =>
            session.act(playerId, ActionType.TakeOpenSeaSpace, { larvaColor: White })
        ).toThrow()
        session.act(playerId, ActionType.MoveShrimp, {
            from: { boardId: 1, coords: at(0, 0) }
        })

        play(session, White)
        place(session, at(0, 1))
        expect(session.state.turn.cubeToPlay).toBeUndefined()
    })

    it('may be followed by exchanging that cube for a polyp instead', () => {
        const session = startWithConsumedWhite()
        buyCube(session, White)
        sellCube(session, White)
        expect(session.state.turn.cubeToPlay).toBeUndefined()
        expect(session.state.turn.larvaCubesPlayed).toBe(0)
    })

    it('needs a cube of the colour in the supply', () => {
        const session = startWithConsumedWhite()
        session.edit((draft) => {
            draft.larvaCubeSupply[White] = 0
        })
        expect(() => buyCube(session, White)).toThrow()
    })

    it('after two cubes, needs a bonus polyp so the cube can still be exchanged', () => {
        const session = startWithConsumedWhite()
        give(session, (player) => {
            player.larvaCubes = { ...coralCounts(0), [Pink]: 2 }
        })
        play(session, Pink)
        play(session, Pink)
        session.edit((draft) => {
            draft.bonusPolyps[White] = 0
        })
        expect(() => buyCube(session, White)).toThrow()

        session.edit((draft) => {
            draft.bonusPolyps[White] = 1
        })
        buyCube(session, White)
    })

    it('finishes the larva cube being played', () => {
        const session = startWithConsumedWhite()
        give(session, (player) => {
            player.larvaCubes = { ...coralCounts(0), [White]: 1 }
            player.consumedPolyps = { ...coralCounts(0), [Pink]: 1 }
        })
        play(session, White)
        buyCube(session, Pink)
        expect(() => place(session, at(0, 1))).toThrow()
    })
})

describe('exchanging a larva cube for a polyp', () => {
    it('returns the cube and puts a bonus polyp behind the screen, replaced from the bag', () => {
        const session = startWithConsumedWhite()
        setBag(session, [Pink, White, Pink])
        const supply = session.state.larvaCubeSupply[Pink]
        const bonus = session.state.bonusPolyps[Pink]

        sellCube(session, Pink)

        const player = currentPlayer(session)
        expect(player.getLarvaCubes()[Pink]).toBe(0)
        expect(player.getKnownScreenPolyps()[Pink]).toBe(1)
        expect(session.state.larvaCubeSupply[Pink]).toBe(supply + 1)
        expect(session.state.bonusPolyps[Pink]).toBe(bonus)
        expect(session.state.polypBag.remaining).toBe(2)
    })

    it('uses up the bonus polyp when the bag has none of the colour', () => {
        const session = startWithConsumedWhite()
        setBag(session, [White])
        const bonus = session.state.bonusPolyps[Pink]
        sellCube(session, Pink)
        expect(session.state.bonusPolyps[Pink]).toBe(bonus - 1)
        expect(session.state.polypBag.remaining).toBe(1)
    })

    it('needs a bonus polyp of the colour', () => {
        const session = startWithConsumedWhite()
        session.edit((draft) => {
            draft.bonusPolyps[Pink] = 0
        })
        expect(() => sellCube(session, Pink)).toThrow()
    })

    it('finishes the larva cube being played, and does not count as playing one', () => {
        const session = startWithConsumedWhite()
        give(session, (player) => {
            player.larvaCubes = { ...coralCounts(0), [White]: 1, [Pink]: 1 }
        })
        play(session, White)
        sellCube(session, Pink)
        expect(() => place(session, at(0, 1))).toThrow()
        expect(session.state.turn.larvaCubesPlayed).toBe(1)
    })
})
