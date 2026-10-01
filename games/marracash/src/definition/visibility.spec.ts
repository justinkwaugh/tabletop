import {
    ActionSource,
    assert,
    assertExists,
    CardinalDirection,
    GameEngine,
    getPrng,
    Visibility
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { MoveVisitors } from '../actions/moveVisitors.js'
import { isPlaceBid } from '../actions/placeBid.js'
import { isResolveAuction } from '../actions/resolveAuction.js'
import { AntiquesPerPlayer, coversAntiqueSet } from '../components/antiques.js'
import { Shops } from '../components/board.js'
import { MarracashGameStateValidator, type MarracashProjectedState } from '../model/gameState.js'
import { createGame, createTestSession, playToEnd, TestMasterSeed } from '../util/testHelper.js'
import type { MarracashGameConfig } from './config.js'
import { ActionType } from './actions.js'
import { MarketColor } from './marketColor.js'
import { MarracashRuntime } from './runtime.js'

const engine = new GameEngine(MarracashRuntime)
const spectator = { kind: 'spectator' } as const

function startSession(config: Partial<MarracashGameConfig> = {}) {
    const game = createGame(3, config)
    const { initialState, startedGame } = engine.startGame(game, { masterSeed: TestMasterSeed })
    return { session: createTestSession(startedGame, initialState), startedGame }
}

function asPlayer(playerId: string) {
    return { kind: 'player', playerId } as const
}

function project(
    session: ReturnType<typeof startSession>['session'],
    perspective: Visibility.Perspective,
    state: MarracashProjectedState = session.state
): MarracashProjectedState {
    assert(MarracashGameStateValidator.Check(state), 'Projection starts from canonical state')
    return MarracashRuntime.visibility.state.project(state, perspective, {
        config: session.game.config
    })
}

function perspectivesFor(state: MarracashProjectedState): Visibility.Perspective[] {
    return [spectator, ...state.turnManager.turnOrder.map(asPlayer)]
}

function playOpeningRound(session: ReturnType<typeof startSession>['session']) {
    for (const [seat, auctioneer] of session.state.turnManager.turnOrder.entries()) {
        session.startAuction(auctioneer, Shops[seat].id)
        for (const bidder of session.state.turnManager.turnOrder) {
            session.bid(bidder, bidder === auctioneer ? 100 : 0)
        }
    }
}

describe('MarraCash visibility', () => {
    it('marks new games as protecting information', () => {
        expect(startSession().startedGame.protectedInformation).toBe(true)
    })

    it.each([false, true])('shows cash according to Concealed Cash (%s)', (concealedCash) => {
        const { session } = startSession({ concealedCash })
        for (const perspective of perspectivesFor(session.state)) {
            const view = project(session, perspective)
            for (const player of view.players) {
                const own =
                    perspective.kind === 'player' && perspective.playerId === player.playerId
                expect(Object.hasOwn(player, 'money')).toBe(!concealedCash || own)
            }
            expect(() => MarracashRuntime.hydrator.hydrateState(view)).not.toThrow()
        }
    })

    it('shows each player only their own antiques and never the undealt deck', () => {
        const { session } = startSession()
        for (const perspective of perspectivesFor(session.state)) {
            const view = project(session, perspective)
            for (const player of view.players) {
                const own =
                    perspective.kind === 'player' && perspective.playerId === player.playerId
                expect(player.antiques).toHaveLength(own ? AntiquesPerPlayer : 0)
                expect(player.revealedAntiques).toEqual([])
            }
            expect(view.antiqueDeck).toEqual({ items: [], remaining: 10 })
            expect(view).not.toHaveProperty('masterSeed')
            expect(view.protectedPrng).toEqual({ seed: 0, invocations: 0 })
        }
    })

    it('reveals cash to everyone at the end of the game', () => {
        const { session } = startSession({ concealedCash: true })
        const finished = playToEnd(session)
        const view = project(session, spectator, finished)
        expect(view.players.every((player) => player.money !== undefined)).toBe(true)
        expect(MarracashRuntime.scoring.finalScores(view)).toEqual(
            MarracashRuntime.scoring.finalScores(finished)
        )
    })

    it('keeps sealed bids secret until the auction resolves', () => {
        const { session } = startSession()
        const [auctioneer, second, third] = session.state.turnManager.turnOrder
        session.startAuction(auctioneer, 'Y1')
        session.bid(auctioneer, 150)

        const secondView = project(session, asPlayer(second))
        const auctioneerEntry = secondView.auction?.participants.find(
            (participant) => participant.playerId === auctioneer
        )
        expect(auctioneerEntry?.submitted).toBe(true)
        expect(auctioneerEntry?.bid).toBeUndefined()
        const ownView = project(session, asPlayer(auctioneer))
        expect(
            ownView.auction?.participants.find((participant) => participant.playerId === auctioneer)
                ?.bid
        ).toBe(150)

        const history = Visibility.projectActionHistory({
            currentState: session.state,
            actions: session.actions,
            visibility: MarracashRuntime.visibility,
            perspective: asPlayer(second),
            replay: { game: session.game, runtime: MarracashRuntime }
        })
        const bid = history.actions.find(isPlaceBid)
        expect(bid?.amount).toBeUndefined()

        session.bid(second, 0)
        session.bid(third, 200)
        const resolved = Visibility.projectActionHistory({
            currentState: session.state,
            actions: session.actions,
            visibility: MarracashRuntime.visibility,
            perspective: spectator,
            replay: { game: session.game, runtime: MarracashRuntime }
        })
        expect(resolved.actions.find(isResolveAuction)?.metadata?.bids).toEqual([
            { playerId: auctioneer, amount: 150 },
            { playerId: second, amount: 0 },
            { playerId: third, amount: 200 }
        ])
    })

    it('replays every perspective’s history through its own patches', () => {
        const { session } = startSession({ concealedCash: true })
        playOpeningRound(session)
        for (const perspective of perspectivesFor(session.state)) {
            const history = Visibility.projectActionHistory({
                currentState: session.state,
                actions: session.actions,
                visibility: MarracashRuntime.visibility,
                perspective,
                replay: { game: session.game, runtime: MarracashRuntime }
            })
            let view: MarracashProjectedState = history.currentState
            for (const action of history.actions.toReversed()) {
                view = engine.undoProcessedAction({ state: view, action })
            }
            expect(view).toEqual(project(session, perspective, session.initialState))
            for (const action of history.actions) {
                view = engine.applyProcessedAction({ game: session.game, state: view, action })
            }
            expect(JSON.parse(JSON.stringify(view))).toEqual(
                JSON.parse(JSON.stringify(history.currentState))
            )
        }
    })

    it('discovers an active player’s actions from their own concealed cash', () => {
        const { session } = startSession({ concealedCash: true })
        const playerId = session.currentPlayerId()
        const perspective = asPlayer(playerId)
        const view = project(session, perspective)
        expect(
            engine.getValidActionTypesForPlayer(session.game, view, playerId, { perspective })
        ).toEqual([ActionType.StartAuction])
    })

    it('leaves a move that needs an opponent’s hidden hand to the host', () => {
        const { session } = startSession()
        playOpeningRound(session)
        const mover = session.currentPlayerId()
        const owner = session.state.turnManager.turnOrder.find((playerId) => playerId !== mover)
        assertExists(owner, 'Expected an opponent')
        session.edit((state) => {
            for (const fountain of state.fountains) {
                if (fountain.fountainId === 9) fountain.visitors = [MarketColor.Blue]
            }
            for (const shop of state.shops) {
                if (shop.shopId === 'B4') shop.ownerId = owner
            }
        })

        const perspective = asPlayer(mover)
        const action: MoveVisitors = {
            id: 'optimistic-move',
            gameId: session.game.id,
            playerId: mover,
            source: ActionSource.User,
            type: ActionType.MoveVisitors,
            fountainId: 9,
            direction: CardinalDirection.East
        }
        expect(() =>
            engine.executeAction({
                game: session.game,
                state: project(session, perspective),
                action,
                perspective
            })
        ).toThrow(Visibility.UnavailableProjectedValueError)
    })
})

describe('MarraCash exploration', () => {
    function populate(
        session: ReturnType<typeof startSession>['session'],
        perspective: Visibility.Perspective,
        seed = 123
    ) {
        assertExists(MarracashRuntime.exploration.createFromProjectedState, 'Expected population')
        return MarracashRuntime.exploration.createFromProjectedState({
            game: session.game,
            state: project(session, perspective),
            actions: session.actions,
            perspective,
            random: getPrng(seed)
        })
    }

    it('samples unseen antiques consistently with the game so far', () => {
        const { session } = startSession()
        playOpeningRound(session)
        for (const perspective of perspectivesFor(session.state)) {
            const sample = populate(session, perspective)
            expect(MarracashGameStateValidator.Check(sample)).toBe(true)
            expect(populate(session, perspective)).toEqual(sample)
            expect(sample.antiqueDeck.items).toHaveLength(sample.antiqueDeck.remaining)
            const hydrated = MarracashRuntime.hydrator.hydrateState(sample)
            for (const player of hydrated.players) {
                expect(player.antiques).toHaveLength(AntiquesPerPlayer)
                expect(
                    coversAntiqueSet(player.antiques, hydrated.customersByColor(player.playerId))
                ).toBe(false)
                if (perspective.kind === 'player' && perspective.playerId === player.playerId) {
                    expect(player.antiques).toEqual(
                        session.state.players.find((p) => p.playerId === player.playerId)?.antiques
                    )
                }
            }
        }
    })

    it('fills in sealed bids that are still hidden', () => {
        const { session } = startSession()
        const [auctioneer, second] = session.state.turnManager.turnOrder
        session.startAuction(auctioneer, 'Y1')
        session.bid(auctioneer, 150)
        const sample = populate(session, asPlayer(second))
        const bid = sample.auction?.participants.find(
            (participant) => participant.playerId === auctioneer
        )?.bid
        assertExists(bid, 'Expected a sampled auctioneer bid')
        expect(bid).toBeGreaterThanOrEqual(100)
        expect(bid % 25).toBe(0)
    })

    it('is unavailable with Concealed Cash', () => {
        const { session } = startSession({ concealedCash: true })
        expect(() => populate(session, spectator)).toThrow('unavailable with Concealed Cash')
    })

    it('keeps canonical exploration identical to the source', () => {
        const { session } = startSession()
        expect(MarracashRuntime.exploration.createFromCanonicalState(session.state)).toEqual(
            session.state
        )
    })
})
