import type { HydratedAction, MachineContext } from '@tabletop/common'
import { isBuyShare } from '../actions/buyShare.js'
import { HydratedEndTurn } from '../actions/endTurn.js'
import { HydratedPlaceTrack, isPlaceTrack } from '../actions/placeTrack.js'
import { HydratedScrapTrack, isScrapTrack } from '../actions/scrapTrack.js'
import { isSellShare } from '../actions/sellShare.js'
import { RAILROAD_IDS } from '../components/railroads.js'
import { ActionType } from '../definition/actions.js'
import { normalizePromontoryPointConfig } from '../definition/config.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { openSpaceIds } from '../rules/network.js'
import { stateAfterPlacingStep } from '../rules/placing.js'
import { buyShareRefusal, sellShareRefusal } from '../rules/trading.js'
import { turnPlayerId } from '../rules/turnPlayer.js'

export type ActionAvailability = [ActionType, boolean][]

export function availableActions(availability: ActionAvailability): ActionType[] {
    return availability.filter(([, available]) => available).map(([type]) => type)
}

// R-3.1, R-3.2, R-2.2 step 2: a Buy or a Sell of any railroad within the turn's two trades.
export function tradeAvailability(
    state: HydratedPromontoryPointGameState,
    playerId: string
): ActionAvailability {
    return [
        [
            ActionType.BuyShare,
            RAILROAD_IDS.some(
                (railroadId) => buyShareRefusal(state, playerId, railroadId) === undefined
            )
        ],
        [
            ActionType.SellShare,
            RAILROAD_IDS.some(
                (railroadId) => sellShareRefusal(state, playerId, railroadId) === undefined
            )
        ]
    ]
}

// R-3.3, R-3.3-H1, R-6.3-H2: place a turn piece on an open space, or scrap one with none.
export function placingAvailability(
    state: HydratedPromontoryPointGameState,
    playerId: string
): ActionAvailability {
    const pieces = state.turn?.pieces ?? []
    return [
        [
            ActionType.PlaceTrack,
            pieces.some((railroadId) =>
                openSpaceIds(state.track, railroadId).some((spaceId) =>
                    HydratedPlaceTrack.canPlaceTrack(state, playerId, railroadId, spaceId)
                )
            )
        ],
        [
            ActionType.ScrapTrack,
            pieces.some((railroadId) =>
                HydratedScrapTrack.canScrapTrack(state, playerId, railroadId)
            )
        ]
    ]
}

// R-2.2 step 4, R-6.3: ending the turn, with whichever keep-or-return choice the turn allows.
export function endTurnAvailability(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    context: MachineContext<HydratedPromontoryPointGameState>
): ActionAvailability {
    const { fourPieceVariant } = normalizePromontoryPointConfig(context.gameConfig)
    return [
        [
            ActionType.EndTurn,
            [undefined, false, true].some((returnKeptPiece) =>
                HydratedEndTurn.canEndTurn(state, playerId, returnKeptPiece, fourPieceVariant)
            )
        ]
    ]
}

export function isTrade(action: HydratedAction): boolean {
    return isBuyShare(action) || isSellShare(action)
}

export function isPlacingStep(action: HydratedAction): boolean {
    return isPlaceTrack(action) || isScrapTrack(action)
}

// R-2.2-H1, R-2.2-H2, R-4.3-H4: after a placement or a scrap, a Repairs waits on its debtors,
// placing goes on, or placing has ended and trading opens again.
export function stateAfterPlacingAction(
    state: HydratedPromontoryPointGameState
): MachineState.Placing | MachineState.PayingRepairs | MachineState.TradingAfterPlacing {
    if (state.pendingRepairs !== undefined) {
        return MachineState.PayingRepairs
    }
    return stateAfterPlacingStep(state.requireTurn())
}

// R-2.2: the turn player alone acts in the turn's own states.
export function activateTurnPlayer(state: HydratedPromontoryPointGameState): string {
    const playerId = turnPlayerId(state)
    state.activePlayerIds = [playerId]
    return playerId
}
