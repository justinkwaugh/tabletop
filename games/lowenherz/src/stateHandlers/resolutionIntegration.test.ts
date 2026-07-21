import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    Color,
    Game,
    GameEngine,
    GameStatus,
    GameStorage,
    PlayerStatus
} from '@tabletop/common'
import { LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { LowenherzRuntime } from '../definition/runtime.js'
import { ChooseAction } from '../actions/chooseAction.js'
import { NegotiationMove, NegotiationMoveKind } from '../actions/negotiationMove.js'
import { SubmitDuelBid } from '../actions/submitDuelBid.js'
import { PlaceKnight } from '../actions/placeKnight.js'
import { ExpandRegion } from '../actions/expandRegion.js'
import { TakePoliticsCard } from '../actions/takePoliticsCard.js'

const engine = new GameEngine(LowenherzRuntime)

function buildGame(playerIds: string[]): Game {
    return {
        id: 'game-1',
        typeId: 'lowenherz',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: playerIds[0],
        name: 'Test Game',
        players: playerIds.map((id) => ({
            id,
            isHuman: true,
            name: id,
            status: PlayerStatus.Joined
        })),
        config: {},
        hotseat: true,
        createdAt: new Date(),
        winningPlayerIds: [],
        storage: GameStorage.Local
    }
}

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function buildState(
    playerIds: string[],
    card: ActionCard,
    board: { squares: BoardSquare[][]; walls: [] } = blankBoard(),
    regions: LowenherzGameState['regions'] = []
): LowenherzGameState {
    const colors = [Color.Pink, Color.Yellow, Color.Purple, Color.Gray]
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: colors[index],
        money: 12,
        powerPoints: 0,
        knightsInStock: 12,
        politicsCards: []
    }))

    return {
        id: 'game-1',
        gameId: 'game-1',
        players,
        // Matches what ChoosingActionsStateHandler.enter() would have set - the first
        // player in the decision plan is always the seating order's first entry.
        activePlayerIds: [playerIds[0]],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.ChoosingActions,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board,
        regions,
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: playerIds[0],
        neutralColor: playerIds.length < 4 ? colors[playerIds.length] : undefined,
        actionDeck: [],
        currentActionCard: card,
        decisions: [],
        resolvedSlots: [],
        // One dummy card in each pile, so any test whose slot 1 politics winner needs
        // to actually take a card has something to pick.
        politicsCardPileA: [{ id: 'test-card-a', type: PoliticsCardType.Alliance }],
        politicsCardPileB: [{ id: 'test-card-b', type: PoliticsCardType.Renegade }]
    }
}

function chooseAction(playerId: string, slot: 1 | 2 | 3): ChooseAction {
    return {
        id: `choose-${playerId}-${slot}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ChooseAction,
        playerId,
        slot
    }
}

function negotiationMove(
    playerId: string,
    kind: NegotiationMoveKind,
    amount?: number
): NegotiationMove {
    return {
        id: `negotiate-${playerId}-${kind}-${amount ?? ''}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.NegotiationMove,
        playerId,
        kind,
        amount
    }
}

function submitDuelBid(playerId: string, amount: number): SubmitDuelBid {
    return {
        id: `duel-${playerId}-${amount}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.SubmitDuelBid,
        playerId,
        amount
    }
}

function placeKnight(playerId: string, col: number, row: number): PlaceKnight {
    return {
        id: `knight-${col}-${row}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceKnight,
        playerId,
        col,
        row
    }
}

function expandRegion(
    playerId: string,
    regionId: string,
    spaces: { col: number; row: number }[]
): ExpandRegion {
    return {
        id: `expand-${regionId}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ExpandRegion,
        playerId,
        regionId,
        spaces
    }
}

function takePoliticsCard(playerId: string, pile: 'A' | 'B', cardId: string): TakePoliticsCard {
    return {
        id: `take-politics-${playerId}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.TakePoliticsCard,
        playerId,
        pile,
        cardId
    }
}

