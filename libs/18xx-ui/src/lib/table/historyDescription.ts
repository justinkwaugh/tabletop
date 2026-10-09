import type { AuctionAwardDetails } from '@tabletop/18xx'
import { moneyFormat, type MoneyFormat } from '../presentation/money.js'
import {
    isLayTile,
    isPrivateTileLay,
    isPlacePrivateMarker,
    type TrackLayEffects,
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
    isPrivateExchangeAction,
    isOfferPrivatePurchase,
    isParCompany,
    isPlacePrivateStation,
    isChooseHomeStation,
    isDeclinePrivateStation,
    isCompanyPurchaseOffer,
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
    isStartOperatingTurn,
    isOfferPurchase,
    isRespondToPurchaseOffer,
    isBuyPrivateTrain,
    isBuyAuctionLot,
    isPassAuction,
    isResolveAuction,
    isNominateLot,
    isBidForLot,
    isPassSelectionAuction,
    isResolveSelectionAuction,
    isAuctionCompany,
    isBidForCompany,
    isPassCompanyAuction,
    isFormCompany,
    isExportTrains,
    isFinishTrains,
    isPayInterest,
    isRepayLoan,
    isTakeLoan,
    isSellSharesToPay,
    isGoBankrupt,
    isDiscardTrain,
    isRustTrains,
    type DeparturePayment,
    type Owner,
    type PresidencyChange,
    type EighteenXXState,
    type StockMarketChart
} from '@tabletop/18xx'
import type { HistoryCompanyChanges } from './historyCompanyChanges.js'
import { assertExists, type GameAction } from '@tabletop/common'

export type HistoryDescription = {
    text: string
    omitActor?: boolean
    trainDefinitionIds?: string[]
    beforeText?: string
    ledgerText?: string
    value?: string
    detail?: string
    routine?: boolean
    important?: boolean
}

/** What the bank paid as trains departed, as an action records it. */
function departurePayments(action: GameAction): readonly DeparturePayment[] {
    if (isAdvancePhase(action)) return action.metadata?.event.departurePayments ?? []
    if (
        isBuyTrain(action) ||
        isBuyPrivateTrain(action) ||
        isExportTrains(action) ||
        isRustTrains(action) ||
        isDiscardTrain(action) ||
        isOfferPurchase(action) ||
        isRespondToPurchaseOffer(action)
    )
        return action.metadata?.departurePayments ?? []
    return []
}

/** The names a history row gives the owners of cash and certificates. */
export type HistoryNames = {
    companyName: (id: string) => string
    playerName: (id: string) => string
    bankName: string
}

export function ownerName(owner: Owner, names: HistoryNames): string {
    return owner.kind === 'bank'
        ? names.bankName
        : owner.kind === 'player'
          ? names.playerName(owner.playerId)
          : names.companyName(owner.companyId)
}

/** Joins a row's details, leaving out those it lacks. */
export function joinDetails(...details: (string | undefined)[]): string | undefined {
    return details.filter(Boolean).join(' · ') || undefined
}

/** A title's own history row for an action, given the shared row it may add to. */
export type TitleActionDescription = (
    action: GameAction,
    companyName: (id: string) => string,
    shared: () => HistoryDescription
) => HistoryDescription | undefined

/** Names who the bank paid as trains departed, and the private it paid for. */
export function departurePaymentsDetail(
    payments: readonly DeparturePayment[],
    names: HistoryNames,
    money: MoneyFormat
): string | undefined {
    return joinDetails(
        ...payments.map((payment) =>
            payment.privateId
                ? `${names.companyName(payment.privateId)} paid ${ownerName(payment.to, names)} ${money(payment.amount)}`
                : `${ownerName(payment.to, names)} received ${money(payment.amount)}`
        )
    )
}

// A run's bonuses, totalled by what earned them; unnamed bonuses keep their hex.
function runBonusesDetail(
    routes: readonly {
        bonuses?: readonly { locationId: string; amount: number; label?: string }[]
    }[],
    money: MoneyFormat
): string | undefined {
    const totals = new Map<string, { amount: number; label?: string; locationId: string }>()
    for (const bonus of routes.flatMap((route) => route.bonuses ?? [])) {
        const key = bonus.label ?? `@${bonus.locationId}`
        const total = totals.get(key)
        totals.set(key, { ...bonus, amount: (total?.amount ?? 0) + bonus.amount })
    }
    return totals.size
        ? [...totals.values()]
              .map(({ label, amount, locationId }) =>
                  label ? `${label} +${money(amount)}` : `+${money(amount)} at ${locationId}`
              )
              .join(' · ')
        : undefined
}

