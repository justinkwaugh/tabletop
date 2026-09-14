import {
    isLayTile,
    isRequestTrackConsent,
    isRespondToTrackConsent,
    isPlaceStation,
    isRunTrains,
    isDistributeEarnings,
    isBuyTrain,
    isBuyShares,
    isSellShares,
    isStartCompany,
    isFinishTrack,
    isFinishStations,
    isFinishOperatingTurn,
    isFinishStockTurn,
    isAdvancePhase,
    isCompleteStockRound,
    isExchangePrivate,
    isReserveBid,
    isRaiseAuctionBid,
    isContributeTrainFunds,
    isFundTrain,
    isSellFundingShares,
    isIssueTreasuryShares,
    isFloatCompany,
    isEndGame,
    isStartOperatingSet,
    isStartOperatingRound,
    isOfferPurchase,
    isRespondToPurchaseOffer,
    isBuyPrivateTrain,
    isBuyAuctionLot,
    isPassAuction,
    isResolveAuction,
    type Owner,
    type PresidencyChange,
    type FinanceExampleState
} from '@tabletop/18xx'
import type { HistoryCompanyChanges } from './historyCompanyChanges.js'
import { assert, assertExists, type GameAction } from '@tabletop/common'

export type HistoryDescription = {
    text: string
    trainDefinitionIds?: string[]
    beforeText?: string
    ledgerText?: string
    value?: string
    detail?: string
    routine?: boolean
    important?: boolean
}
const historyMoney = (value: number) => `$${value.toLocaleString('en-US')}`

