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
import {
    AntiquesPerPlayer,
    coversAntiqueSet,
    hasDealtHandShape,
    type Antique
} from '../components/antiques.js'
import { Shops, type FountainId, type ShopId } from '../components/board.js'
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

type Collector = {
    playerId: string
    shops: Partial<Record<ShopId, number>>
    antiques: Antique[]
}

function setUpCollectors(
    session: ReturnType<typeof startSession>['session'],
    visitors: Partial<Record<FountainId, MarketColor[]>>,
    collectors: Collector[]
) {
    session.edit((state) => {
        state.round = 2
        for (const fountain of state.fountains) {
            fountain.visitors = visitors[fountain.fountainId] ?? []
        }
        for (const shop of state.shops) {
            const owner = collectors.find((collector) => shop.shopId in collector.shops)
            shop.ownerId = owner?.playerId
            shop.customers = owner?.shops[shop.shopId] ?? 0
        }
        for (const collector of collectors) {
            const player = state.players.find((seat) => seat.playerId === collector.playerId)
            assertExists(player, 'The collector is seated')
            player.antiques = collector.antiques
        }
    })
}

const BlueCollectorHand: Antique[] = [
    { color: MarketColor.Blue, value: 225 },
    { color: MarketColor.Blue, value: 200 },
    { color: MarketColor.Red, value: 150 },
    { color: MarketColor.Green, value: 100 },
    { color: MarketColor.Purple, value: 75 }
]

const RedCollectorHand: Antique[] = [
    { color: MarketColor.Red, value: 125 },
    { color: MarketColor.Red, value: 100 },
    { color: MarketColor.Blue, value: 175 },
    { color: MarketColor.Green, value: 125 },
    { color: MarketColor.Yellow, value: 150 }
]

