import { assert, assertExists } from '@tabletop/common'
import {
    awardPrivate,
    beginSelectionAuction,
    closePrivate,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from '@tabletop/18xx'
import { EighteenSeventeenPrivateCatalog } from './privates.js'
import { createEighteenSeventeenStockMarket } from './stockMarket.js'
import { createEighteenSeventeenPosition } from './position.js'

export const EighteenSeventeenStartingCash: Readonly<Record<number, number>> = {
    3: 420,
    4: 315,
    5: 252,
    6: 210,
    7: 180,
    8: 158,
    9: 140,
    10: 126,
    11: 115,
    12: 105
}
export const EighteenSeventeenSeedMoney = 200

// The bank subsidises privates sold below face value from its seed money; once that is spent,
// bidding opens at face value.
function seedMoney(state: SelectionAuctionState): number {
    assert(
        'seedMoney' in state && typeof state.seedMoney === 'number',
        'The opening auction has seed money'
    )
    return state.seedMoney
}

export const EighteenSeventeenAuctionRules: SelectionAuctionRules = {
    lots: (state) => EighteenSeventeenPrivateCatalog.lots(state),
    nominationLotIds(state) {
        assertExists(state.selectionAuction, 'Nominations belong to the selection auction')
        return state.selectionAuction.remainingLotIds
    },
    passingWhileNominating: true,
    openingBid: (state, lotId) =>
        Math.max(0, EighteenSeventeenPrivateCatalog.faceValue(lotId) - seedMoney(state)),
    increment: 5,
    award(state, award) {
        awardPrivate(state, award)
        const subsidy = Math.max(
            0,
            EighteenSeventeenPrivateCatalog.faceValue(award.lotId) - award.price
        )
        Object.assign(state, { seedMoney: seedMoney(state) - subsidy })
    },
    closeUnsold(state, lotIds) {
        for (const id of lotIds) closePrivate(state, id)
    }
}

export function createEighteenSeventeenOpening({
    players,
    startingPositions
}: OpeningSetup): Opening {
    assert(
        players.length >= 3 && players.length <= 12,
        '1817 supports three through twelve players'
    )
    const capital = EighteenSeventeenStartingCash[players.length]
    const position: InitialPosition = {
        ...createEighteenSeventeenPosition(
            players.map((player) => ({ playerId: player.playerId, amount: capital }))
        ),
        stockMarket: createEighteenSeventeenStockMarket()
    }
    return {
        position,
        titleState: { seedMoney: EighteenSeventeenSeedMoney },
        begin: beginSelectionAuction(EighteenSeventeenAuctionRules, startingPositions)
    }
}
