import type { EighteenXXState } from '@tabletop/18xx'
import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
import { titleRunNames } from '../routes/routePresentation.js'
import { auctionLotName } from './auctionHistory.js'
import type { HistoryDescriptionOptions } from './historyDescription.js'

/** The session's names for a history entry described against the given state. */
export function sessionHistoryOptions(
    session: EighteenXXSessionView,
    state: EighteenXXState,
    {
        companyName,
        place
    }: { companyName: (id: string) => string; place: (locationId: string) => string }
): HistoryDescriptionOptions {
    return {
        companyName,
        playerName: (id) => session.getPlayerName(id),
        money: session.presentation.money,
        lotName: (id) => auctionLotName(id, state, session.auctionLotsFor(state), companyName),
        routeBonusName: (id) => session.names.routeBonus(id),
        place,
        poolName: (id) => session.poolName(id),
        certificates: {
            charters: session.charters,
            multiShare: session.presentation.multiShareCertificate
        },
        runNames: titleRunNames(session.presentation),
        wording: session.historyWording
    }
}
