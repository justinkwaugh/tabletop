import {
    BidBoxSettlement1822,
    EnglishChannelLocationId,
    LondonLocationId,
    LnwrId,
    PhaseChanges1822,
    isAcquireMinor,
    isAcquirePrivate,
    isAnswerAcquisition,
    isAnswerPrivateOffer,
    isBuyLocalTrain,
    isDeclareCash,
    isMoveStackCard,
    isPlaceMetropolitanHome,
    isReachDestination,
    isRepayPlayerLoan,
    isSwapStationToken,
    isUseDiscountToken,
    type AcquirePrivate,
    type AcquisitionDetails1822,
    type PrivateAcquisitionDetails1822,
    type TokenChoice1822
} from '@tabletop/1822'
import { isAdvancePhase, isSettleBidBoxes } from '@tabletop/18xx'
import { counted, joinDetails, type TitleActionDescription } from '@tabletop/18xx-ui'
import { Value } from 'typebox/value'
import { lotName } from './lots.js'
import { Presentation1822 } from './presentation.js'

const list = new Intl.ListFormat('en', { type: 'conjunction' })
const money = Presentation1822.money

/** London's six stations, by the side of the city each stands on. */
export const LondonStationNames: Readonly<Record<string, string>> = {
    s: 'south',
    sw: 'south-west',
    nw: 'north-west',
    n: 'north',
    ne: 'north-east',
    se: 'south-east'
}

function trains(definitionIds: readonly string[]): string {
    return list.format(definitionIds.map((id) => `${id}-train`))
}

type Names = { companyName(id: string): string; playerName(id: string): string }
/** Names with a place's, which the history shows as a link to it. */
type PlaceNames = Names & { place(locationId: string): string }

/** What a round's settled bids did beside selling the lots (§3.3.5, §4.10). */
export function settlementDetails(details: BidBoxSettlement1822, names: Names): string[] {
    const removed = details.removedTrains.map((train) => train.definitionId)
    return [
        ...details.minors.map(
            (minor) =>
                `${names.companyName(minor.companyId)} starts at ${money(minor.parPrice)} with ${money(minor.treasury)}`
        ),
        ...(details.removedMinor
            ? [
                  `${names.companyName(details.removedMinor.companyId)} had no bid in the first box and is removed${details.removedMinor.train ? `, and one ${details.removedMinor.train.definitionId}-train with it` : ''}`
              ]
            : []),
        ...(removed.length
            ? [
                  `${removed.length === 1 ? 'A train was' : `${removed.length} trains were`} removed for the minor companies no one bid on`
              ]
            : []),
        ...(details.toPhaseId ? [`Phase ${details.toPhaseId} begins`] : []),
        ...details.loanInterest.map(
            (loan) => `${names.playerName(loan.playerId)}’s loan grows by ${money(loan.interest)}`
        ),
        ...(details.nothingSold ? ['Nothing was sold, so the game ends'] : [])
    ]
}

/** What a minor company brought the major that acquired it (§5.18.6). */
export function minorAcquisitionDetails(
    terms: { companyId: string; token: TokenChoice1822 },
    details: AcquisitionDetails1822,
    names: PlaceNames
): string[] {
    const company = names.companyName(terms.companyId)
    const director = details.playerId ? names.playerName(details.playerId) : undefined
    const paid = details.payments.find(
        (payment) =>
            payment.from.kind === 'company' &&
            payment.from.companyId === terms.companyId &&
            payment.to.kind !== 'company'
    )
    const received = details.payments.find(
        (payment) =>
            payment.from.kind === 'player' &&
            payment.to.kind === 'company' &&
            payment.to.companyId === terms.companyId
    )
    const shares = details.certificateIds.length
    return [
        ...(details.source === 'box' ? ['From the bidding boxes'] : []),
        ...(director && shares
            ? [`${director} took ${counted(shares, 'share')} of ${company}`]
            : []),
        ...(paid
            ? [
                  `${company} paid ${director && paid.to.kind === 'player' ? director : 'the bank'} ${money(paid.amount)}`
              ]
            : []),
        ...(received && director ? [`${director} paid ${company} ${money(received.amount)}`] : []),
        ...(details.cash ? [`Treasury of ${money(details.cash)}`] : []),
        ...(details.trains.length
            ? [`Took its ${trains(details.trains.map((train) => train.definitionId))}`]
            : []),
        ...(details.discarded.length
            ? [`Discarded ${trains(details.discarded.map((train) => train.definitionId))}`]
            : []),
        ...(details.privateIds.length
            ? [`Took ${list.format(details.privateIds.map(names.companyName))}`]
            : []),
        ...(details.station
            ? [`Exchange token placed in ${names.place(details.station.locationId)}`]
            : terms.token === 'available'
              ? ['Exchange token made available']
              : [])
    ]
}

const PrivateChoices: Readonly<
    Record<NonNullable<AcquirePrivate['choice']>, (channel: string) => string>
> = {
    token: () => 'Took its terrain token',
    discount: () => 'Took its standing hill and mountain discount',
    channel: (channel) => `Placed an exchange token in the ${channel}`,
    upgrade: (channel) => `Upgraded the ${channel} and placed an exchange token there`,
    available: () => 'Made an exchange token available'
}

/** What a company took with a private company (§3.1.7, Table 3). */
export function privateAcquisitionDetails(
    choice: AcquirePrivate['choice'],
    details: PrivateAcquisitionDetails1822,
    names: PlaceNames
): string[] {
    return [
        `From ${names.playerName(details.playerId)}`,
        ...(choice ? [PrivateChoices[choice](names.place(EnglishChannelLocationId))] : []),
        ...(details.upgradeCost ? [`Paid ${money(details.upgradeCost)} for the upgrade`] : []),
        ...(details.received ? [`Received ${money(details.received)}`] : []),
        ...(details.discardedDefinitionId
            ? [`Discarded ${trains([details.discardedDefinitionId])}`]
            : []),
        ...(details.closed ? ['The private company closed'] : [])
    ]
}