describe('resolution cascade (via the real GameEngine)', () => {
    it('resolves a 2-way tie through negotiation, then auto-cascades solo slots and advances the round', () => {
        const playerIds = ['p1', 'p2']
        const game = buildGame(playerIds)
        const card: ActionCard = {
            id: 'card-1',
            back: CardBack.B,
            type: ActionCardType.Standard,
            top: { kind: 'politics' },
            // middle/bottom are knight slots here (rather than border) so a solo win
            // doesn't route into wall placement - that's covered by its own dedicated
            // tests below. This test is only about negotiation, so knightsInStock is
            // zeroed out for both players right after, keeping slot 2/3 solo wins from
            // routing into knight placement either.
            middle: { kind: 'knight', count: 2 },
            bottom: { kind: 'knight', count: 1 }
        }
        let state = buildState(playerIds, card)
        for (const player of state.players) player.knightsInStock = 0

        // 2p decision plan is [p1, p1, p2, p2]. p1 and p2 both pick slot 1 (tied,
        // negotiable); p1 also picks slot 2 solo, p2 also picks slot 3 solo.
        state = engine.run(chooseAction('p1', 1), state, game).updatedState
        state = engine.run(chooseAction('p1', 2), state, game).updatedState
        state = engine.run(chooseAction('p2', 1), state, game).updatedState
        // This is the 4th and final decision - it should cascade straight into
        // negotiation over slot 1 within this same run() call.
        state = engine.run(chooseAction('p2', 3), state, game).updatedState

        expect(state.machineState).toBe(MachineState.Negotiating)
        expect(state.negotiation).toEqual({
            slot: 1,
            playerIds: ['p1', 'p2'],
            turnPlayerId: 'p1',
            offer: undefined
        })

        // p1 offers 3, p2 counters with 4, p1 accepts - p2 wins slot 1 and pays p1 4.
        state = engine.run(negotiationMove('p1', NegotiationMoveKind.Offer, 3), state, game).updatedState
        expect(state.negotiation?.offer).toEqual({ fromPlayerId: 'p1', amount: 3 })
        expect(state.negotiation?.turnPlayerId).toBe('p2')

        state = engine.run(negotiationMove('p2', NegotiationMoveKind.Offer, 4), state, game).updatedState
        expect(state.negotiation?.offer).toEqual({ fromPlayerId: 'p2', amount: 4 })
        expect(state.negotiation?.turnPlayerId).toBe('p1')

        // Accepting hands p2 the politics slot - they must take a card before the
        // cascade can continue through slot 2, slot 3, and the round advance.
        state = engine.run(negotiationMove('p1', NegotiationMoveKind.Accept), state, game).updatedState
        expect(state.machineState).toBe(MachineState.TakingPoliticsCard)
        expect(state.politicsTakingPlayerId).toBe('p2')

        state = engine.run(takePoliticsCard('p2', 'A', 'test-card-a'), state, game).updatedState

        expect(state.machineState).toBe(MachineState.StartOfTurn)
        expect(state.firstPlayerId).toBe('p2') // rotated from p1
        expect(state.decisions).toEqual([])
        expect(state.currentActionCard).toBeUndefined()
        expect(state.resolvedSlots).toEqual([])

        const p1 = state.players.find((p) => p.playerId === 'p1')!
        const p2 = state.players.find((p) => p.playerId === 'p2')!
        expect(p1.money).toBe(12 + 4) // accepted p2's 4-ducat offer
        expect(p2.money).toBe(12 - 4) // paid to win slot 1
    })

    it('declining negotiation forces a duel', () => {
        const playerIds = ['p1', 'p2']
        const game = buildGame(playerIds)
        const card: ActionCard = {
            id: 'card-1',
            back: CardBack.B,
            type: ActionCardType.Standard,
            top: { kind: 'politics' },
            middle: { kind: 'border', count: 2 },
            bottom: { kind: 'knight', count: 1 }
        }
        let state = buildState(playerIds, card)

        state = engine.run(chooseAction('p1', 1), state, game).updatedState
        state = engine.run(chooseAction('p1', 2), state, game).updatedState
        state = engine.run(chooseAction('p2', 1), state, game).updatedState
        state = engine.run(chooseAction('p2', 3), state, game).updatedState

        expect(state.machineState).toBe(MachineState.Negotiating)

        state = engine.run(negotiationMove('p1', NegotiationMoveKind.Decline), state, game).updatedState

        expect(state.machineState).toBe(MachineState.Dueling)
        expect(state.duel).toEqual({ slot: 1, playerIds: ['p1', 'p2'], bids: [], tieCount: 0 })
    })

    it('resolves a 3-way duel, including a re-duel and a second-tie giveup, then advances the round', () => {
        const playerIds = ['p1', 'p2', 'p3', 'p4']
        const game = buildGame(playerIds)
        const card: ActionCard = {
            id: 'card-1',
            back: CardBack.B,
            type: ActionCardType.Standard,
            top: { kind: 'income', value: 6 },
            middle: { kind: 'border', count: 2 },
            bottom: { kind: 'knight', count: 1 }
        }
        let state = buildState(playerIds, card)

        // 4p plan is [p1, p2, p3, p4], one decision each. p1 solo-picks the money
        // bag (slot 1); p2/p3/p4 all tie on slot 2 (straight to a duel, no
        // negotiation, since there are 3+ of them); no one picks slot 3.
        state = engine.run(chooseAction('p1', 1), state, game).updatedState
        state = engine.run(chooseAction('p2', 2), state, game).updatedState
        state = engine.run(chooseAction('p3', 2), state, game).updatedState
        state = engine.run(chooseAction('p4', 2), state, game).updatedState

        expect(state.machineState).toBe(MachineState.Dueling)
        expect(state.duel).toEqual({ slot: 2, playerIds: ['p2', 'p3', 'p4'], bids: [], tieCount: 0 })
        // The money bag (6 ducats, 1 chooser) should have already paid out.
        expect(state.players.find((p) => p.playerId === 'p1')!.money).toBe(12 + 6)

        state = engine.run(submitDuelBid('p2', 2), state, game).updatedState
        state = engine.run(submitDuelBid('p3', 5), state, game).updatedState
        // p3 and p4 tie for the max bid (5) - re-duel among just the two of them.
        state = engine.run(submitDuelBid('p4', 5), state, game).updatedState

        expect(state.machineState).toBe(MachineState.Dueling)
        expect(state.duel).toEqual({ slot: 2, playerIds: ['p3', 'p4'], bids: [], tieCount: 1 })

        state = engine.run(submitDuelBid('p3', 3), state, game).updatedState
        // p3 and p4 tie AGAIN - a second tie means no one performs the action, and
        // this should cascade through slot 3 (no choosers) and advance the round.
        state = engine.run(submitDuelBid('p4', 3), state, game).updatedState

        expect(state.machineState).toBe(MachineState.StartOfTurn)
        expect(state.firstPlayerId).toBe('p2') // rotated from p1
        expect(state.resolvedSlots).toEqual([])

        // No one's money changed from bidding - a double tie means everyone keeps
        // their money (nothing was ever actually paid to the bank).
        for (const playerId of ['p2', 'p3', 'p4']) {
            expect(state.players.find((p) => p.playerId === playerId)!.money).toBe(12)
        }
    })

    it('a solo knight-slot win routes into PlacingKnights, then placing it advances the round', () => {
        const playerIds = ['p1', 'p2', 'p3', 'p4']
        const game = buildGame(playerIds)
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink } // p1's castle
        const card: ActionCard = {
            id: 'card-1',
            back: CardBack.B,
            type: ActionCardType.Standard,
            top: { kind: 'politics' },
            middle: { kind: 'knight', count: 1 },
            bottom: { kind: 'knight', count: 2 }
        }
        let state = buildState(playerIds, card, board)

        // 4p plan is [p1, p2, p3, p4], one decision each. p2/p3/p4 all tie on slot 1
        // (3-way, straight to a duel); p1 solo-picks slot 2 (knight); no one picks
        // slot 3.
        state = engine.run(chooseAction('p1', 2), state, game).updatedState
        state = engine.run(chooseAction('p2', 1), state, game).updatedState
        state = engine.run(chooseAction('p3', 1), state, game).updatedState
        state = engine.run(chooseAction('p4', 1), state, game).updatedState

        expect(state.machineState).toBe(MachineState.Dueling)
        expect(state.duel).toEqual({ slot: 1, playerIds: ['p2', 'p3', 'p4'], bids: [], tieCount: 0 })

        // Distinct bids so slot 1 resolves in one round. p4 wins the politics slot and
        // must take a card before the cascade continues into slot 2's solo knight win.
        state = engine.run(submitDuelBid('p2', 1), state, game).updatedState
        state = engine.run(submitDuelBid('p3', 2), state, game).updatedState
        state = engine.run(submitDuelBid('p4', 3), state, game).updatedState

        expect(state.machineState).toBe(MachineState.TakingPoliticsCard)
        expect(state.politicsTakingPlayerId).toBe('p4')
        state = engine.run(takePoliticsCard('p4', 'A', 'test-card-a'), state, game).updatedState

        expect(state.machineState).toBe(MachineState.PlacingKnights)
        expect(state.knightPlacingPlayerId).toBe('p1')
        expect(state.knightsRemaining).toBe(1)

        state = engine.run(placeKnight('p1', 1, 0), state, game).updatedState

        expect(state.board.squares[0][1].knightColor).toBe(Color.Pink)
        expect(state.players.find((p) => p.playerId === 'p1')!.knightsInStock).toBe(11)
        // Slot 3 had no choosers, so the round completes immediately after the knight
        // is placed.
        expect(state.machineState).toBe(MachineState.StartOfTurn)
        expect(state.firstPlayerId).toBe('p2') // rotated from p1
    })

    it('a knight-slot winner can expand their region instead of placing a knight, advancing the round', () => {
        const playerIds = ['p1', 'p2', 'p3', 'p4']
        const game = buildGame(playerIds)
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink } // p1's castle
        // Castles far from the action so the wide-open remainder has 2+ distinct
        // castle colors in it (as any real game would) and isn't itself misidentified
        // by expandRegion's detectNewRegions call as p1's own region - p1's tracked
        // region here isn't actually walled in on the board, so without this it would
        // leak into, and be conflated with, the rest of the open board.
        board.squares[8][12] = { type: SquareType.Blank, castleColor: Color.Yellow }
        board.squares[8][13] = { type: SquareType.Blank, castleColor: Color.Purple }
        const existingRegions = [{ id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] }]
        const card: ActionCard = {
            id: 'card-1',
            back: CardBack.B,
            type: ActionCardType.Standard,
            top: { kind: 'politics' },
            middle: { kind: 'knight', count: 1 },
            bottom: { kind: 'knight', count: 2 }
        }
        let state = buildState(playerIds, card, board, existingRegions)

        // Same shape as the knight-placement test above: p2/p3/p4 tie 3-way on slot 1
        // (straight to a duel), p1 solo-picks slot 2 (knight), no one picks slot 3.
        state = engine.run(chooseAction('p1', 2), state, game).updatedState
        state = engine.run(chooseAction('p2', 1), state, game).updatedState
        state = engine.run(chooseAction('p3', 1), state, game).updatedState
        state = engine.run(chooseAction('p4', 1), state, game).updatedState

        state = engine.run(submitDuelBid('p2', 1), state, game).updatedState
        state = engine.run(submitDuelBid('p3', 2), state, game).updatedState
        state = engine.run(submitDuelBid('p4', 3), state, game).updatedState

        expect(state.machineState).toBe(MachineState.TakingPoliticsCard)
        state = engine.run(takePoliticsCard('p4', 'A', 'test-card-a'), state, game).updatedState

        expect(state.machineState).toBe(MachineState.PlacingKnights)
        expect(state.knightPlacingPlayerId).toBe('p1')
        expect(state.knightsRemaining).toBe(1)

        state = engine.run(expandRegion('p1', 'r1', [{ col: 1, row: 0 }]), state, game).updatedState

        expect(state.regions.find((r) => r.id === 'r1')!.squareKeys).toEqual(['0,0', '1,0'])
        expect(state.players.find((p) => p.playerId === 'p1')!.powerPoints).toBe(1)
        // Slot 3 had no choosers, so the round completes immediately after the
        // expansion - just like the knight-placement case.
        expect(state.machineState).toBe(MachineState.StartOfTurn)
        expect(state.firstPlayerId).toBe('p2') // rotated from p1
    })
})
