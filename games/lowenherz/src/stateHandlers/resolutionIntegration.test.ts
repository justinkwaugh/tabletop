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
import { Pass } from '../actions/pass.js'
import { LookAtPoliticsPile } from '../actions/lookAtPoliticsPile.js'
import { TakePoliticsCard } from '../actions/takePoliticsCard.js'
import { isAdvanceResolution } from '../actions/advanceResolution.js'

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
    amount?: number,
    fromPlayerId?: string
): NegotiationMove {
    return {
        id: `negotiate-${playerId}-${kind}-${amount ?? ''}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.NegotiationMove,
        playerId,
        kind,
        fromPlayerId,
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
    space: { col: number; row: number }
): ExpandRegion {
    return {
        id: `expand-${regionId}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ExpandRegion,
        playerId,
        regionId,
        space
    }
}

function pass(playerId: string): Pass {
    return {
        id: `pass-${playerId}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.Pass,
        playerId
    }
}

function lookAtPoliticsPile(playerId: string, pile: 'A' | 'B'): LookAtPoliticsPile {
    return {
        id: `look-politics-${playerId}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.LookAtPoliticsPile,
        playerId,
        pile,
        revealsInfo: true
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
    it('drops a signer from the active players, and undoing the signature puts them back', () => {
        const playerIds = ['p1', 'p2']
        const game = buildGame(playerIds)
        const card: ActionCard = {
            id: 'card-1',
            back: CardBack.B,
            type: ActionCardType.Standard,
            top: { kind: 'politics' },
            middle: { kind: 'knight', count: 2 },
            bottom: { kind: 'knight', count: 1 }
        }
        let state = buildState(playerIds, card)
        for (const player of state.players) player.knightsInStock = 0

        state = engine.run(chooseAction('p1', 1), state, game).updatedState
        state = engine.run(chooseAction('p1', 2), state, game).updatedState
        state = engine.run(chooseAction('p2', 1), state, game).updatedState
        expect(state.machineState).toBe(MachineState.Negotiating)
        expect(state.activePlayerIds).toEqual(['p1', 'p2'])

        state = engine.run(
            negotiationMove('p1', NegotiationMoveKind.Propose, 3, 'p1'),
            state,
            game
        ).updatedState
        // Proposing is not committing: the offer is on the table and both sides still have a move.
        expect(state.activePlayerIds).toEqual(['p1', 'p2'])

        const signResult = engine.run(negotiationMove('p1', NegotiationMoveKind.Sign), state, game)
        state = signResult.updatedState
        expect(state.negotiation?.signedPlayerIds).toEqual(['p1'])
        expect(state.activePlayerIds).toEqual(['p2'])

        // And the way back. undoAction replays the action's stored undo patch, which the engine
        // compared over the whole state AFTER enter() had recomputed the active players - so the
        // signer is restored along with their signature, and can revise or decline. This is what
        // makes dropping them from activePlayerIds safe: GameEngine.isPlayerAllowed gates actions
        // on that list, but nothing gates Undo on it.
        const restored = engine.undoAction(state, signResult.processedActions[0])
        expect(restored.negotiation?.signedPlayerIds).toEqual([])
        expect(restored.activePlayerIds).toEqual(['p1', 'p2'])
        expect(restored.negotiation?.offer).toEqual({ fromPlayerId: 'p1', amount: 3 })
    })

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

        // 2p decision plan is [p1, p1, p2] - only the first player lays two. p1 and p2
        // both pick slot 1 (tied, negotiable); p1's other card goes to slot 2 solo, and
        // slot 3 ends up unchosen.
        state = engine.run(chooseAction('p1', 1), state, game).updatedState
        state = engine.run(chooseAction('p1', 2), state, game).updatedState
        // This is the 3rd and final decision - it should cascade straight into
        // negotiation over slot 1 within this same run() call.
        state = engine.run(chooseAction('p2', 1), state, game).updatedState

        expect(state.machineState).toBe(MachineState.Negotiating)
        expect(state.negotiation).toEqual({
            slot: 1,
            playerIds: ['p1', 'p2'],
            offer: undefined,
            signedPlayerIds: []
        })

        // p1 proposes to pay 3, p2 counter-proposes p1 should pay 4 instead (clearing
        // any signatures), both sign the 4-ducat offer - p2 wins slot 1 and pays... no,
        // p1 is named as payer, so p2 wins slot 1 and p1 pays p2 4.
        state = engine.run(
            negotiationMove('p1', NegotiationMoveKind.Propose, 3, 'p1'),
            state,
            game
        ).updatedState
        expect(state.negotiation?.offer).toEqual({ fromPlayerId: 'p1', amount: 3 })
        expect(state.negotiation?.signedPlayerIds).toEqual([])

        // A signature on the standing offer first, so the counter below has something to
        // withdraw. This is the ordinary shape of the flow: whoever moves first sets terms and
        // signs them, and the other side either signs those terms or changes them.
        state = engine.run(negotiationMove('p1', NegotiationMoveKind.Sign), state, game).updatedState
        expect(state.negotiation?.signedPlayerIds).toEqual(['p1'])

        state = engine.run(
            negotiationMove('p2', NegotiationMoveKind.Propose, 4, 'p2'),
            state,
            game
        ).updatedState
        expect(state.negotiation?.offer).toEqual({ fromPlayerId: 'p2', amount: 4 })
        // Changing the terms IS the counter-proposal, and it takes p1's signature with it -
        // nobody is held to terms they did not sign. This is what lets the UI treat "adjust the
        // offer and sign" as a counter rather than needing a separate action for it.
        expect(state.negotiation?.signedPlayerIds).toEqual([])

        // p2 signs their own proposal first - negotiation stays open on one signature,
        // and that signature stays undoable (nothing binds until both sides commit).
        // (revealsInfo is read off the PROCESSED action - the engine applies a clone and
        // hands the flagged, dehydrated copy back, which is what gets stored.)
        const firstSignResult = engine.run(negotiationMove('p2', NegotiationMoveKind.Sign), state, game)
        state = firstSignResult.updatedState
        expect(state.machineState).toBe(MachineState.Negotiating)
        expect(state.negotiation?.signedPlayerIds).toEqual(['p2'])
        expect(firstSignResult.processedActions[0].revealsInfo).toBeUndefined()

        // p1's signature completes the deal, handing p2 the politics slot - they must
        // take a card before the cascade can continue through slot 2, slot 3, and the
        // round advance.
        const closingSignResult = engine.run(negotiationMove('p1', NegotiationMoveKind.Sign), state, game)
        state = closingSignResult.updatedState
        // A completed deal is binding: money has changed hands under a two-party
        // agreement, so Undo must not be able to cross back over it (see
        // GameSession.undoableAction, which stops at any action flagged revealsInfo).
        expect(closingSignResult.processedActions[0].revealsInfo).toBe(true)
        expect(state.machineState).toBe(MachineState.TakingPoliticsCard)
        expect(state.politicsTakingPlayerId).toBe('p2')

        state = engine.run(lookAtPoliticsPile('p2', 'A'), state, game).updatedState
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

        // 2p plan is [p1, p1, p2]: p1 and p2 tie on slot 1, p1's other card is solo on
        // slot 2, slot 3 unchosen.
        state = engine.run(chooseAction('p1', 1), state, game).updatedState
        state = engine.run(chooseAction('p1', 2), state, game).updatedState
        state = engine.run(chooseAction('p2', 1), state, game).updatedState

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
        state = engine.run(lookAtPoliticsPile('p4', 'A'), state, game).updatedState
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
        state = engine.run(lookAtPoliticsPile('p4', 'A'), state, game).updatedState
        state = engine.run(takePoliticsCard('p4', 'A', 'test-card-a'), state, game).updatedState

        expect(state.machineState).toBe(MachineState.PlacingKnights)
        expect(state.knightPlacingPlayerId).toBe('p1')
        expect(state.knightsRemaining).toBe(1)

        state = engine.run(expandRegion('p1', 'r1', { col: 1, row: 0 }), state, game).updatedState

        expect(state.regions.find((r) => r.id === 'r1')!.squareKeys).toEqual(['0,0', '1,0'])
        expect(state.players.find((p) => p.playerId === 'p1')!.powerPoints).toBe(1)
        // A 2nd space of the same region is still on the table (up to 2 are always
        // allowed, regardless of the card's knight count) - the round doesn't
        // complete until p1 stops here instead.
        expect(state.machineState).toBe(MachineState.PlacingKnights)
        expect(state.expandingRegionId).toBe('r1')

        state = engine.run(pass('p1'), state, game).updatedState

        // Slot 3 had no choosers, so the round completes immediately after p1 stops
        // expanding - just like the knight-placement case.
        expect(state.machineState).toBe(MachineState.StartOfTurn)
        expect(state.firstPlayerId).toBe('p2') // rotated from p1
    })

    it("records what happened in each AdvanceResolution step's metadata (for UI history)", () => {
        const playerIds = ['p1', 'p2']
        const game = buildGame(playerIds)
        const card: ActionCard = {
            id: 'card-1',
            back: CardBack.B,
            type: ActionCardType.Standard,
            top: { kind: 'income', value: 6 },
            middle: { kind: 'knight', count: 1 },
            bottom: { kind: 'knight', count: 2 }
        }
        let state = buildState(playerIds, card)
        // Zeroed so slot 2/3 solo wins don't route into PlacingKnights, keeping this
        // test entirely about the AdvanceResolution cascade itself.
        for (const player of state.players) player.knightsInStock = 0

        state = engine.run(chooseAction('p1', 1), state, game).updatedState
        state = engine.run(chooseAction('p1', 2), state, game).updatedState
        // This last decision (2p plan's 3rd and final) cascades the whole rest of the
        // round - money bag split, slot 2 solo win, slot 3 unclaimed, round advance -
        // all within this one run() call.
        const result = engine.run(chooseAction('p2', 1), state, game)
        state = result.updatedState

        expect(state.machineState).toBe(MachineState.StartOfTurn)

        const advances = result.processedActions.filter(isAdvanceResolution)
        expect(advances).toHaveLength(4)

        expect(advances[0].metadata).toEqual({
            slot: 1,
            moneyBagRecipientIds: ['p1', 'p2'],
            moneyBagAmountEach: 3 // floor(6/2)
        })
        expect(advances[1].metadata).toEqual({
            slot: 2,
            slotResolved: true,
            slotWinnerPlayerId: 'p1',
            bandKind: 'knight',
            bandCount: 1,
            placementSkippedReason: 'noKnightsInStock'
        })
        // Nobody chose slot 3 - with only 3 decision cards between two players, a slot
        // going unclaimed is now an ordinary outcome, and it resolves with no winner.
        expect(advances[2].metadata).toEqual({
            slot: 3,
            slotResolved: true
        })
        expect(advances[3].metadata).toEqual({ roundAdvanced: true, newFirstPlayerId: 'p2' })
    })

    it('records tiedPlayerIds/tieWentToDuel:false metadata when a 2-way tie goes to negotiation', () => {
        const playerIds = ['p1', 'p2', 'p3']
        const game = buildGame(playerIds)
        const card: ActionCard = {
            id: 'card-1',
            back: CardBack.B,
            type: ActionCardType.Standard,
            top: { kind: 'politics' },
            middle: { kind: 'knight', count: 1 },
            bottom: { kind: 'knight', count: 2 }
        }
        const state = buildState(playerIds, card)

        // 3p plan is [p1, p1, p2, p3]. p1 and p2 tie on slot 1 (2-way, negotiable);
        // p1's other pick and p3 land on different solo slots. The cascade doesn't
        // begin until all 4 planned decisions are in, so the tie-to-negotiation
        // AdvanceResolution only shows up in p3's (the last) result.
        const result1 = engine.run(chooseAction('p1', 1), state, game)
        const result2 = engine.run(chooseAction('p1', 2), result1.updatedState, game)
        const result3 = engine.run(chooseAction('p2', 1), result2.updatedState, game)
        const result4 = engine.run(chooseAction('p3', 3), result3.updatedState, game)

        expect(result4.updatedState.machineState).toBe(MachineState.Negotiating)
        const negotiationAdvance = result4.processedActions.find(isAdvanceResolution)
        expect(negotiationAdvance?.metadata).toEqual({
            slot: 1,
            tiedPlayerIds: ['p1', 'p2'],
            tieWentToDuel: false
        })
    })

    it('records tiedPlayerIds/tieWentToDuel:true metadata when a 3-way tie goes to a duel', () => {
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
        const state = buildState(playerIds, card)

        // 4p plan is [p1, p2, p3, p4], one each. p1 solo-picks the money bag; p2/p3/p4
        // tie 3-way on slot 2 (straight to a duel).
        const result1 = engine.run(chooseAction('p1', 1), state, game)
        const result2 = engine.run(chooseAction('p2', 2), result1.updatedState, game)
        const result3 = engine.run(chooseAction('p3', 2), result2.updatedState, game)
        const result4 = engine.run(chooseAction('p4', 2), result3.updatedState, game)

        expect(result4.updatedState.machineState).toBe(MachineState.Dueling)
        // Two AdvanceResolution steps happen in this cascade: slot 1's money bag
        // payout, then slot 2's tie-to-duel routing - the one we want is the last.
        const duelAdvances = result4.processedActions.filter(isAdvanceResolution)
        expect(duelAdvances.at(-1)?.metadata).toEqual({
            slot: 2,
            tiedPlayerIds: ['p2', 'p3', 'p4'],
            tieWentToDuel: true
        })
    })
})
