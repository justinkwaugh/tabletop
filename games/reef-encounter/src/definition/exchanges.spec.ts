import { describe, expect, it } from 'vitest'
import { CoralColor, coralCounts } from '../components/colors.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { isExchangeLarvaCube } from '../actions/exchangeLarvaCube.js'
import { isSearchBag } from '../actions/searchBag.js'
import type { TestSession } from '../util/testHelper.js'
import {
    at,
    currentPlayer,
    give,
    giveSupplyPolyps,
    place,
    play,
    polyp,
    startOnBoardThree
} from '../util/reefTestHelpers.js'

const White = CoralColor.White
const Pink = CoralColor.Pink

function buyCube(session: TestSession, color: CoralColor) {
    return session.act(session.currentPlayerId(), ActionType.ExchangeConsumedPolyp, { color })
}

function sellCube(session: TestSession, color: CoralColor) {
    return session.act(session.currentPlayerId(), ActionType.ExchangeLarvaCube, { color })
}

// The player holds one consumed white polyp, one pink larva cube, and four white supply polyps.
function startWithConsumedWhite() {
    const session = startOnBoardThree([polyp(6, 0, White)])
    giveSupplyPolyps(session, White, 4)
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
            draft.shrimps = [{ playerId, boardId: 3, coords: at(6, 0) }]
            draft.reefs[0].polyps.push(polyp(6, 1, Pink))
        })
        give(session, (player) => {
            player.consumedPolyps = { ...coralCounts(0), [White]: 2 }
        })
        buyCube(session, White)

        expect(() => play(session, Pink)).toThrow()
        expect(() => buyCube(session, White)).toThrow()
        expect(() =>
            session.act(playerId, ActionType.IntroduceShrimp, { boardId: 3, coords: at(6, 1) })
        ).toThrow()
        expect(() =>
            session.act(playerId, ActionType.TakeOpenSeaSpace, { larvaColor: White })
        ).toThrow()
        session.act(playerId, ActionType.MoveShrimp, {
            from: { boardId: 3, coords: at(6, 0) }
        })

        play(session, White)
        place(session, at(5, 0))
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

    it('after two cubes, may still be done, as the polyp paid can be taken back by action 8', () => {
        const session = startWithConsumedWhite()
        give(session, (player) => {
            player.larvaCubes = { ...coralCounts(0), [Pink]: 2 }
        })
        play(session, Pink)
        play(session, Pink)
        session.edit((draft) => {
            draft.bonusPolyps[White] = 0
        })

        buyCube(session, White)
        expect(session.state.bonusPolyps[White]).toBe(1)
        expect(sellCube(session, White)).toHaveLength(1)
        expect(session.state.bonusPolyps[White]).toBe(0)
    })

    it('finishes the larva cube being played', () => {
        const session = startWithConsumedWhite()
        give(session, (player) => {
            player.larvaCubes = { ...coralCounts(0), [White]: 1 }
            player.consumedPolyps = { ...coralCounts(0), [Pink]: 1 }
        })
        play(session, White)
        buyCube(session, Pink)
        expect(() => place(session, at(5, 0))).toThrow()
    })
})

describe('exchanging a larva cube for a polyp', () => {
    it('returns the cube and puts the bonus polyp in the supply, leaving the bag alone', () => {
        const session = startWithConsumedWhite()
        setBag(session, [Pink, White, Pink])
        const supply = session.state.larvaCubeSupply[Pink]

        const actions = sellCube(session, Pink)

        const player = currentPlayer(session)
        expect(actions).toHaveLength(1)
        expect(player.getLarvaCubes()[Pink]).toBe(0)
        expect(player.getKnownSupplyPolyps()[Pink]).toBe(1)
        expect(session.state.larvaCubeSupply[Pink]).toBe(supply + 1)
        expect(session.state.bonusPolyps[Pink]).toBe(0)
        expect(session.state.polypBag.remaining).toBe(3)
    })

    it('searches the bag when the bonus space is empty, which is a reveal', () => {
        const session = startWithConsumedWhite()
        setBag(session, [White, Pink])
        session.edit((draft) => {
            draft.bonusPolyps[Pink] = 0
        })

        const [exchange, search] = sellCube(session, Pink)

        expect(isExchangeLarvaCube(exchange) && exchange.metadata).toEqual({ searchesBag: true })
        expect(isSearchBag(search) && search.revealsInfo).toBe(true)
        expect(isSearchBag(search) && search.metadata).toEqual({ found: true })
        expect(currentPlayer(session).getLarvaCubes()[Pink]).toBe(0)
        expect(currentPlayer(session).getKnownSupplyPolyps()[Pink]).toBe(1)
        expect(session.state.polypBag.items).toEqual([White])
        expect(session.state.machineState).toBe(MachineState.TakingTurn)
    })

    it('changes nothing when the search finds none, and rules the colour out until one returns', () => {
        const session = startWithConsumedWhite()
        setBag(session, [White])
        session.edit((draft) => {
            draft.bonusPolyps[Pink] = 0
        })
        give(session, (player) => {
            player.consumedPolyps = { ...coralCounts(0), [Pink]: 1 }
        })

        const [, search] = sellCube(session, Pink)

        expect(isSearchBag(search) && search.metadata).toEqual({ found: false })
        expect(currentPlayer(session).getLarvaCubes()[Pink]).toBe(1)
        expect(session.state.turn.acted).toBe(false)
        expect(session.state.colorsMissingFromBag).toEqual([Pink])
        expect(() => sellCube(session, Pink)).toThrow()

        session.edit((draft) => {
            draft.bonusPolypsInBag = true
        })
        buyCube(session, Pink)
        expect(session.state.colorsMissingFromBag).toEqual([])
        expect(sellCube(session, Pink)).toHaveLength(2)
    })

    it('needs a bonus polyp of the colour or a bag that may hold one', () => {
        const session = startWithConsumedWhite()
        setBag(session, [])
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
        expect(() => place(session, at(5, 0))).toThrow()
        expect(session.state.turn.larvaCubesPlayed).toBe(1)
    })
})