export function historyDescription(
    action: GameAction,
    state: EighteenXXState,
    chart: StockMarketChart,
    companyName: (id: string) => string = (id) => id,
    playerName: (id: string) => string = (id) => id,
    companyChanges?: HistoryCompanyChanges,
    money: MoneyFormat = moneyFormat('$')
): HistoryDescription {
    const description = describeShared(
        action,
        state,
        chart,
        companyName,
        playerName,
        companyChanges,
        money
    )
    const paid = departurePaymentsDetail(
        departurePayments(action),
        { companyName, playerName, bankName: state.bank.name },
        money
    )
    return paid ? { ...description, detail: joinDetails(description.detail, paid) } : description
}

function describeShared(
    action: GameAction,
    state: EighteenXXState,
    chart: StockMarketChart,
    companyName: (id: string) => string,
    playerName: (id: string) => string,
    companyChanges: HistoryCompanyChanges | undefined,
    money: MoneyFormat
): HistoryDescription {
    const layEffects = (effects: TrackLayEffects | undefined) =>
        effects
            ? [
                  ...effects.payments.map((payment) => `Received ${money(payment.amount)}`),
                  ...effects.closedPrivateIds.map((privateId) => `${companyName(privateId)} closed`)
              ].join(' · ')
            : undefined
    const names = { companyName, playerName, bankName: state.bank.name }
    const nameOf = (owner: Owner) => ownerName(owner, names)
    const presidency = (change: PresidencyChange) =>
        `President: ${nameOf(change.previous)} → ${nameOf(change.next)}`
    const presidentChanges = (companyChanges?.presidents ?? []).map(
        (change) =>
            `${companyName(change.companyId)} President: ${change.previous ? nameOf(change.previous) : 'None'} → ${change.next ? nameOf(change.next) : 'None'}`
    )
    const closures = (companyChanges?.closedCompanyIds ?? []).map(
        (id) => `${companyName(id)} closed`
    )
    function awardExtras(award: AuctionAwardDetails | undefined): string {
        const extras = (award?.shares ?? []).map((share) =>
            share.president
                ? `the ${companyName(share.companyId)} president’s certificate`
                : `${share.shares} ${companyName(share.companyId)}`
        )
        return extras.length ? `, with ${extras.join(' and ')}` : ''
    }
    function marketPrice(id: string) {
        return chart.space(id).price
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
            value: action.expectedCost ? money(action.expectedCost) : undefined,
            detail: layEffects(action.metadata?.effects)
        }
    if (isPrivateTileLay(action))
        return {
            text: `Laid track at ${action.locationId} with ${companyName(action.privateCompanyId)}`,
            value: action.expectedCost ? money(action.expectedCost) : undefined,
            detail: layEffects(action.metadata?.effects)
        }
    if (isPlacePrivateMarker(action))
        return { text: `Marked ${action.locationId} with ${companyName(action.privateCompanyId)}` }
    if (isChooseHomeStation(action)) return { text: `Home station at ${action.locationId}` }
    if (isPlacePrivateStation(action))
        return {
            text: `Station at ${action.position.locationId} with ${companyName(action.privateCompanyId)}`,
            value: 'Free'
        }
    if (isDeclinePrivateStation(action))
        return { text: `Declined the ${companyName(action.privateCompanyId)} station` }
    if (isPlaceStation(action))
        return {
            text: `Station at ${action.position.locationId}`,
            value: action.expectedCost ? money(action.expectedCost) : 'Free'
        }
    if (isRunTrains(action)) {
        assertExists(action.metadata, 'Recorded train run requires its revenue')
        return {
            text: action.routes.length ? 'Ran' : 'Did not run trains',
            trainDefinitionIds: action.metadata.routes.map((route) => route.definitionId),
            value: action.metadata.revenue ? money(action.metadata.revenue) : undefined,
            detail: runBonusesDetail(action.metadata.routes, money)
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
                    ...(details.charges ?? []).map(
                        (charge) => `${nameOf(charge.from)} owes ${money(charge.amount)} on shorts`
                    ),
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
            text: `Bought`,
            trainDefinitionIds: [action.definitionId],
            value: money(action.expectedPrice),
            detail: closures.join(' · ') || undefined,
            important: true
        }
    if (isTakeLoan(action) || isRepayLoan(action)) {
        assertExists(action.metadata, 'Recorded loan requires its payment')
        const move = action.metadata.marketMove
        return {
            text: `${isTakeLoan(action) ? 'Borrowed for' : 'Repaid a loan for'} ${companyName(action.companyId)}`,
            value: money(action.metadata.payment.amount),
            detail: move
                ? `Market ${marketPrice(move.fromMarketSpaceId)} → ${marketPrice(move.toMarketSpaceId)}`
                : undefined
        }
    }
    if (isPayInterest(action)) {
        assertExists(action.metadata, 'Recorded interest requires its payments')
        const { interest, loansTaken, default: unpaid } = action.metadata
        return {
            text: unpaid
                ? `${companyName(action.companyId)} could not pay interest and was liquidated`
                : `${companyName(action.companyId)} paid interest`,
            omitActor: true,
            value: money(interest),
            detail:
                [
                    loansTaken
                        ? `Borrowed ${loansTaken} ${loansTaken === 1 ? 'loan' : 'loans'} to pay`
                        : '',
                    unpaid
                        ? unpaid.unpaid
                            ? `President paid ${money(interest - unpaid.unpaid)}, ${money(unpaid.unpaid)} unpaid`
                            : 'The president paid it'
                        : ''
                ]
                    .filter(Boolean)
                    .join(' · ') || undefined,
            important: !!unpaid,
            routine: !unpaid && !loansTaken
        }
    }
    if (isFinishTrains(action)) return { text: 'Finished trains', routine: true }
    if (isSellSharesToPay(action)) {
        assertExists(action.metadata, 'Recorded sale requires its settlement')
        return {
            text: `Sold ${action.sale.shares} ${companyName(action.sale.companyId)} to pay the bank`,
            value: money(action.metadata.details.proceeds),
            detail: `Paid ${money(action.metadata.paid)}`
        }
    }
    if (isGoBankrupt(action)) {
        assertExists(action.metadata, 'Recorded bankruptcy requires its consequences')
        return {
            text: 'Went bankrupt',
            detail:
                [
                    ...action.metadata.record.liquidatedCompanyIds.map(
                        (id) => `${companyName(id)} liquidated`
                    ),
                    `${money(action.metadata.forgiven)} forgiven`
                ].join(' · ') || undefined,
            important: true
        }
    }
    if (isExportTrains(action)) {
        assertExists(action.metadata, 'Recorded export requires its trains')
        const definitionIds = action.metadata.trains.map((train) => train.definitionId)
        return {
            text: 'Exported',
            trainDefinitionIds: [...new Set(definitionIds)],
            detail: definitionIds.length > 1 ? `${definitionIds.length} trains` : undefined,
            important: true
        }
    }
    if (isBuyShares(action)) {
        assertExists(action.metadata, 'Recorded share purchase requires its company')
        return {
            text: `Bought ${action.metadata.shares} ${companyName(action.metadata.companyId)} for ${money(action.expectedPrice)}`,
            detail:
                [
                    action.buyer.kind === 'company'
                        ? `For ${companyName(action.buyer.companyId)}`
                        : '',
                    action.metadata.presidency ? presidency(action.metadata.presidency) : '',
                    action.metadata.coveredShortId ? 'Closed a short' : ''
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
                ? `${action.metadata.shares} shares · Par ${action.metadata.parPrice}${action.metadata.presidency ? ` · ${presidency(action.metadata.presidency)}` : ''}`
                : undefined,
            important: true
        }
    if (isParCompany(action))
        return {
            text: `Set ${companyName(action.companyId)}’s par at ${money(marketPrice(action.marketSpaceId))}`,
            important: true
        }
    if (isPrivateExchangeAction(action))
        return {
            text: `Exchanged ${companyName(action.privateCompanyId)}`,
            detail: action.metadata
                ? `For ${action.metadata.shares} ${companyName(action.metadata.companyId)}${action.metadata.presidency ? ` · ${presidency(action.metadata.presidency)}` : ''}`
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
            text: `Contributed ${money(action.amount)} toward the train`,
            ledgerText: 'Contributed toward the train',
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
            ...event.rustedTrains.map((train) => `${train.definitionId} rusted`),
            ...event.privateEffects.map((effect) => {
                const name = companyName(effect.privateCompanyId)
                if (effect.kind === 'close') return `${name} closed`
                if (effect.kind === 'income') return `${name} income ${money(effect.revenue)}`
                return `${name} exchanged for ${effect.shares} ${companyName(effect.companyId)}`
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
            text: `Bought ${companyName(action.lotId)}${awardExtras(action.metadata)}`,
            value: money(action.expectedPrice),
            important: true
        }
    if (isPassAuction(action)) return { text: 'Passed' }
    if (isResolveAuction(action)) {
        if (!action.metadata) return { text: 'Auction resolved', routine: true }
        const awards = action.metadata.kind === 'award' ? [action.metadata.award] : []
        return {
            text: awards.length ? 'Auction awarded' : 'Auction continued',
            detail: awards
                .map(
                    (award) =>
                        `${playerName(award.playerId)} won ${companyName(award.lotId)} for ${money(award.price)}${awardExtras(award)}`
                )
                .join(' · '),
            important: !!awards.length,
            routine: !awards.length
        }
    }
    if (isNominateLot(action))
        return { text: `Auctioned ${companyName(action.lotId)}`, value: money(action.amount) }
    if (isBidForLot(action))
        return { text: `Bid on ${companyName(action.lotId)}`, value: money(action.amount) }
    if (isPassSelectionAuction(action) || isPassCompanyAuction(action)) return { text: 'Passed' }
    if (isResolveSelectionAuction(action)) {
        assertExists(action.metadata, 'Recorded selection auction resolution requires its outcome')
        const { resolution } = action.metadata
        if (resolution.kind === 'award')
            return {
                text: 'Auction awarded',
                detail: [
                    `${playerName(resolution.award.playerId)} won ${companyName(resolution.award.lotId)} for ${money(resolution.award.price)}`,
                    ...(resolution.removedLotIds ?? []).map((id) => `${companyName(id)} removed`)
                ].join(' · '),
                important: true
            }
        if (resolution.kind === 'close-unsold')
            return {
                text: 'Unsold privates closed',
                detail: resolution.lotIds.map((id) => `${companyName(id)} closed`).join(' · '),
                important: true
            }
        return { text: 'Auction ended', routine: true }
    }
    if (isAuctionCompany(action))
        return {
            text: `Auctioned ${companyName(action.companyId)} at ${action.home.locationId}`,
            value: money(action.amount),
            important: true
        }
    if (isBidForCompany(action))
        return { text: `Bid on ${companyName(action.companyId)}`, value: money(action.amount) }
    if (isFormCompany(action))
        return {
            text: `Formed ${companyName(action.companyId)} with ${action.shareCount} shares`,
            value: action.metadata ? money(action.metadata.price) : undefined,
            detail:
                [
                    action.metadata ? `Starts at ${money(action.metadata.parPrice)}` : '',
                    ...action.privateIds.map((id) => `${companyName(id)} contributed`)
                ]
                    .filter(Boolean)
                    .join(' · ') || undefined,
            important: true
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
                        const number = exchange.surrenderedNumber
                            ? ` #${exchange.surrenderedNumber}`
                            : ''
                        return `${nameOf(exchange.owner)} exchanged ${companyName(exchange.surrenderedCompanyId)}${number} for ${exchange.receivedShares} ${companyName(exchange.receivedCompanyId)}`
                    }),
                    ...presidentChanges,
                    ...closures
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
            text: moves.every(
                (move) => marketPrice(move.toMarketSpaceId) >= marketPrice(move.fromMarketSpaceId)
            )
                ? 'Sold out'
                : 'Share prices adjusted',
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
    if (isStartOperatingTurn(action))
        return { text: `Started ${companyName(action.companyId)}’s turn`, routine: true }
    if (isStartOperatingRound(action)) {
        assertExists(action.metadata, 'A recorded operating round has its payments')
        const companyIncome = action.metadata.payments.filter(
            (payment) => payment.to.kind === 'company'
        )
        return companyIncome.length
            ? {
                  text: 'Private income',
                  detail: companyIncome
                      .map((payment) => `${nameOf(payment.to)} ${money(payment.amount)}`)
                      .join(' · ')
              }
            : { text: 'Operating order', important: true }
    }
    if (isEndGame(action)) return { text: 'Game ended', important: true }
    if (isOfferPurchase(action) || isRespondToPurchaseOffer(action)) {
        assertExists(action.metadata, 'Recorded purchase offer requires its terms')
        const { offer, accepted } = action.metadata
        if (isRespondToPurchaseOffer(action) && !accepted) return { text: 'Declined offer' }
        if (!isCompanyPurchaseOffer(offer))
            return {
                text: `Sold ${companyName(offer.asset.privateCompanyId)} to ${playerName(offer.buyerPlayerId)}`,
                value: money(offer.price),
                important: true
            }
        const purchaseAsset = offer.asset
        const trainDefinitionId = action.metadata.trainDefinitionId
        if (purchaseAsset.kind === 'train' && accepted) {
            assertExists(trainDefinitionId, 'Recorded train purchase names its train')
            return {
                text: 'Bought',
                trainDefinitionIds: [trainDefinitionId],
                omitActor: true,
                value: money(offer.price),
                detail: [`From ${nameOf(offer.seller)}`, ...closures].join(' · '),
                important: true
            }
        }
        const asset =
            purchaseAsset.kind === 'private'
                ? companyName(purchaseAsset.privateCompanyId)
                : purchaseAsset.kind === 'company'
                  ? companyName(purchaseAsset.companyId)
                  : `${trainDefinitionId} train`
        return {
            text: accepted
                ? `Bought ${asset}`
                : `Offered to buy ${asset} for ${money(offer.price)}`,
            omitActor: accepted,
            value: accepted ? money(offer.price) : undefined,
            detail: `From ${offer.seller.kind === 'bank' ? state.bank.name : nameOf(offer.seller)}`,
            important: accepted
        }
    }
    if (isOfferPrivatePurchase(action))
        return {
            text: `Offered ${money(action.price)} for ${companyName(action.privateCompanyId)}`
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
