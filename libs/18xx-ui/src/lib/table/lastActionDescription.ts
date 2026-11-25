import { assert, type GameAction } from '@tabletop/common'
import { isBidOnAuctionLot, isOfferAuctionLot, isPassAuction, placeReference } from '@tabletop/18xx'
import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
import {
    historyDescription,
    type HistoryDescription,
    type TitleActionDescription
} from './historyDescription.js'
import { sessionHistoryOptions } from './sessionHistoryOptions.js'

export function describeLastAction(
    session: EighteenXXSessionView,
    action: GameAction,
    describeAction?: TitleActionDescription,
    companyName: (id: string) => string = (id) => session.companyName(id)
): HistoryDescription {
    const gameState = session.gameState
    const money = session.presentation.money
    if (isOfferAuctionLot(action) || isBidOnAuctionLot(action)) {
        const lot = session.auctionLotsFor(gameState).find((lot) => lot.id === action.lotId)
        assert(lot, 'Recorded auction requires its lot')
        return isOfferAuctionLot(action)
            ? { text: `Offered ${session.lotName(lot)} for auction at ${money(lot.price)}` }
            : { text: `Bid ${money(action.amount)} for ${session.lotName(lot)}` }
    }
    if (isPassAuction(action)) return { text: 'Passed' }
    const titleNames = { companyName, place: placeReference }
    const shared = () =>
        historyDescription(
            action,
            gameState,
            session.stockMarketChart,
            sessionHistoryOptions(session, gameState, titleNames)
        )
    return describeAction?.(action, titleNames, shared) ?? shared()
}
