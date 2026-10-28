import { assert, type GameAction } from '@tabletop/common'
import { isBidOnAuctionLot, isOfferAuctionLot, isPassAuction, placeReference } from '@tabletop/18xx'
import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
import {
    historyDescription,
    type HistoryDescription,
    type TitleActionDescription
} from './historyDescription.js'
import { auctionLotName } from './auctionHistory.js'

export function describeLastAction(
    session: EighteenXXSessionView,
    action: GameAction,
    describeAction?: TitleActionDescription
): HistoryDescription {
    const gameState = session.gameState
    const money = session.presentation.money
    const companyName = (id: string) => session.companyName(id)
    if (isOfferAuctionLot(action) || isBidOnAuctionLot(action)) {
        const lot = session.auctionLotsFor(gameState).find((lot) => lot.id === action.lotId)
        assert(lot, 'Recorded auction requires its lot')
        return isOfferAuctionLot(action)
            ? { text: `Offered ${session.lotName(lot)} for auction at ${money(lot.price)}` }
            : { text: `Bid ${money(action.amount)} for ${session.lotName(lot)}` }
    }
    if (isPassAuction(action)) return { text: 'Passed' }
    const shared = () =>
        historyDescription(
            action,
            gameState,
            session.stockMarketChart,
            companyName,
            (id) => session.getPlayerName(id),
            undefined,
            money,
            (id) => auctionLotName(id, gameState, session.auctionLotsFor(gameState), companyName),
            (id) => session.names.routeBonus(id),
            placeReference
        )
    return describeAction?.(action, { companyName, place: placeReference }, shared) ?? shared()
}
