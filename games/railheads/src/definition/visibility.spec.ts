import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    assert,
    assertExists,
    getPrng,
    Visibility,
    type GameAction
} from '@tabletop/common'
import { isResolveIndustryAuction } from '../actions/resolveIndustryAuction.js'
import type { PlaceSealedBid } from '../actions/placeSealedBid.js'
import { ActionSpaceId, CompanyId, Industry } from '../editions/types.js'
import { RailheadsGameStateValidator, type RailheadsProjectedState } from '../model/gameState.js'
import { createGame } from '../testing/bot.js'
import { Table } from '../testing/table.js'
import { RailheadsActionSchemas } from './actionSchemas.js'
import { ActionType } from './actions.js'
import { RailheadsRuntime } from './runtime.js'
import { MachineState } from './states.js'

type Perspective = Visibility.Perspective

const engine = new GameEngine(RailheadsRuntime)
const investor = { kind: 'player', playerId: 'p1' } as const
const opponent = { kind: 'player', playerId: 'p2' } as const
const spectator = { kind: 'spectator' } as const
const perspectives: Perspective[] = [investor, opponent, spectator]

function projectState(state: RailheadsProjectedState, perspective: Perspective) {
    assert(RailheadsGameStateValidator.Check(state), 'Expected complete canonical state')
    return RailheadsRuntime.visibility.state.project(state, perspective)
}

// p1 holds the Start Player token and invests in grain; everyone can afford a sealed bid.
function sealedBidding(): Table {
    const table = new Table(4)
    table.playInitialAuction({
        [CompanyId.KPEV]: 'p0',
        [CompanyId.GBSE]: 'p1',
        [CompanyId.KSSE]: 'p2',
        [CompanyId.KWSE]: 'p3',
        [CompanyId.KBSB]: 'p1'
    })
    table.act('p1', { type: ActionType.ChooseAction, space: ActionSpaceId.IndustryInvestment })
    table.act('p1', { type: ActionType.InvestInIndustry, industry: Industry.Grain })
    return table
}

function bid(table: Table, playerId: string, amount: number): PlaceSealedBid {
    const auction = table.hydrated.industryAuction
    assertExists(auction, 'An industry auction is open')
    return {
        id: `bid-${playerId}`,
        gameId: table.state.gameId,
        type: ActionType.PlaceSealedBid,
        source: ActionSource.User,
        playerId,
        amount,
        simultaneousGroupId: auction.id,
        createdAt: new Date(0)
    }
}

function submit(table: Table, playerId: string, amount: number): GameAction[] {
    const result = engine.executeCanonicalAction({
        game: table.game,
        state: table.state,
        action: bid(table, playerId, amount)
    })
    table.state = result.updatedState
    table.processed.push(...result.processedActions)
    return result.processedActions
}