function completeAntiqueSetByMove(session: ReturnType<typeof startSession>['session']) {
    const [mover, collector] = session.state.turnManager.turnOrder
    setUpCollectors(session, { 9: [MarketColor.Blue] }, [
        { playerId: collector, shops: { B4: 1, R1: 1, G1: 1, P1: 1 }, antiques: BlueCollectorHand }
    ])
    session.move(mover, 9, CardinalDirection.East)
    return { mover, collector }
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

    it('hides a pending antique set from every player until the turn commits', () => {
        const { session } = startSession()
        const { collector } = completeAntiqueSetByMove(session)
        expect(session.state.pendingAntiqueSets).toEqual([collector])
        for (const perspective of perspectivesFor(session.state)) {
            expect(project(session, perspective).pendingAntiqueSets).toEqual([])
        }
    })

    it('keeps unfinished hands and the undealt deck hidden after the game ends', () => {
        const { session } = startSession()
        const finished = playToEnd(session)
        for (const perspective of perspectivesFor(finished)) {
            const view = project(session, perspective, finished)
            expect(view.antiqueDeck.items).toEqual([])
            for (const player of view.players) {
                const own =
                    perspective.kind === 'player' && perspective.playerId === player.playerId
                const unfinished =
                    finished.players.find((seat) => seat.playerId === player.playerId)
                        ?.revealedAntiques.length === 0
                expect(player.antiques).toHaveLength(own && unfinished ? AntiquesPerPlayer : 0)
            }
        }
    })

    it.each([false, true])(
        'reports money visibility the same way the projection applies it (%s)',
        (concealedCash) => {
            const { session } = startSession({ concealedCash })
            const midGame = structuredClone(session.state)
            const finished = playToEnd(session)
            for (const state of [midGame, finished]) {
                const hydrated = MarracashRuntime.hydrator.hydrateState(state)
                for (const perspective of perspectivesFor(state)) {
                    const viewerId =
                        perspective.kind === 'player' ? perspective.playerId : undefined
                    for (const player of project(session, perspective, state).players) {
                        expect(Object.hasOwn(player, 'money')).toBe(
                            hydrated.isMoneyVisibleTo(viewerId, player.playerId, { concealedCash })
                        )
                    }
                }
            }
        }
    )

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
        const auctioneerEntry = secondView.auction?.bidding.participants.find(
            (participant) => participant.playerId === auctioneer
        )
        expect(auctioneerEntry?.submitted).toBe(true)
        expect(auctioneerEntry?.bid).toBeUndefined()
        const ownView = project(session, asPlayer(auctioneer))
        expect(
            ownView.auction?.bidding.participants.find(
                (participant) => participant.playerId === auctioneer
            )?.bid
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
        const ownHistory = Visibility.projectActionHistory({
            currentState: session.state,
            actions: session.actions,
            visibility: MarracashRuntime.visibility,
            perspective: asPlayer(auctioneer),
            replay: { game: session.game, runtime: MarracashRuntime }
        })
        expect(ownHistory.actions.find(isPlaceBid)?.amount).toBe(150)

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
                expect(hasDealtHandShape(player.antiques)).toBe(true)
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

    it('keeps a set completed this turn pending in the collector’s own sample', () => {
        const { session } = startSession()
        const { collector } = completeAntiqueSetByMove(session)
        const sample = populate(session, asPlayer(collector))
        expect(sample.pendingAntiqueSets).toEqual([collector])
    })

    it('lets an opponent’s hand be complete only through this turn’s customers', () => {
        const { session } = startSession()
        const { mover, collector } = completeAntiqueSetByMove(session)
        const pendingSamples = Array.from({ length: 100 }, (_, seed) =>
            populate(session, asPlayer(mover), seed)
        ).map((sample) => {
            const hydrated = MarracashRuntime.hydrator.hydrateState(sample)
            const covers = coversAntiqueSet(
                hydrated.getPlayerState(collector).antiques,
                hydrated.customersByColor(collector)
            )
            expect(sample.pendingAntiqueSets).toEqual(covers ? [collector] : [])
            return covers
        })
        expect(pendingSamples).toContain(true)
    })

    function pendingFromCoveringHands(
        sample: MarracashProjectedState,
        collectorIds: string[]
    ): string[] {
        const hydrated = MarracashRuntime.hydrator.hydrateState(sample)
        return collectorIds.filter((playerId) =>
            coversAntiqueSet(
                hydrated.getPlayerState(playerId).antiques,
                hydrated.customersByColor(playerId)
            )
        )
    }

    it('rebuilds two sets completed by one move in the order their customers entered', () => {
        const { session } = startSession()
        const [mover, blueCollector, redCollector] = session.state.turnManager.turnOrder
        setUpCollectors(session, { 4: [MarketColor.Blue, MarketColor.Red] }, [
            {
                playerId: blueCollector,
                shops: { B2: 1, R1: 1, G1: 1, P1: 1 },
                antiques: BlueCollectorHand
            },
            {
                playerId: redCollector,
                shops: { R3: 1, B4: 1, G3: 1, Y1: 1 },
                antiques: RedCollectorHand
            }
        ])
        session.move(mover, 4, CardinalDirection.South)
        expect(session.state.pendingAntiqueSets).toEqual([blueCollector, redCollector])

        for (const perspective of perspectivesFor(session.state)) {
            for (let seed = 0; seed < 20; seed++) {
                const sample = populate(session, perspective, seed)
                expect(sample.pendingAntiqueSets).toEqual(
                    pendingFromCoveringHands(sample, [blueCollector, redCollector])
                )
            }
        }
        expect(populate(session, asPlayer(blueCollector)).pendingAntiqueSets[0]).toBe(blueCollector)
    })

    it('rebuilds a set that only the turn’s second move completes', () => {
        const { session } = startSession()
        const [mover, collector] = session.state.turnManager.turnOrder
        setUpCollectors(session, { 9: [MarketColor.Blue], 4: [MarketColor.Blue] }, [
            {
                playerId: collector,
                shops: { B4: 0, B2: 0, R1: 1, G1: 1, P1: 1 },
                antiques: BlueCollectorHand
            }
        ])
        session.move(mover, 9, CardinalDirection.East)
        expect(session.state.pendingAntiqueSets).toEqual([])
        expect(populate(session, asPlayer(collector)).pendingAntiqueSets).toEqual([])

        session.move(mover, 4, CardinalDirection.South)
        expect(session.state.pendingAntiqueSets).toEqual([collector])
        expect(populate(session, asPlayer(collector)).pendingAntiqueSets).toEqual([collector])
        for (let seed = 0; seed < 20; seed++) {
            const sample = populate(session, asPlayer(mover), seed)
            expect(sample.pendingAntiqueSets).toEqual(pendingFromCoveringHands(sample, [collector]))
        }
    })

    it('samples the same way whatever the hidden hands really are', () => {
        const { session } = startSession()
        playOpeningRound(session)
        const [explorer, first, second] = session.state.turnManager.turnOrder
        const perspective = asPlayer(explorer)
        const swapped = structuredClone(session.state)
        const firstPlayer = swapped.players.find((player) => player.playerId === first)
        const secondPlayer = swapped.players.find((player) => player.playerId === second)
        assertExists(firstPlayer, 'Expected the first opponent')
        assertExists(secondPlayer, 'Expected the second opponent')
        ;[firstPlayer.antiques, secondPlayer.antiques] = [
            secondPlayer.antiques,
            firstPlayer.antiques
        ]
        swapped.antiqueDeck.items.reverse()

        const sampleFrom = (state: MarracashProjectedState) => {
            assertExists(
                MarracashRuntime.exploration.createFromProjectedState,
                'Expected population'
            )
            return MarracashRuntime.exploration.createFromProjectedState({
                game: session.game,
                state: project(session, perspective, state),
                actions: session.actions,
                perspective,
                random: getPrng(7)
            })
        }
        expect(project(session, perspective, swapped)).toEqual(project(session, perspective))
        expect(sampleFrom(swapped)).toEqual(sampleFrom(session.state))
    })

    it('fills in sealed bids that are still hidden', () => {
        const { session } = startSession()
        const [auctioneer, second] = session.state.turnManager.turnOrder
        session.startAuction(auctioneer, 'Y1')
        session.bid(auctioneer, 150)
        const sample = populate(session, asPlayer(second))
        const bid = sample.auction?.bidding.participants.find(
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