/** 1822's own history rows, beside the family's. */
export function describe1822Action(session: {
    getPlayerName(playerId: string): string
}): TitleActionDescription {
    return (action, { companyName, place }, shared) => {
        const names = {
            companyName,
            place,
            playerName: (playerId: string) => session.getPlayerName(playerId)
        }
        if (isSettleBidBoxes(action)) {
            const description = shared()
            const details = action.metadata?.details
            return Value.Check(BidBoxSettlement1822, details)
                ? {
                      ...description,
                      detailLines: [
                          ...(description.detailLines ?? []),
                          ...settlementDetails(details, names)
                      ]
                  }
                : description
        }
        if (isAdvancePhase(action)) {
            const description = shared()
            const changes = action.metadata?.changes
            if (!Value.Check(PhaseChanges1822, changes)) return description
            return {
                ...description,
                detail: joinDetails(
                    description.detail,
                    changes.removedConcessionIds.length
                        ? `${list.format(changes.removedConcessionIds.map(lotName))} removed`
                        : undefined,
                    ...changes.closedPrivates.map(
                        (closed) =>
                            `${companyName(closed.privateCompanyId)} closed${closed.returned ? `, its ${money(closed.returned)} back with the bank` : ''}`
                    )
                )
            }
        }
        if (isReachDestination(action)) {
            const destination = action.metadata
                ? place(action.metadata.locationId)
                : 'its destination'
            return {
                text: `${companyName(action.companyId)} reached ${destination}`,
                detail:
                    action.companyId === LnwrId || action.metadata?.stationId
                        ? 'Its station there is now its destination'
                        : 'Placed its destination token',
                omitActor: true,
                companyToken: action.companyId,
                important: true,
                consequence: true
            }
        }
        if (isBuyLocalTrain(action))
            return {
                text: 'Bought an L-train for its first turn',
                value: money(action.expectedPrice),
                trainDefinitionIds: ['L']
            }
        if (isPlaceMetropolitanHome(action))
            return {
                text: `Placed its home beside ${place(LondonLocationId)}’s ${LondonStationNames[action.nodeId]} station`,
                ...(action.metadata ? { value: money(action.metadata.cost) } : {})
            }
        if (isAcquirePrivate(action)) {
            const details = action.metadata
            if (details?.awaiting)
                return {
                    text: `Asked for ${companyName(action.privateCompanyId)}`,
                    detail: `${names.playerName(details.playerId)} holds it and answers`
                }
            return {
                text: `Acquired ${companyName(action.privateCompanyId)}`,
                ...(details
                    ? {
                          detail: joinDetails(
                              ...privateAcquisitionDetails(action.choice, details, names)
                          )
                      }
                    : {}),
                important: true
            }
        }
        if (isAnswerPrivateOffer(action) && action.metadata) {
            const terms = action.metadata
            const company = companyName(terms.companyId)
            const held = companyName(terms.privateCompanyId)
            return terms.acquired
                ? {
                      text: `Let ${company} have ${held}`,
                      detail: joinDetails(
                          ...privateAcquisitionDetails(terms.choice, terms.acquired, names)
                      ),
                      important: true
                  }
                : { text: `Kept ${held} from ${company}` }
        }
        if (isUseDiscountToken(action))
            return {
                text:
                    action.kind === 'terrain'
                        ? 'Will pay its next terrain with its token'
                        : 'Will pay its next estuary crossings with its tokens'
            }
        if (isMoveStackCard(action))
            return {
                text: `Moved ${lotName(action.lotId)} to the ${action.to} of its stack`,
                important: true
            }
        if (isSwapStationToken(action))
            return {
                text:
                    action.direction === 'to-available'
                        ? 'Made an exchange token available'
                        : 'Put an available token back with its exchange tokens'
            }
        if (isAcquireMinor(action)) {
            const details = action.metadata
            if (details?.awaiting)
                return {
                    text: `Offered to acquire ${companyName(action.minorId)}`,
                    ...(details.playerId
                        ? { detail: `${names.playerName(details.playerId)} directs it and answers` }
                        : {}),
                    companyToken: action.minorId
                }
            return {
                text: `Acquired ${companyName(action.minorId)}`,
                ...(details
                    ? { detail: joinDetails(...minorAcquisitionDetails(action, details, names)) }
                    : {}),
                companyToken: action.minorId,
                important: true
            }
        }
        if (isAnswerAcquisition(action) && action.metadata) {
            const terms = action.metadata
            const major = companyName(terms.companyId)
            const minor = companyName(terms.minorId)
            return terms.acquired
                ? {
                      text: `Agreed to ${major} acquiring ${minor}`,
                      detail: joinDetails(...minorAcquisitionDetails(terms, terms.acquired, names)),
                      companyToken: terms.minorId,
                      important: true
                  }
                : {
                      text: `Declined ${major}’s offer for ${minor}`,
                      companyToken: terms.minorId
                  }
        }
        if (isRepayPlayerLoan(action))
            return {
                text: action.metadata?.remaining === 0 ? 'Paid off a loan' : 'Paid towards a loan',
                ...(action.metadata
                    ? {
                          value: money(action.metadata.paid),
                          ...(action.metadata.remaining
                              ? { detail: `${money(action.metadata.remaining)} still owed` }
                              : {})
                      }
                    : {})
            }
        if (isDeclareCash(action))
            return {
                text: action.doubled
                    ? 'Declared double cash for the next stock round’s order'
                    : 'Declared cash as it stands'
            }
        return undefined
    }
}