describe('Railheads protected visibility', () => {
    it('registers every action type for projection', () => {
        expect(Object.keys(RailheadsActionSchemas).sort()).toEqual(Object.values(ActionType).sort())
        const started = engine.startGame(createGame(3), '0123456789abcdef0123456789abcdef')
        expect(started.startedGame.protectedInformation).toBe(true)
        for (const perspective of perspectives) {
            const projected = projectState(started.initialState, perspective)
            expect(projected).not.toHaveProperty('masterSeed')
            expect(RailheadsRuntime.hydrator.hydrateState(projected).dehydrate()).toEqual(projected)
        }
    })

    it('shows a sealed bid only to its bidder until the auction resolves', () => {
        const table = sealedBidding()
        const before = table.state
        submit(table, 'p2', 6)
        for (const perspective of perspectives) {
            const projected = projectState(table.state, perspective)
            const owns = perspective.kind === 'player' && perspective.playerId === 'p2'
            expect(projected.industryAuction?.bids).toEqual(
                owns ? [{ playerId: 'p2', amount: 6 }] : [{ playerId: 'p2' }]
            )
            expect(projected.industryAuction?.bidders.toSorted()).toEqual(['p0', 'p1', 'p3'])
            expect(RailheadsRuntime.hydrator.hydrateState(projected).dehydrate()).toEqual(projected)
            const history = Visibility.projectActionHistory({
                currentState: table.state,
                actions: table.processed,
                visibility: RailheadsRuntime.visibility,
                perspective,
                replay: { game: table.game, runtime: RailheadsRuntime }
            })
            const projectedBid = history.actions.at(-1)
            assertExists(projectedBid, 'The bid is in the history')
            if (owns) expect(projectedBid).toHaveProperty('amount', 6)
            else expect(projectedBid).not.toHaveProperty('amount')
            const replayed = engine.applyProcessedAction({
                game: table.game,
                state: projectState(before, perspective),
                action: projectedBid
            })
            expect(replayed).toEqual(history.currentState)
        }
        expect(
            engine.getValidActionTypesForPlayer(
                table.game,
                projectState(table.state, opponent),
                'p2',
                {
                    perspective: opponent
                }
            )
        ).toEqual([])
    })

    it('lets a bidder submit locally from their own projection', () => {
        const table = sealedBidding()
        const action = bid(table, 'p3', 4)
        const game = table.game
        const canonical = engine.executeCanonicalAction({ game, state: table.state, action })
        const perspective = { kind: 'player', playerId: 'p3' } as const
        const optimistic = engine.executeAction({
            game,
            state: projectState(table.state, perspective),
            action,
            perspective
        })
        expect(optimistic.updatedState).toEqual(projectState(canonical.updatedState, perspective))
    })

    it('reveals every bid together when the last one is in', () => {
        const table = sealedBidding()
        submit(table, 'p2', 6)
        submit(table, 'p0', 0)
        submit(table, 'p1', 3)
        const processed = submit(table, 'p3', 5)
        const resolution = processed.find(isResolveIndustryAuction)
        assertExists(resolution, 'The last bid resolves the auction')
        expect(resolution.revealsInfo).toBe(true)
        expect(table.state.machineState).toBe(MachineState.ChoosingAction)
        for (const perspective of perspectives) {
            const projected = RailheadsRuntime.visibility.actions.project(resolution, perspective)
            expect(projected).toMatchObject({
                metadata: {
                    sale: {
                        buyerId: 'p2',
                        price: 5,
                        bids: [
                            { playerId: 'p1', amount: 3, submitted: true },
                            { playerId: 'p2', amount: 6, submitted: true },
                            { playerId: 'p3', amount: 5, submitted: true },
                            { playerId: 'p0', amount: 0, submitted: true }
                        ]
                    }
                }
            })
            expect(projectState(table.state, perspective).industryAuction).toBeUndefined()
        }
    })

    it('invents unknown bids for exploration within public limits, keeping known ones', () => {
        const table = sealedBidding()
        submit(table, 'p2', 6)
        submit(table, 'p0', 0)
        const otherWorld = structuredClone(table.state)
        const otherBid = otherWorld.industryAuction?.bids.find((sealed) => sealed.playerId === 'p0')
        assertExists(otherBid, 'p0 has bid')
        otherBid.amount = 9
        const populate = (source: RailheadsProjectedState, perspective: Perspective) =>
            RailheadsRuntime.exploration.createFromProjectedState({
                game: table.game,
                state: projectState(source, perspective),
                actions: [],
                perspective,
                random: getPrng(1234)
            })
        const sample = populate(table.state, opponent)
        expect(sample).toEqual(populate(otherWorld, opponent))
        expect(sample.industryAuction?.bids[0]).toEqual({ playerId: 'p2', amount: 6 })
        expect(RailheadsGameStateValidator.Check(sample)).toBe(true)
        for (const perspective of perspectives) {
            const hypothetical = populate(table.state, perspective)
            const auction = hypothetical.industryAuction
            assertExists(auction, 'The auction is still open')
            for (const { playerId, amount } of auction.bids) {
                const cash = hypothetical.players.find(
                    (player) => player.playerId === playerId
                )?.cash
                assertExists(amount, 'Every bid is filled in')
                expect(amount === 0 || amount >= auction.minimum).toBe(true)
                expect(amount).toBeLessThanOrEqual(cash ?? 0)
            }
        }
    })
})
