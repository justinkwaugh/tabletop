import {
    GameEngine,
    assertExists,
    playerUndoReach,
    type Game,
    type HydratedAction,
    type MachineStateHandler
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { RailroadId } from '../components/railroads.js'
import { Definition } from '../definition/definition.js'
import { MachineState } from '../definition/states.js'
import type {
    HydratedPromontoryPointGameState,
    PromontoryPointGameState
} from '../model/gameState.js'
import { PLACEMENTS_PER_TURN } from '../model/turn.js'
import { openSpaceIds } from '../rules/network.js'
import { stateAfterPlacingStep } from '../rules/placing.js'
import { TradeRefusal } from '../rules/trading.js'
import { withEmptyBag } from '../testing/fixtures.js'
import { canonical, startGame } from '../testing/startGame.js'
import { withNoRoomFor, withPlacementsMade, withTurnPieces } from '../testing/turnPieces.js'
import {
    action,
    actionEngine,
    edited,
    playerOf,
    revealedTurn,
    turnPlayer
} from '../testing/turns.js'
import { BuyShare } from './buyShare.js'
import { ScrapTrack, ScrapTrackRefusal, isScrapTrack } from './scrapTrack.js'
import { SellShare } from './sellShare.js'

const CP = 'railroad.cp'
const UP = 'railroad.up'
const KP = 'railroad.kp'

function scrap(
    game: Game,
    state: PromontoryPointGameState,
    railroadId: RailroadId = KP,
    playerId = turnPlayer(state),
    engine = actionEngine
) {
    return engine.executeCanonicalAction({
        action: action(ScrapTrack, state, { playerId, railroadId }),
        state,
        game
    })
}

// The turn revealed with KP boxed in by UP pieces and the named turn pieces.
function boxedIn(pieces: RailroadId[] = [KP, CP, UP], options: { emptyBag?: boolean } = {}) {
    const { game, state } = startGame()
    const turn = withNoRoomFor(withTurnPieces(revealedTurn(game, state), pieces), KP, UP)
    return { game, state: options.emptyBag === true ? withEmptyBag(turn) : turn }
}

// R-2.2-H2: placing steps lead on as the turn's handlers route them; every other action stays put.
const placingStep: MachineStateHandler<HydratedAction, HydratedPromontoryPointGameState> = {
    isValidAction: () => true,
    validActionsForPlayer: () => [],
    enter: () => {},
    onAction: (action, context) => {
        const turn = context.gameState.turn
        if (!isScrapTrack(action) || turn === undefined) {
            return context.gameState.machineState
        }
        return stateAfterPlacingStep(turn)
    }
}

const staysPut: MachineStateHandler<HydratedAction, HydratedPromontoryPointGameState> = {
    ...placingStep,
    onAction: (_action, context) => context.gameState.machineState
}

const placingEngine = new GameEngine({
    ...Definition.runtime,
    stateHandlers: {
        [MachineState.StartingTurn]: staysPut,
        [MachineState.TradingBeforePlacing]: placingStep,
        [MachineState.Placing]: placingStep,
        [MachineState.PayingRepairs]: staysPut,
        [MachineState.TradingAfterPlacing]: staysPut,
        [MachineState.EndOfGame]: staysPut
    }
})

describe('ScrapTrack', () => {
    it('R-3.3, R-3.3-H1: scraps a piece with no open space and draws one replacement face up', () => {
        const { game, state } = boxedIn()
        const topOfBag = state.bag.items.at(-1)
        assertExists(topOfBag, 'The bag holds a piece')
        expect(openSpaceIds(state.track, KP)).toEqual([])

        const { processedActions, updatedState } = scrap(game, state)

        expect(updatedState.scrapped[KP]).toBe(state.scrapped[KP] + 1)
        expect(updatedState.turn?.pieces).toEqual([CP, UP, topOfBag])
        expect(updatedState.bag.remaining).toBe(state.bag.remaining - 1)
        expect(updatedState.turn?.placementsLeft).toBe(PLACEMENTS_PER_TURN)
        expect(updatedState.turn?.placementsMade).toBe(0)
        expect(processedActions).toHaveLength(1)
        expect(processedActions[0]).toMatchObject({
            railroadId: KP,
            revealsInfo: true,
            metadata: { bagEmpty: false, replacement: topOfBag }
        })
    })

    it('R-3.3-H1: with the bag empty draws nothing and leaves one placement fewer', () => {
        const { game, state } = boxedIn([KP, CP, UP], { emptyBag: true })

        const { processedActions, updatedState } = scrap(game, state)

        expect(updatedState.scrapped[KP]).toBe(state.scrapped[KP] + 1)
        expect(updatedState.turn?.pieces).toEqual([CP, UP])
        expect(updatedState.turn?.placementsLeft).toBe(PLACEMENTS_PER_TURN - 1)
        expect(updatedState.bag.remaining).toBe(0)
        expect(processedActions[0]).toHaveProperty('metadata', { bagEmpty: true })
        expect(processedActions[0].revealsInfo).toBeFalsy()
    })

    it('R-X.2: a scrap that draws is an Undo barrier; one with the bag empty undoes', () => {
        const drawing = boxedIn()
        const drew = scrap(drawing.game, drawing.state)
        expect(playerUndoReach(drew.processedActions, turnPlayer(drawing.state))).toBeUndefined()

        const empty = boxedIn([KP, CP, UP], { emptyBag: true })
        const scrapped = scrap(empty.game, empty.state)
        const [scrapAction] = scrapped.processedActions
        expect(playerUndoReach(scrapped.processedActions, turnPlayer(empty.state))).toBe(
            scrapAction.index
        )
        expect(
            actionEngine.undoProcessedAction({ action: scrapAction, state: scrapped.updatedState })
        ).toEqual(empty.state)
    })

    it('R-3.3: is refused for a piece that has an open space', () => {
        const { game, state } = boxedIn()
        expect(() => scrap(game, state, CP)).toThrow(ScrapTrackRefusal.HasOpenSpace)
    })

    it('R-3.3: is refused for a railroad not among the turn pieces', () => {
        const { game, state } = boxedIn([CP, UP, UP])
        expect(() => scrap(game, state, KP)).toThrow(ScrapTrackRefusal.NotInTurnPieces)
    })

    it('R-2.2: is refused to a seat whose turn it is not', () => {
        const { game, state } = boxedIn()
        const other = state.turnManager.turnOrder[1]
        const allActive = edited(state, (draft) => {
            draft.activePlayerIds = [...draft.turnManager.turnOrder]
        })
        expect(() => scrap(game, allActive, KP, other)).toThrow(ScrapTrackRefusal.NotTurnPlayer)
    })

    it('R-3.3-H1: is allowed during placing and refused once no placement is left', () => {
        const { game, state } = boxedIn([KP, CP, UP, UP])
        const spaces = openSpaceIds(state.track, CP)
        const placing = edited(withPlacementsMade(state, [[spaces[0], CP]]), (draft) => {
            draft.machineState = MachineState.Placing
        })
        expect(scrap(game, placing).updatedState.scrapped[KP]).toBe(state.scrapped[KP] + 1)

        const ended = edited(placing, (draft) => {
            assertExists(draft.turn, 'A turn is under way')
            draft.turn.placementsMade = PLACEMENTS_PER_TURN
            draft.turn.placementsLeft = 0
        })
        expect(() => scrap(game, ended)).toThrow(ScrapTrackRefusal.PlacementsDone)
        const after = edited(ended, (draft) => {
            draft.machineState = MachineState.TradingAfterPlacing
        })
        expect(() => scrap(game, after)).toThrow(ScrapTrackRefusal.PlacementsDone)
    })

    it('R-4.3-H4, R-2.2 step 1: is refused while a Repairs is being paid or before the reveal', () => {
        const { game, state } = boxedIn()
        const paying = edited(state, (draft) => {
            draft.machineState = MachineState.PayingRepairs
        })
        expect(() => scrap(game, paying)).toThrow(ScrapTrackRefusal.RepairsPending)
        const starting = edited(state, (draft) => {
            draft.machineState = MachineState.StartingTurn
        })
        expect(() => scrap(game, starting)).toThrow(ScrapTrackRefusal.PlacingClosed)
    })

    it('R-2.2-H2: a scrap before the first placement closes trading until the placements end', () => {
        const { game, state } = boxedIn([KP, KP, KP], { emptyBag: true })
        const playerId = turnPlayer(state)
        expect(playerOf(state, playerId).shares[CP]).toBeGreaterThan(0)
        const trade = (current: PromontoryPointGameState) => ({
            buy: () =>
                placingEngine.executeCanonicalAction({
                    action: action(BuyShare, current, { playerId, railroadId: CP }),
                    state: current,
                    game
                }),
            sell: () =>
                placingEngine.executeCanonicalAction({
                    action: action(SellShare, current, { playerId, railroadId: CP }),
                    state: current,
                    game
                })
        })

        const first = canonical(scrap(game, state, KP, playerId, placingEngine).updatedState)
        // The rejected reading: trading stays open until a piece is actually placed.
        expect(first.machineState).not.toBe(MachineState.TradingBeforePlacing)
        expect(first.machineState).toBe(MachineState.Placing)
        expect(first.turn?.placementsMade).toBe(0)
        expect(trade(first).buy).toThrow(TradeRefusal.PlacingUnderWay)
        expect(trade(first).sell).toThrow(TradeRefusal.PlacingUnderWay)

        const second = canonical(scrap(game, first, KP, playerId, placingEngine).updatedState)
        expect(second.machineState).toBe(MachineState.Placing)
        expect(trade(second).buy).toThrow(TradeRefusal.PlacingUnderWay)

        const last = canonical(scrap(game, second, KP, playerId, placingEngine).updatedState)
        expect(last.machineState).toBe(MachineState.TradingAfterPlacing)
        expect(last.turn).toMatchObject({ pieces: [], placementsMade: 0, placementsLeft: 0 })
        expect(trade(last).buy().updatedState.turn?.tradesUsed).toBe(1)
        expect(trade(last).sell().updatedState.turn?.tradesUsed).toBe(1)
    })

    it('R-2.2-H2: a scrap that draws a replacement also closes trading', () => {
        const { game, state } = boxedIn()
        const { updatedState } = scrap(game, state, KP, turnPlayer(state), placingEngine)
        expect(updatedState.machineState).toBe(MachineState.Placing)
        expect(() =>
            placingEngine.executeCanonicalAction({
                action: action(BuyShare, updatedState, {
                    playerId: turnPlayer(updatedState),
                    railroadId: CP
                }),
                state: updatedState,
                game
            })
        ).toThrow(TradeRefusal.PlacingUnderWay)
    })

    it('R-5: draws the replacement from canonical state, never from a submitted field', () => {
        const { game, state } = boxedIn()
        const topOfBag = state.bag.items.at(-1)
        const submitted = {
            ...action(ScrapTrack, state, { playerId: turnPlayer(state), railroadId: KP }),
            metadata: { bagEmpty: false, replacement: topOfBag === CP ? UP : CP }
        }

        const { processedActions, updatedState } = actionEngine.executeCanonicalAction({
            action: submitted,
            state,
            game
        })

        expect(updatedState.turn?.pieces).toEqual([CP, UP, topOfBag])
        expect(processedActions[0]).toHaveProperty('metadata', {
            bagEmpty: false,
            replacement: topOfBag
        })
    })
})
