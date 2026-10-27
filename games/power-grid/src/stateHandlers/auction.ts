import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PhaseName, type HydratedPowerGridGameState } from '../model/gameState.js'
import { HydratedChoosePlant, isChoosePlant } from '../actions/choosePlant.js'
import { HydratedPassAuction, isPassAuction } from '../actions/passAuction.js'
import { HydratedRaiseBid, isRaiseBid } from '../actions/raiseBid.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedReplacePlant, ReplacePlant, isReplacePlant } from '../actions/replacePlant.js'
import { HydratedScrapPlant, isScrapPlant } from '../actions/scrapPlant.js'
import { CloseAuctions, HydratedCloseAuctions, isCloseAuctions } from '../actions/closeAuctions.js'
import {
    HydratedTrustTakesPlant,
    TrustTakesPlant,
    isTrustTakesPlant
} from '../actions/trustTakesPlant.js'
import { runSystemAction } from './systemAction.js'

type Context = MachineContext<HydratedPowerGridGameState>

function nextChooser(state: HydratedPowerGridGameState): string | undefined {
    return state.nextUndone(state.playerOrder)
}

function afterPurchase(state: HydratedPowerGridGameState): MachineState {
    if (state.trustDue()) {
        return MachineState.TrustTakingPlant
    }
    return nextChooser(state) ? MachineState.ChoosingPlant : MachineState.ClosingAuctions
}

export class ChoosingPlantStateHandler implements MachineStateHandler<
    HydratedChoosePlant | HydratedPassAuction,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isChoosePlant(action) || isPassAuction(action)
    }

    validActionsForPlayer(playerId: string, context: Context): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        const available: [ActionType, boolean][] = [
            [ActionType.ChoosePlant, HydratedChoosePlant.canChoose(state, playerId)],
            [ActionType.PassAuction, HydratedPassAuction.canPass(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: Context) {
        const state = context.gameState
        if (state.enterPhase(PhaseName.Auction)) {
            state.setDiscount()
            if (state.trust) {
                state.trust.tookPlant = false
            }
        }
        const chooser = nextChooser(state)
        if (!chooser) {
            throw Error('No player left to choose a power plant')
        }
        if (state.turnManager.currentTurn()?.playerId !== chooser) {
            state.startTurn(chooser)
        }
        state.activePlayerIds = [chooser]
    }

    onAction(action: HydratedChoosePlant | HydratedPassAuction, context: Context): MachineState {
        if (isChoosePlant(action)) {
            return action.metadata?.winner ? MachineState.ReplacingPlant : MachineState.Bidding
        }
        return afterPurchase(context.gameState)
    }
}

export class BiddingStateHandler implements MachineStateHandler<
    HydratedRaiseBid | HydratedPassBid,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isRaiseBid(action) || isPassBid(action)
    }

    validActionsForPlayer(playerId: string, context: Context): ActionType[] {
        const state = context.gameState
        const bidding = state.bidding()
        if (!bidding || bidding.currentBidderId !== playerId) {
            return []
        }
        return state.canAfford(playerId, bidding.highBid + 1)
            ? [ActionType.RaiseBid, ActionType.PassBid]
            : [ActionType.PassBid]
    }

    enter(context: Context) {
        const bidder = context.gameState.currentBidderId()
        context.gameState.activePlayerIds = bidder ? [bidder] : []
    }

    onAction(action: HydratedRaiseBid | HydratedPassBid, _context: Context): MachineState {
        return action.metadata?.winner ? MachineState.ReplacingPlant : MachineState.Bidding
    }
}

export class ReplacingPlantStateHandler implements MachineStateHandler<
    HydratedReplacePlant,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isReplacePlant(action)
    }

    validActionsForPlayer(_playerId: string, _context: Context): ActionType[] {
        return []
    }

    enter(context: Context) {
        runSystemAction(context, ReplacePlant)
    }

    onAction(_action: HydratedReplacePlant, context: Context): MachineState {
        return context.gameState.scrapping
            ? MachineState.ScrappingPlant
            : afterPurchase(context.gameState)
    }
}

export class ScrappingPlantStateHandler implements MachineStateHandler<
    HydratedScrapPlant,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isScrapPlant(action)
    }

    validActionsForPlayer(playerId: string, context: Context): ActionType[] {
        return context.gameState.scrapping?.playerId === playerId ? [ActionType.ScrapPlant] : []
    }

    enter(context: Context) {
        const scrapping = context.gameState.scrapping
        context.gameState.activePlayerIds = scrapping ? [scrapping.playerId] : []
    }

    onAction(_action: HydratedScrapPlant, context: Context): MachineState {
        return afterPurchase(context.gameState)
    }
}

export class ClosingAuctionsStateHandler implements MachineStateHandler<
    HydratedCloseAuctions,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isCloseAuctions(action)
    }

    validActionsForPlayer(_playerId: string, _context: Context): ActionType[] {
        return []
    }

    enter(context: Context) {
        runSystemAction(context, CloseAuctions)
    }

    // A player always buys first: the Trust is second in player order, so never last.
    onAction(_action: HydratedCloseAuctions, _context: Context): MachineState {
        return MachineState.BuyingResources
    }
}

export class TrustTakingPlantStateHandler implements MachineStateHandler<
    HydratedTrustTakesPlant,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isTrustTakesPlant(action)
    }

    validActionsForPlayer(_playerId: string, _context: Context): ActionType[] {
        return []
    }

    enter(context: Context) {
        runSystemAction(context, TrustTakesPlant)
    }

    onAction(_action: HydratedTrustTakesPlant, context: Context): MachineState {
        return afterPurchase(context.gameState)
    }
}
