import {
    RouteEvaluation,
    actsFor,
    certificatesInPool,
    closeShareCompany,
    companyStationCenters,
    connectedWithin,
    finiteCashOwnedBy,
    getCompany,
    grantOwnershipLimitExemption,
    hasTurnMark,
    markTurn,
    ownsRequiredTrain,
    privateOwningCompany,
    releaseTrains,
    settleCashPayments,
    stepAction,
    stockCertificateCount,
    titleAction,
    trainsCountingForLimit,
    trainsOwnedBy,
    treasuryPoolId,
    CashPayment,
    PresidencyChange,
    applyPresidencyChange,
    evaluatePresidency,
    type Owner,
    type RevenueCenter,
    type StationPosition,
    type StepAction,
    presidentOf
} from '@tabletop/18xx'
import { ActionSource, assert, assertExists, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import {
    Charters1822,
    LondonLocationId,
    MetropolitanHomeCost1822,
    MetropolitanId,
    minor1822
} from './companies.js'
import { LondonNodeIds } from './faces.js'
import { RoundelSlot1822 } from './housekeeping.js'
import { charterCertificateId, lotKind1822, removeUnsoldMinor1822 } from './lots.js'
import { TrainRules1822 } from './operating.js'
import { RouteRules1822 } from './routes.js'
import { awaitsAnswer, declinedMark } from './offers.js'
import type { HydratedState1822, StateHandler1822 } from './state.js'
import { TokenChoice, type TokenChoice1822 } from './titleState.js'
import { StockRules1822 } from './stock.js'
import { Market1822 } from './stockMarket.js'
import {
    exchangeTokens1822,
    tokenSpace1822,
    placeExchangeToken1822,
    releaseExchangeToken1822
} from './tokens.js'
import { PermanentLocalTrainId, PermanentTwoTrainId, Phases1822, PullmanTrainId } from './trains.js'

/** The operating turn's mark that its major company has acquired a minor (§5.18.1). */
export const AcquiredMark = 'acquired'
/** What a major company pays the bank for a minor company still in the bidding boxes (§5.19.2). */
export const BoxAcquisitionCost1822 = 200
/** The most shares a major company gives for a minor company (§5.18.3). */
const MaximumShares = 2

export type MinorAcquisition1822 = {
    companyId: string
    minorId: string
    /** Bought from its director, or from the bidding boxes (§5.18, §5.19). */
    source: 'director' | 'box'
    /** The minor company's director where another player directs it, who must agree (§5.18.1). */
    agreementPlayerId?: string
    /**
     * The shares the major may give, each with what the major then pays its director; a negative
     * amount is what the director pays the major (§5.18.3).
     */
    terms: { shares: number; payment: number }[]
    tokens: TokenChoice1822[]
    /** Trains the major must discard once it holds the minor's (§5.18.6). */
    excessTrains: number
    /** The London stations a Metropolitan Railway bought from the boxes may be placed beside (§5.10.5). */
    londonNodeIds?: readonly string[]
}

function permanentTrain(definitionId: string): boolean {
    return definitionId === PermanentTwoTrainId || definitionId === PermanentLocalTrainId
}

/** The minor's trains the major cannot keep: a second Pullman, or a second permanent train (§5.5.14, §5.18.8). */
function surplusExtraTrains(
    state: HydratedState1822,
    companyId: string,
    minorId: string
): string[] {
    const mine = trainsOwnedBy(state, { kind: 'company', companyId })
    return trainsOwnedBy(state, { kind: 'company', companyId: minorId })
        .filter(
            (train) =>
                (train.definitionId === PullmanTrainId &&
                    mine.some((own) => own.definitionId === PullmanTrainId)) ||
                (permanentTrain(train.definitionId) &&
                    mine.some((own) => permanentTrain(own.definitionId)))
        )
        .map((train) => train.id)
}

/** Whether the major can trace a route from one of its stations to the stop (§5.18.1). */
function reaches(state: HydratedState1822, companyId: string, target: RevenueCenter): boolean {
    const { network } = new RouteEvaluation(state, RouteRules1822)
    return companyStationCenters(state, companyId).some((from) =>
        connectedWithin(network, state, companyId, from, target, Infinity)
    )
}

function hasStationAt(state: HydratedState1822, companyId: string, city: RevenueCenter): boolean {
    return state.stations.some(
        (station) =>
            station.status === 'placed' &&
            station.companyId === companyId &&
            station.position.locationId === city.locationId &&
            station.position.nodeId === city.nodeId
    )
}

/** What the major may do with an exchange token as it takes a minor's place (§5.18.6, §5.18.7). */
function tokenChoices(state: HydratedState1822, companyId: string, home: RevenueCenter) {
    if (!exchangeTokens1822(state, companyId)) return ['none' as const]
    // A company holds one station in a city, though several of London's (§5.18.7).
    return hasStationAt(state, companyId, home)
        ? ['available' as const]
        : ['place' as const, 'available' as const]
}

/** The major company buying trains now, once it may acquire: train owned, nothing issued or redeemed yet (§5.3.1). */
function acquiringMajor(state: HydratedState1822, playerId: string): string | undefined {
    const companyId = state.trainPurchaseStep?.companyId
    return state.machineState === 'BuyingTrains' &&
        companyId &&
        getCompany(state, companyId).kind === 'major' &&
        actsFor(state, playerId, companyId) &&
        !hasTurnMark(state, AcquiredMark) &&
        !state.acquisitionOffer &&
        state.financeStep?.companyId !== companyId &&
        !state.debutCompanyIds.includes(companyId) &&
        ownsRequiredTrain(state, TrainRules1822, companyId)
        ? companyId
        : undefined
}

function directorAcquisition(
    state: HydratedState1822,
    companyId: string,
    minorId: string
): MinorAcquisition1822 | undefined {
    const minor = getCompany(state, minorId)
    const director = presidentOf(state, companyId)
    const home = state.stations.find(
        (station) => station.companyId === minorId && station.status === 'placed'
    )
    const seller = presidentOf(state, minorId)
    if (
        minor.kind !== 'minor' ||
        !minor.floated ||
        minor.closed ||
        state.debutCompanyIds.includes(minorId) ||
        home?.status !== 'placed' ||
        director?.kind !== 'player' ||
        seller?.kind !== 'player' ||
        hasTurnMark(state, declinedMark(minorId)) ||
        !reaches(state, companyId, home.position)
    )
        return undefined
    const value = Market1822.companySpace(state.stockMarket, minorId).price * 2
    const price = Market1822.companySpace(state.stockMarket, companyId).price
    const treasuryShares = certificatesInPool(state, treasuryPoolId(companyId)).filter(
        (certificate) => certificate.kind === 'share' && certificate.shares === 1
    ).length
    const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
    const directorCash = finiteCashOwnedBy(state, seller)
    const held = stockCertificateCount(state, seller, StockRules1822)
    const limit = StockRules1822.certificateLimit(state, seller)
    const minorCertificate = state.certificates.find(
        (certificate) =>
            certificate.companyId === minorId &&
            certificate.kind === 'share' &&
            certificate.president
    )
    const majorCertificate = certificatesInPool(state, treasuryPoolId(companyId))[0]
    const freed = minorCertificate ? StockRules1822.certificateWeight(state, minorCertificate) : 0
    const weight = majorCertificate ? StockRules1822.certificateWeight(state, majorCertificate) : 1
    const terms = Array.from({ length: MaximumShares + 1 }, (_, shares) => ({
        shares,
        payment: value - shares * price
    })).filter(
        ({ shares, payment }) =>
            shares <= treasuryShares &&
            (payment >= 0 ? payment <= treasury : -payment <= directorCash) &&
            // A player is never taken over the certificate limit (§5.18.5).
            (shares * weight <= freed || held - freed + shares * weight <= limit)
    )
    if (!terms.length) return undefined
    const combined =
        trainsCountingForLimit(state, TrainRules1822, companyId).length +
        trainsCountingForLimit(state, TrainRules1822, minorId).length
    return {
        companyId,
        minorId,
        source: 'director',
        ...(seller.playerId === director.playerId ? {} : { agreementPlayerId: seller.playerId }),
        terms,
        tokens: tokenChoices(state, companyId, home.position),
        excessTrains: Math.max(0, combined - TrainRules1822.trainLimit(state, companyId))
    }
}

function boxAcquisition(
    state: HydratedState1822,
    companyId: string,
    minorId: string
): MinorAcquisition1822 | undefined {
    if (
        !Phases1822.isAtLeast(state.phaseId, '5') ||
        finiteCashOwnedBy(state, { kind: 'company', companyId }) < BoxAcquisitionCost1822
    )
        return undefined
    const base = { companyId, minorId, source: 'box' as const, excessTrains: 0 }
    const terms = [{ shares: 0, payment: BoxAcquisitionCost1822 }]
    if (minorId === MetropolitanId) {
        const londonNodeIds = LondonNodeIds.filter((nodeId) =>
            reaches(state, companyId, { locationId: LondonLocationId, nodeId })
        )
        if (!londonNodeIds.length) return undefined
        return {
            ...base,
            terms,
            tokens: exchangeTokens1822(state, companyId) ? ['place', 'available'] : ['none'],
            londonNodeIds
        }
    }
    const home = minor1822(minorId)?.home
    if (!home || !reaches(state, companyId, home)) return undefined
    return { ...base, terms, tokens: tokenChoices(state, companyId, home) }
}

/** The minor companies the player's major company may acquire now, and on what terms (§5.18, §5.19). */
export function minorAcquisitions1822(
    state: HydratedState1822,
    playerId: string
): MinorAcquisition1822[] {
    const companyId = acquiringMajor(state, playerId)
    if (!companyId) return []
    return [
        ...state.companies.flatMap((company) => {
            const offer =
                company.kind === 'minor'
                    ? directorAcquisition(state, companyId, company.id)
                    : undefined
            return offer ? [offer] : []
        }),
        ...state.bidBoxes.boxes.flatMap(({ lotId }) => {
            const offer =
                lotKind1822(lotId) === 'minor' ? boxAcquisition(state, companyId, lotId) : undefined
            return offer ? [offer] : []
        })
    ]
}

/** What an acquisition moved (§5.18.6). */
const AcquisitionDetails = Type.Object(
    {
        source: Type.Union([Type.Literal('director'), Type.Literal('box')]),
        playerId: Type.Optional(Type.String()),
        /** The offer waits for the minor company's director to answer (§5.18.1). */
        awaiting: Type.Optional(Type.Literal(true)),
        presidency: Type.Optional(PresidencyChange),
        payments: Type.Array(CashPayment),
        certificateIds: Type.Array(Type.String()),
        cash: Type.Integer({ minimum: 0 }),
        trains: Type.Array(
            Type.Object(
                { trainId: Type.String(), definitionId: Type.String() },
                { additionalProperties: false }
            )
        ),
        discarded: Type.Array(
            Type.Object(
                { trainId: Type.String(), definitionId: Type.String() },
                { additionalProperties: false }
            )
        ),
        removedTrainIds: Type.Array(Type.String()),
        privateIds: Type.Array(Type.String()),
        station: Type.Optional(
            Type.Object(
                {
                    stationId: Type.String(),
                    locationId: Type.String(),
                    nodeId: Type.String(),
                    slot: Type.Integer({ minimum: 0 })
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type AcquisitionDetails1822 = Type.Static<typeof AcquisitionDetails>

const AcquireMinorAction = titleAction('AcquireMinor', {
    companyId: Type.String({ minLength: 1 }),
    minorId: Type.String({ minLength: 1 }),
    shares: Type.Integer({ minimum: 0, maximum: MaximumShares }),
    token: TokenChoice,
    /** The trains discarded to the bank pool to come within the train limit (§5.18.6). */
    discardTrainIds: Type.Array(Type.String({ minLength: 1 })),
    /** The London station a Metropolitan Railway bought from the boxes is placed beside (§5.10.5). */
    nodeId: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(AcquisitionDetails)
})
export const AcquireMinor = AcquireMinorAction.schema
export type AcquireMinor = Type.Static<typeof AcquireMinor>
export const isAcquireMinor = AcquireMinorAction.is

type Details = AcquisitionDetails1822

type DirectorTerms = {
    companyId: string
    minorId: string
    shares: number
    payment: number
    token: TokenChoice1822
    discardTrainIds: readonly string[]
}

const NothingMoved: Details = {
    source: 'director',
    payments: [],
    certificateIds: [],
    cash: 0,
    trains: [],
    discarded: [],
    removedTrainIds: [],
    privateIds: []
}

/** The exchange token placed where the minor's station stood, or made available (§5.18.6). */
function exchangeToken(
    state: HydratedState1822,
    companyId: string,
    token: TokenChoice1822,
    position: StationPosition
): Pick<Details, 'station'> {
    if (token === 'available') releaseExchangeToken1822(state, companyId)
    if (token !== 'place') return {}
    const stationId = placeExchangeToken1822(state, companyId, position)
    return { station: { stationId, ...position } }
}

/**
 * The major takes the minor from its director for shares and cash, with all the minor owns
 * (§5.18.2–§5.18.6).
 */
function acquireFromDirector(state: HydratedState1822, terms: DirectorTerms): Details {
    const { payment } = terms
    const major: Owner = { kind: 'company', companyId: terms.companyId }
    const minor: Owner = { kind: 'company', companyId: terms.minorId }
    const director = presidentOf(state, terms.minorId)
    assert(director?.kind === 'player', 'A minor company has a director')
    const home = state.stations.find(
        (station) => station.companyId === terms.minorId && station.status === 'placed'
    )
    assert(home?.status === 'placed', 'An operating minor company has its home station')
    const certificates = certificatesInPool(state, treasuryPoolId(terms.companyId))
        .filter((certificate) => certificate.kind === 'share' && certificate.shares === 1)
        .slice(0, terms.shares)
    for (const certificate of certificates) {
        certificate.owner = director
        delete certificate.poolId
    }
    const payments: CashPayment[] = payment
        ? [
              payment > 0
                  ? { from: major, to: director, amount: payment }
                  : { from: director, to: major, amount: -payment }
          ]
        : []
    const cash = finiteCashOwnedBy(state, minor)
    if (cash) payments.push({ from: minor, to: major, amount: cash })
    settleCashPayments(state, payments)
    // Shares taken in exchange may carry a holding past 60% (§3.4.2).
    if (certificates.length)
        grantOwnershipLimitExemption(state, Charters1822, terms.companyId, director)
    // The shares may make the minor's director the major's (§3.4.2).
    const presidency = evaluatePresidency(
        state,
        terms.companyId,
        StockRules1822.presidencyCandidates(state, terms.companyId)
    ).change
    if (presidency) applyPresidencyChange(state, presidency)
    const removedTrainIds = surplusExtraTrains(state, terms.companyId, terms.minorId)
    releaseTrains(state.trainInventory, removedTrainIds, 'removed')
    const trains = trainsOwnedBy(state, minor).map((train) => ({
        trainId: train.id,
        definitionId: train.definitionId
    }))
    state.trainInventory.trains = state.trainInventory.trains.map((train) =>
        trains.some((moved) => moved.trainId === train.id) && train.status === 'owned'
            ? { ...train, owner: major }
            : train
    )
    const discarded = terms.discardTrainIds.flatMap((trainId) => {
        const train = state.trainInventory.trains.find((entry) => entry.id === trainId)
        return train ? [{ trainId, definitionId: train.definitionId }] : []
    })
    releaseTrains(state.trainInventory, terms.discardTrainIds, 'market')
    const privateIds = state.companies
        .filter(
            (company) =>
                company.kind === 'private' &&
                privateOwningCompany(state, company.id) === terms.minorId
        )
        .map((company) => company.id)
    for (const privateId of privateIds) {
        const certificate = state.certificates.find(
            (entry) => entry.id === charterCertificateId(privateId)
        )
        if (certificate) certificate.owner = major
    }
    state.discountTokens = state.discountTokens.map((entry) =>
        entry.companyId === terms.minorId ? { ...entry, companyId: terms.companyId } : entry
    )
    if (state.hillDiscountCompanyId === terms.minorId) state.hillDiscountCompanyId = terms.companyId
    const position = { ...home.position }
    closeShareCompany(state, terms.minorId, 'removed')
    if (
        terms.minorId === MetropolitanId &&
        position.slot === RoundelSlot1822 &&
        terms.token !== 'place'
    )
        state.vacatedRoundelNodeId = position.nodeId
    return {
        source: 'director',
        playerId: director.playerId,
        payments,
        certificateIds: certificates.map((certificate) => certificate.id),
        cash,
        trains,
        discarded,
        removedTrainIds,
        privateIds,
        ...(presidency ? { presidency } : {}),
        ...exchangeToken(state, terms.companyId, terms.token, position)
    }
}

/**
 * After buying trains a major company acquires a minor company: from its director, for twice
 * its share value paid in up to two treasury shares and cash, taking all it owns; or from phase
 * 5 from the bidding boxes for £200. An exchange token takes the minor's station or becomes
 * available (§5.18, §5.19).
 */
export class HydratedAcquireMinor extends AcquireMinorAction.Base {
    declare playerId: string
    declare companyId: AcquireMinor['companyId']
    declare minorId: AcquireMinor['minorId']
    declare shares: AcquireMinor['shares']
    declare token: AcquireMinor['token']
    declare discardTrainIds: AcquireMinor['discardTrainIds']
    declare nodeId?: AcquireMinor['nodeId']
    declare metadata?: AcquireMinor['metadata']
    private offer(state: HydratedState1822): MinorAcquisition1822 | undefined {
        return minorAcquisitions1822(state, this.playerId).find(
            (offer) => offer.companyId === this.companyId && offer.minorId === this.minorId
        )
    }
    isValid(state: HydratedState1822): boolean {
        if (this.source !== ActionSource.User) return false
        const offer = this.offer(state)
        if (
            !offer ||
            !offer.terms.some((terms) => terms.shares === this.shares) ||
            !offer.tokens.includes(this.token) ||
            this.discardTrainIds.length !== offer.excessTrains ||
            new Set(this.discardTrainIds).size !== this.discardTrainIds.length
        )
            return false
        if (
            offer.londonNodeIds
                ? !this.nodeId || !offer.londonNodeIds.includes(this.nodeId)
                : !!this.nodeId
        )
            return false
        if (
            offer.londonNodeIds &&
            this.token === 'place' &&
            finiteCashOwnedBy(state, { kind: 'company', companyId: this.companyId }) <
                BoxAcquisitionCost1822 + MetropolitanHomeCost1822
        )
            return false
        const surplus = surplusExtraTrains(state, this.companyId, this.minorId)
        const counting = [
            ...trainsCountingForLimit(state, TrainRules1822, this.companyId),
            ...trainsCountingForLimit(state, TrainRules1822, this.minorId)
        ]
        return this.discardTrainIds.every(
            (id) => counting.some((train) => train.id === id) && !surplus.includes(id)
        )
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'This minor company cannot be acquired on these terms')
        const offer = this.offer(state)
        assertExists(offer, 'A valid acquisition has its terms')
        const terms = offer.terms.find((entry) => entry.shares === this.shares)
        assertExists(terms, 'A valid acquisition names its shares')
        if (offer.agreementPlayerId) {
            state.acquisitionOffer = {
                companyId: this.companyId,
                minorId: this.minorId,
                playerId: offer.agreementPlayerId,
                shares: this.shares,
                token: this.token,
                discardTrainIds: [...this.discardTrainIds]
            }
            state.activePlayerIds = [offer.agreementPlayerId]
            this.metadata = { ...NothingMoved, playerId: offer.agreementPlayerId, awaiting: true }
            return
        }
        this.metadata =
            offer.source === 'box'
                ? this.fromBox(state)
                : acquireFromDirector(state, this.terms(terms.payment))
        markTurn(state, AcquiredMark)
    }
    private terms(payment: number): DirectorTerms {
        return {
            companyId: this.companyId,
            minorId: this.minorId,
            shares: this.shares,
            token: this.token,
            discardTrainIds: this.discardTrainIds,
            payment
        }
    }
    private fromBox(state: HydratedState1822): Details {
        const major: Owner = { kind: 'company', companyId: this.companyId }
        const home = minor1822(this.minorId)?.home
        const roundel = this.minorId === MetropolitanId && this.token === 'place'
        const payments: CashPayment[] = [
            {
                from: major,
                to: { kind: 'bank' },
                amount: BoxAcquisitionCost1822 + (roundel ? MetropolitanHomeCost1822 : 0)
            }
        ]
        settleCashPayments(state, payments)
        state.bidBoxes.boxes = state.bidBoxes.boxes.filter((box) => box.lotId !== this.minorId)
        removeUnsoldMinor1822(state, this.minorId)
        const city = this.nodeId ? { locationId: LondonLocationId, nodeId: this.nodeId } : home
        assertExists(city, 'A minor company has a home')
        const position = roundel
            ? { ...city, slot: RoundelSlot1822 }
            : { ...city, slot: tokenSpace1822(state, this.companyId, city) }
        return {
            source: 'box',
            payments,
            certificateIds: [],
            cash: 0,
            trains: [],
            discarded: [],
            removedTrainIds: [],
            privateIds: [],
            ...exchangeToken(state, this.companyId, this.token, position)
        }
    }
}

const AnswerAcquisitionAction = titleAction('AnswerAcquisition', {
    accept: Type.Boolean(),
    metadata: Type.Optional(
        Type.Object(
            {
                companyId: Type.String(),
                minorId: Type.String(),
                token: TokenChoice,
                /** What moved, where the offer was accepted. */
                acquired: Type.Optional(AcquisitionDetails)
            },
            { additionalProperties: false }
        )
    )
})
export const AnswerAcquisition = AnswerAcquisitionAction.schema
export type AnswerAcquisition = Type.Static<typeof AnswerAcquisition>
export const isAnswerAcquisition = AnswerAcquisitionAction.is

/** What the major pays the minor's director on the offer's terms, the share values as they stand. */
export function offeredPayment1822(state: HydratedState1822): number {
    const offer = state.acquisitionOffer
    assertExists(offer, 'An answer needs an offer')
    const value = Market1822.companySpace(state.stockMarket, offer.minorId).price * 2
    return value - offer.shares * Market1822.companySpace(state.stockMarket, offer.companyId).price
}

/** The director of a minor company agrees to a major's offer for it, or declines (§5.18.1). */
export class HydratedAnswerAcquisition extends AnswerAcquisitionAction.Base {
    declare playerId: string
    declare accept: AnswerAcquisition['accept']
    declare metadata?: AnswerAcquisition['metadata']
    isValid(state: HydratedState1822): boolean {
        return (
            this.source === ActionSource.User && state.acquisitionOffer?.playerId === this.playerId
        )
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'No offer awaits this player')
        const offer = state.acquisitionOffer
        assertExists(offer, 'An answer needs an offer')
        const director = presidentOf(state, offer.companyId)
        assert(director?.kind === 'player', 'A major company has a director')
        const { companyId, minorId, token } = offer
        if (this.accept) {
            const acquired = acquireFromDirector(state, {
                ...offer,
                payment: offeredPayment1822(state)
            })
            this.metadata = { companyId, minorId, token, acquired }
            markTurn(state, AcquiredMark)
        } else {
            this.metadata = { companyId, minorId, token }
            markTurn(state, declinedMark(minorId))
        }
        delete state.acquisitionOffer
        const now = presidentOf(state, offer.companyId)
        state.activePlayerIds = [now?.kind === 'player' ? now.playerId : director.playerId]
    }
}

/** While an offer for a minor company awaits its director, only their answer is taken (§5.18.1). */
export function awaitsAcquisitionAnswer(handler: StateHandler1822): StateHandler1822 {
    return awaitsAnswer(handler, {
        type: AnswerAcquisitionAction.type,
        is: (action): action is HydratedAnswerAcquisition =>
            action instanceof HydratedAnswerAcquisition,
        isValid: (action, state) => action.isValid(state),
        offeredTo: (state) => state.acquisitionOffer?.playerId
    })
}

export const AcquireMinorStep: StepAction<HydratedState1822> = stepAction(
    AcquireMinorAction.type,
    (action: HydratedAction): action is HydratedAcquireMinor =>
        action instanceof HydratedAcquireMinor,
    (state, playerId) => minorAcquisitions1822(state, playerId).length > 0
)

export const AcquisitionActions = [
    AcquireMinorAction.define((action) => new HydratedAcquireMinor(action)),
    AnswerAcquisitionAction.define((action) => new HydratedAnswerAcquisition(action))
]
