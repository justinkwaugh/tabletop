import { describe, expect, it } from 'vitest'
import { TakingActionsStateHandler } from './takingActions.js'
import { MachineState } from '../definition/states.js'
import { ContainerColor } from '../model/container.js'
import { HydratedSailShip, SailShip } from '../actions/sailShip.js'
import { createActionBase, createMachineContext, createTestGameState } from '../utils/testUtils.js'

describe('TakingActionsStateHandler', () => {
    it('starts the next turn when entering with turnNeedsStart', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        state.turnNeedsStart = true

        const handler = new TakingActionsStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        expect(state.turnNeedsStart).toBe(false)
        expect(state.actionsRemaining).toBe(2)
        expect(state.interestPaidThisTurn).toBe(true)
        expect(state.activePlayerIds.length).toBe(1)
    })

    it('opens an auction when sailing to the foreign island with cargo', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        state.turnNeedsStart = true

        const handler = new TakingActionsStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const playerId = state.getActivePlayerId()
        const player = state.getPlayerState(playerId)
        player.ship.location = { type: 'open_sea' }
        player.ship.cargo = [ContainerColor.Blue]

        const action = new HydratedSailShip({
            ...createActionBase(SailShip, state),
            playerId,
            destination: { type: 'foreign_island' }
        })

        action.apply(state)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.AuctionBidding)
        expect(state.auction).toBeDefined()
        expect(state.actionsRemaining).toBe(0)
        expect(state.turnNeedsStart).toBe(true)
    })
})