export function historyDescription(
    action: GameAction,
    state: FinanceExampleState,
    companyName: (id: string) => string = (id) => id,
    playerName: (id: string) => string = (id) => id,
    companyChanges?: HistoryCompanyChanges
): HistoryDescription {
    const money = historyMoney
    const ownerName = (owner: Owner) =>
        owner.kind === 'bank'
            ? state.bank.name
            : owner.kind === 'player'
              ? playerName(owner.playerId)
              : companyName(owner.companyId)
    const presidency = (change: PresidencyChange) =>
        `President: ${ownerName(change.previous)} → ${ownerName(change.next)}`
    const presidentChanges = (companyChanges?.presidents ?? []).map(
        (change) =>
            `${companyName(change.companyId)} President: ${change.previous ? ownerName(change.previous) : 'None'} → ${change.next ? ownerName(change.next) : 'None'}`
    )
    function receivedShare(certificateId: string) {
        const certificate = state.certificates.find((item) => item.id === certificateId)
        assert(certificate?.kind === 'share', 'Recorded exchange requires its received share')
        return `${certificate.shares} ${companyName(certificate.companyId)}`
    }
    function marketPrice(id: string) {
        const space = state.stockMarket.spaces.find((item) => item.id === id)
        assertExists(space, 'Recorded market movement requires its space')
        return space.price
    }
    function shares(certificateId: string) {
        const certificate = state.certificates.find((item) => item.id === certificateId)
        assert(certificate?.kind === 'share', 'Recorded share action requires its certificate')
        return certificate.shares
    }
    if (isRequestTrackConsent(action))
        return { text: `Requested permission to lay track at ${action.locationId}` }
    if (isRespondToTrackConsent(action)) {
        assertExists(action.metadata, 'Recorded track permission response requires its request')
        const { locationId, cost } = action.metadata.request.details
        return action.metadata.accepted
            ? {
                  text: `Allowed track at ${locationId}; track laid`,
                  value: cost ? money(cost) : undefined
              }
            : { text: `Declined permission to lay track at ${locationId}` }
    }
    if (isLayTile(action))
        return {
            text: `Laid track at ${action.locationId}`,
            value: action.expectedCost ? money(action.expectedCost) : undefined
        }
    if (isPlaceStation(action))
        return {
            text: `Station at ${action.position.locationId}`,
            value: action.expectedCost ? money(action.expectedCost) : 'Free'
        }
    if (isRunTrains(action)) {
        assertExists(action.metadata, 'Recorded train run requires its revenue')
        return {
            text: action.routes.length ? 'Ran' : 'Did not run trains',
            trainDefinitionIds: action.routes.map((route) => {
                const train = state.trainInventory.trains.find(
                    (train) => train.id === route.trainId
                )
                assertExists(train, 'Recorded train run requires its train')
                return train.definitionId
            }),
            value: action.metadata.revenue ? money(action.metadata.revenue) : undefined
        }
    }
    if (isDistributeEarnings(action)) {
        assertExists(action.metadata, 'Recorded dividend requires its settlement')
        const details = action.metadata
        return {
            text:
                !details.revenue && !details.dividendPerShare && !details.bonusPerShare
                    ? 'Did not pay out'
                    : action.choice === 'withhold'
                      ? 'Withheld'
                      : action.choice === 'half-pay'
                        ? 'Half paid'
                        : 'Paid out',
            value:
                action.choice === 'withhold'
                    ? details.retained
                        ? money(details.retained)
                        : undefined
                    : `${money(details.dividendPerShare)}/share`,
            detail:
                [
                    details.retained && action.choice !== 'withhold'
                        ? `${money(details.retained)} retained`
                        : '',
                    details.bonusPerShare ? `${money(details.bonusPerShare)}/share bonus` : '',
                    details.marketMove &&
                    details.marketMove.fromMarketSpaceId !== details.marketMove.toMarketSpaceId
                        ? `Market ${marketPrice(details.marketMove.fromMarketSpaceId)} → ${marketPrice(details.marketMove.toMarketSpaceId)}`
                        : ''
                ]
                    .filter(Boolean)
                    .join(' · ') || undefined,
            important: true
        }
    }
    if (isBuyTrain(action) || isBuyPrivateTrain(action))
        return {
            text: `Bought ${action.definitionId} train`,
            value: money(action.expectedPrice),
            important: true
        }
    if (isBuyShares(action)) {
        assertExists(action.metadata, 'Recorded share purchase requires its company')
        return {
            text: `Bought ${shares(action.certificateId)} ${companyName(action.metadata.companyId)} for ${money(action.expectedPrice)}`,
            detail:
                [
                    action.buyer.kind === 'company'
                        ? `For ${companyName(action.buyer.companyId)}`
                        : '',
                    action.metadata.presidency ? presidency(action.metadata.presidency) : ''
                ]
                    .filter(Boolean)
                    .join(' · ') || undefined
        }
    }
    if (isSellShares(action) || isSellFundingShares(action) || isIssueTreasuryShares(action)) {
        assertExists(action.metadata, 'Recorded share sale requires its settlement')
        const multipleCompanies =
            new Set(action.metadata.sales.map((sale) => sale.companyId)).size > 1
        return {
            beforeText:
                isSellFundingShares(action) && action.metadata.requiredContribution
                    ? `President owes ${money(action.metadata.requiredContribution)}${action.metadata.cashShortfall ? ` and is short ${money(action.metadata.cashShortfall)}` : ''}`
                    : undefined,
            ledgerText: isIssueTreasuryShares(action)
                ? `Issued ${action.metadata.sales.map((sale) => `${sale.shares} ${companyName(sale.companyId)}`).join(', ')}`
                : undefined,
            text: `${isIssueTreasuryShares(action) ? 'Issued' : 'Sold'} ${action.metadata.sales.map((sale) => `${sale.shares} ${companyName(sale.companyId)}`).join(', ')} for ${money(action.metadata.proceeds)}`,
            detail:
                action.metadata.sales
                    .flatMap((sale) => [
                        ...(sale.fromMarketSpaceId !== sale.toMarketSpaceId
                            ? [
                                  `${multipleCompanies ? `${companyName(sale.companyId)} market` : 'Market'} ${marketPrice(sale.fromMarketSpaceId)} → ${marketPrice(sale.toMarketSpaceId)}`
                              ]
                            : []),
                        ...(sale.presidency ? [presidency(sale.presidency)] : [])
                    ])
                    .join(' · ') || undefined
        }
    }
    if (isStartCompany(action))
        return {
            text: `Started ${companyName(action.companyId)} for ${money(action.expectedPrice)}`,
            detail: action.metadata
                ? `${shares(action.metadata.certificateId)} shares · Par ${action.metadata.parPrice}${action.metadata.presidency ? ` · ${presidency(action.metadata.presidency)}` : ''}`
                : undefined,
            important: true
        }
    if (isExchangePrivate(action))
        return {
            text: `Exchanged ${companyName(action.privateCompanyId)}`,
            detail: action.metadata
                ? `For ${shares(action.certificateId)} ${companyName(action.metadata.companyId)}${action.metadata.presidency ? ` · ${presidency(action.metadata.presidency)}` : ''}`
                : action.certificateId,
            important: true
        }
    if (isReserveBid(action) || isRaiseAuctionBid(action))
        return {
            text: `${isReserveBid(action) ? 'Reserved bid on' : 'Bid on'} ${companyName(action.lotId)}`,
            value: money(action.amount)
        }
    if (isContributeTrainFunds(action))
        return {
            text: `President contributed ${money(action.amount)}`,
            ledgerText: 'President contributed',
            important: true
        }
    if (isFundTrain(action))
        return {
            text: 'Must buy a train',
            important: true
        }
    if (isAdvancePhase(action)) {
        assertExists(action.metadata, 'Recorded phase change requires its event')
        const event = action.metadata.event
        const effects = [
            ...event.rustedTrainIds.map(
                (id) =>
                    `${state.trainInventory.trains.find((train) => train.id === id)?.definitionId ?? id} rusted`
            ),
            ...event.privateEffects.map((effect) => {
                const name = companyName(effect.privateCompanyId)
                if (effect.kind === 'close') return `${name} closed`
                if (effect.kind === 'income') return `${name} income ${money(effect.revenue)}`
                return `${name} exchanged for ${receivedShare(effect.certificateId)}`
            }),
            ...presidentChanges
        ]
        return {
            text: `Phase ${event.toPhaseId}`,
            detail: [...new Set(effects)].join(' · '),
            important: true
        }
    }
    if (isBuyAuctionLot(action))
        return {
            text: `Bought ${companyName(action.lotId)}`,
            value: money(action.expectedPrice),
            important: true
        }
    if (isPassAuction(action)) return { text: 'Passed' }
    if (isResolveAuction(action)) {
        const awards = (action.undoPatch ?? []).flatMap((patch) => {
            const match = /^\/openingAuction\/awards\/(\d+)$/.exec(patch.path)
            const award =
                match && patch.op === 'remove'
                    ? state.openingAuction?.awards[Number(match[1])]
                    : undefined
            return award ? [award] : []
        })
        return {
            text: awards.length ? 'Auction awarded' : 'Auction continued',
            detail: awards
                .map(
                    (award) =>
                        `${playerName(award.playerId)} won ${companyName(award.lotId)} for ${money(award.price)}`
                )
                .join(' · '),
            important: !!awards.length,
            routine: !awards.length
        }
    }
    if (isFloatCompany(action)) {
        assertExists(action.metadata, 'Recorded flotation requires its capital payments')
        const capital = action.metadata.payments
            .filter(
                (payment) =>
                    payment.to.kind === 'company' && payment.to.companyId === action.companyId
            )
            .reduce((sum, payment) => sum + payment.amount, 0)
        return {
            text: `${companyName(action.companyId)} floated`,
            detail:
                [
                    ...(capital ? [`${money(capital)} capital`] : []),
                    ...(action.metadata.exchanges ?? []).map((exchange) => {
                        const certificate = state.certificates.find(
                            (item) => item.id === exchange.surrenderedId
                        )
                        assertExists(
                            certificate,
                            'Recorded flotation requires its surrendered certificate'
                        )
                        const number =
                            certificate.kind === 'share' && certificate.number
                                ? ` #${certificate.number}`
                                : ''
                        return `${ownerName(exchange.owner)} exchanged ${companyName(certificate.companyId)}${number} for ${receivedShare(exchange.receivedId)}`
                    }),
                    ...presidentChanges,
                    ...(companyChanges?.closedCompanyIds ?? []).map(
                        (id) => `${companyName(id)} closed`
                    )
                ].join(' · ') || undefined,
            important: true
        }
    }
    if (isCompleteStockRound(action)) {
        assertExists(action.metadata, 'Recorded stock-round completion requires its movements')
        const moves = action.metadata.marketMoves.filter(
            (move) => move.fromMarketSpaceId !== move.toMarketSpaceId
        )
        return {
            text: 'Sold out',
            detail: moves
                .map(
                    (move) =>
                        `${companyName(move.companyId)} market ${marketPrice(move.fromMarketSpaceId)} → ${marketPrice(move.toMarketSpaceId)}`
                )
                .join(' · '),
            routine: !moves.length,
            important: !!moves.length
        }
    }
    if (isStartOperatingSet(action)) return { text: 'Started operating set', routine: true }
    if (isStartOperatingRound(action)) return { text: 'Operating order', important: true }
    if (isEndGame(action)) return { text: 'Game ended', important: true }
    if (isOfferPurchase(action) || isRespondToPurchaseOffer(action)) {
        assertExists(action.metadata, 'Recorded purchase offer requires its terms')
        const { offer, accepted } = action.metadata
        const purchaseAsset = offer.asset
        const asset =
            purchaseAsset.kind === 'private'
                ? companyName(purchaseAsset.privateCompanyId)
                : `${state.trainInventory.trains.find((train) => train.id === purchaseAsset.trainId)?.definitionId ?? purchaseAsset.trainId} train`
        return {
            text: `${accepted ? 'Bought' : isRespondToPurchaseOffer(action) ? 'Declined' : 'Offered to buy'} ${asset}`,
            value: money(offer.price),
            detail: `From ${offer.seller.kind === 'bank' ? state.bank.name : ownerName(offer.seller)}`,
            important: accepted
        }
    }
    if (isFinishTrack(action)) return { text: 'Finished track', routine: true }
    if (isFinishStations(action)) return { text: 'Finished stations', routine: true }
    if (isFinishOperatingTurn(action)) return { text: 'Finished operating', routine: true }
    if (isFinishStockTurn(action))
        return {
            text: action.metadata?.passed ? 'Passed' : 'Finished turn',
            routine: !action.metadata?.passed
        }
    return {
        text: action.type.replace(/([a-z])([A-Z])/g, '$1 $2'),
        detail: ['companyId', 'privateCompanyId', 'locationId', 'lotId']
            .flatMap((key) => {
                const value = Reflect.get(action, key)
                return typeof value === 'string' ? [value] : []
            })
            .join(' · ')
    }
}
