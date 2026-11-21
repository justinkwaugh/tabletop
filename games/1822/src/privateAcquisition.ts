import {
    RailwayMapState,
    TrackConstruction,
    actsFor,
    applyTrackLay,
    closePrivate,
    finiteCashOwnedBy,
    getCompany,
    hasTurnMark,
    markTurn,
    nextOperatingCompany,
    privateOwner,
    releaseTrains,
    settleCashPayments,
    stepAction,
    titleAction,
    trainsCountingForLimit,
    trainsOwnedBy,
    type StepAction,
    type TrackLayDetails,
    presidentOf
} from '@tabletop/18xx'
import { ActionSource, assert, assertExists, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import { CityNodeId } from './faces.js'
import { charterCertificateId } from './lots.js'
import { Map1822 } from './map.js'
import { metropolitanHomeDue1822 } from './housekeeping.js'
import { TrainRules1822 } from './operating.js'
import {
    EnglishChannelLocationId,
    EnglishChannelPrivateId,
    HillDiscountPrivateId,
    PhaseCreditPrivateIds,
    RiverDiscountPrivateId,
    private1822,
    type Private1822
} from './privates.js'
import { awaitsAnswer, declinedMark } from './offers.js'
import type { HydratedState1822, StateHandler1822 } from './state.js'
import { AcquisitionChoice, type AcquisitionChoice1822 } from './titleState.js'
import { EnglishChannelTileIds1822, TileSet1822 } from './tiles.js'
import { TrackRules1822 } from './track.js'
import {
    exchangeTokens1822,
    nextStationSlot,
    placeExchangeToken1822,
    releaseExchangeToken1822
} from './tokens.js'
import {
    PermanentLocalTrainId,
    PermanentTwoTrainId,
    Phases1822,
    PrivateTrains1822,
    PullmanTrainId
} from './trains.js'

/** The estuary tokens P10 gives the company that acquires it (Table 3). */
const EstuaryTokenCount = 2

/** The company in its turn before any track is laid, when it acquires private companies (§5.3.1, §5.7). */
function acquiringCompany(state: HydratedState1822, playerId: string): string | undefined {
    const companyId = state.trackStep?.companyId
    return state.machineState === 'LayingTrack' &&
        companyId &&
        nextOperatingCompany(state) === companyId &&
        actsFor(state, playerId, companyId) &&
        !state.trackStep?.lays.length &&
        !state.trackStep?.extraLays?.length &&
        !state.privateOffer &&
        !metropolitanHomeDue1822(state)
        ? companyId
        : undefined
}

/** A free station space in the English Channel, if it has one (§5.12.10). */
function channelSlot(state: HydratedState1822): number | undefined {
    const city = new RailwayMapState(Map1822, TileSet1822, state.tileInventory)
        .tile(EnglishChannelLocationId)
        .face.nodes.find((node) => node.id === CityNodeId)
    const slot = nextStationSlot(state, {
        locationId: EnglishChannelLocationId,
        nodeId: CityNodeId
    })
    return city?.kind === 'city' && slot < city.stationSlots ? slot : undefined
}

/**
 * The upgrade of the English Channel that would give it a free station space, as the company's
 * track for the turn, on no route of its own (§3.1.17, §5.12.10).
 */
function channelUpgrade(state: HydratedState1822, companyId: string): TrackLayDetails | undefined {
    const construction = new TrackConstruction(state, { ...TrackRules1822, useful: () => true })
    for (const definitionId of EnglishChannelTileIds1822) {
        const details = construction.evaluate({
            companyId,
            locationId: EnglishChannelLocationId,
            definitionId,
            rotation: 0,
            nodeMapping: { [CityNodeId]: CityNodeId }
        }).details
        const city = TileSet1822.definitions
            .find((tile) => tile.id === definitionId)
            ?.face.nodes.find((node) => node.id === CityNodeId)
        const taken = nextStationSlot(state, {
            locationId: EnglishChannelLocationId,
            nodeId: CityNodeId
        })
        if (details && city?.kind === 'city' && city.stationSlots > taken) return details
    }
    return undefined
}

/** The ways the company may take up the private, or none where it has no choice to make. */
export function acquisitionChoices1822(
    state: HydratedState1822,
    companyId: string,
    privateCompanyId: string
): AcquisitionChoice1822[] {
    if (privateCompanyId === HillDiscountPrivateId) return ['token', 'discount']
    if (privateCompanyId !== EnglishChannelPrivateId) return []
    if (!exchangeTokens1822(state, companyId)) return []
    const ownStation = state.stations.some(
        (station) =>
            station.status === 'placed' &&
            station.companyId === companyId &&
            station.position.locationId === EnglishChannelLocationId
    )
    if (ownStation) return ['available']
    if (channelSlot(state) !== undefined) return ['channel', 'available']
    return [...(channelUpgrade(state, companyId) ? ['upgrade' as const] : []), 'available']
}

function ownsTrain(state: HydratedState1822, companyId: string, definitionIds: readonly string[]) {
    return trainsOwnedBy(state, { kind: 'company', companyId }).some((train) =>
        definitionIds.includes(train.definitionId)
    )
}

/**
 * Why the company may not acquire the private from the player holding it now, if it may not
 * (§3.1.2–§3.1.5, §5.5.13, §5.5.14).
 */
export function privateAcquisitionReason1822(
    state: HydratedState1822,
    companyId: string,
    entry: Private1822
): string | undefined {
    const company = getCompany(state, companyId)
    const owner = privateOwner(state, entry.id)
    if (getCompany(state, entry.id).closed || owner?.kind !== 'player')
        return 'A player does not hold this private company.'
    if (hasTurnMark(state, declinedMark(entry.id)))
        return 'Its holder declined to part with this private company this turn.'
    if (!entry.acquiredFromPhaseId || entry.color === 'blue')
        return 'No company acquires this private company.'
    if (!Phases1822.isAtLeast(state.phaseId, entry.acquiredFromPhaseId))
        return `This private company is acquired from phase ${entry.acquiredFromPhaseId}.`
    if (entry.color === 'red' && company.kind !== 'major')
        return 'Only a major company acquires this private company.'
    const train = PrivateTrains1822[entry.id]
    if (train?.definitionId === PullmanTrainId && ownsTrain(state, companyId, [PullmanTrainId]))
        return 'A company owns one Pullman.'
    if (
        (train?.definitionId === PermanentTwoTrainId ||
            train?.definitionId === PermanentLocalTrainId) &&
        ownsTrain(state, companyId, [PermanentTwoTrainId, PermanentLocalTrainId])
    )
        return 'A company owns one permanent train.'
    return undefined
}

/**
 * The player whose agreement the acquisition needs: the private's holder, where that is not the
 * company's own director (§3.1.2).
 */
export function privateAgreementPlayerId1822(
    state: HydratedState1822,
    companyId: string,
    privateCompanyId: string
): string | undefined {
    const director = presidentOf(state, companyId)
    const owner = privateOwner(state, privateCompanyId)
    return owner?.kind === 'player' &&
        !(director?.kind === 'player' && director.playerId === owner.playerId)
        ? owner.playerId
        : undefined
}

/** The private companies the player may have the operating company acquire now. */
export function acquirablePrivates1822(state: HydratedState1822, playerId: string): Private1822[] {
    const companyId = acquiringCompany(state, playerId)
    if (!companyId) return []
    return state.companies.flatMap((company) => {
        const entry = company.kind === 'private' ? private1822(company.id) : undefined
        return entry && !privateAcquisitionReason1822(state, companyId, entry) ? [entry] : []
    })
}

const AcquirePrivateAction = titleAction('AcquirePrivate', {
    companyId: Type.String({ minLength: 1 }),
    privateCompanyId: Type.String({ minLength: 1 }),
    choice: Type.Optional(AcquisitionChoice),
    /** The train the company discards where P1's 5-train takes it over its limit (§3.1.19). */
    discardTrainId: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(
        Type.Object(
            {
                playerId: Type.String(),
                closed: Type.Boolean(),
                /** The acquisition waits for the private company's holder to answer (§3.1.2). */
                awaiting: Type.Optional(Type.Literal(true)),
                trainId: Type.Optional(Type.String()),
                discardedDefinitionId: Type.Optional(Type.String()),
                received: Type.Optional(Type.Integer({ minimum: 0 })),
                stationId: Type.Optional(Type.String()),
                /** What upgrading the English Channel for the token cost the company (§3.1.17). */
                upgradeCost: Type.Optional(Type.Integer({ minimum: 0 }))
            },
            { additionalProperties: false }
        )
    )
})
export const AcquirePrivate = AcquirePrivateAction.schema
export type AcquirePrivate = Type.Static<typeof AcquirePrivate>
export const isAcquirePrivate = AcquirePrivateAction.is
export type PrivateAcquisitionDetails1822 = NonNullable<AcquirePrivate['metadata']>

type Terms = Pick<AcquirePrivate, 'companyId' | 'privateCompanyId' | 'choice' | 'discardTrainId'>

/** The company takes the private company from the player holding it, with what it brings (§3.1.7). */
function takeUpPrivate(state: HydratedState1822, terms: Terms): PrivateAcquisitionDetails1822 {
    const { companyId, privateCompanyId, choice, discardTrainId } = terms
    const company = { kind: 'company' as const, companyId }
    const certificate = state.certificates.find(
        (entry) => entry.id === charterCertificateId(privateCompanyId)
    )
    const previous = privateOwner(state, privateCompanyId)
    assertExists(certificate, 'A private company has its certificate')
    assert(previous?.kind === 'player', 'A player holds the private company')
    certificate.owner = company
    const result: PrivateAcquisitionDetails1822 = { playerId: previous.playerId, closed: false }
    const train = PrivateTrains1822[privateCompanyId]
    if (train) {
        if (discardTrainId) {
            const discarded = state.trainInventory.trains.find(
                (entry) => entry.id === discardTrainId
            )
            result.discardedDefinitionId = discarded?.definitionId
            releaseTrains(state.trainInventory, [discardTrainId], 'market')
        }
        state.trainInventory.trains.push({ ...train, status: 'owned', owner: company })
        result.trainId = train.id
        // P1 is then an ordinary 5-train and nothing more (§5.5.5).
        if (TrainRules1822.countsForLimit?.(state, { ...train, status: 'market' }) !== false)
            result.closed = true
    }
    if (PhaseCreditPrivateIds.includes(privateCompanyId)) {
        const charter = { kind: 'company' as const, companyId: privateCompanyId }
        const received = finiteCashOwnedBy(state, charter)
        if (received) settleCashPayments(state, [{ from: charter, to: company, amount: received }])
        result.received = received
        result.closed = true
    }
    if (privateCompanyId === HillDiscountPrivateId) {
        if (choice === 'discount') state.hillDiscountCompanyId = companyId
        else {
            addDiscountTokens(state, companyId, 'terrain', 1)
            result.closed = true
        }
    }
    if (privateCompanyId === RiverDiscountPrivateId)
        addDiscountTokens(state, companyId, 'estuary', EstuaryTokenCount)
    if (privateCompanyId === EnglishChannelPrivateId) {
        if (choice === 'upgrade') {
            const upgrade = channelUpgrade(state, companyId)
            assertExists(upgrade, 'The English Channel can be upgraded for a station space')
            applyTrackLay(state, TrackRules1822, upgrade, company, true)
            result.upgradeCost = upgrade.cost
        }
        if (choice === 'channel' || choice === 'upgrade') {
            const slot = channelSlot(state)
            assertExists(slot, 'The English Channel has a free station space')
            result.stationId = placeExchangeToken1822(state, companyId, {
                locationId: EnglishChannelLocationId,
                nodeId: CityNodeId,
                slot
            })
        } else if (choice === 'available') releaseExchangeToken1822(state, companyId)
        result.closed = true
    }
    if (result.closed) closePrivate(state, privateCompanyId)
    return result
}

/**
 * As its turn begins a company takes a private company from a player, for nothing, and with it
 * the private's train, tokens, money or power; a player who is not its director is asked first
 * (§3.1.2, §3.1.7, §5.7).
 */
export class HydratedAcquirePrivate extends AcquirePrivateAction.Base {
    declare playerId: string
    declare companyId: AcquirePrivate['companyId']
    declare privateCompanyId: AcquirePrivate['privateCompanyId']
    declare choice?: AcquirePrivate['choice']
    declare discardTrainId?: AcquirePrivate['discardTrainId']
    declare metadata?: AcquirePrivate['metadata']
    /** Whether P1's train would take the company over its limit, so that it names a discard. */
    private needsDiscard(state: HydratedState1822): boolean {
        const train = PrivateTrains1822[this.privateCompanyId]
        return (
            !!train &&
            TrainRules1822.countsForLimit?.(state, {
                id: train.id,
                definitionId: train.definitionId,
                status: 'market'
            }) !== false &&
            trainsCountingForLimit(state, TrainRules1822, this.companyId).length >=
                TrainRules1822.trainLimit(state, this.companyId)
        )
    }
    isValid(state: HydratedState1822): boolean {
        if (this.source !== ActionSource.User) return false
        if (acquiringCompany(state, this.playerId) !== this.companyId) return false
        const entry = private1822(this.privateCompanyId)
        if (!entry || privateAcquisitionReason1822(state, this.companyId, entry)) return false
        const choices = acquisitionChoices1822(state, this.companyId, entry.id)
        if (choices.length ? !this.choice || !choices.includes(this.choice) : !!this.choice)
            return false
        const discarded = trainsCountingForLimit(state, TrainRules1822, this.companyId).some(
            (train) => train.id === this.discardTrainId
        )
        return this.needsDiscard(state) ? discarded : !this.discardTrainId
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'This private company cannot be acquired now')
        const { companyId, privateCompanyId, choice, discardTrainId } = this
        const agreementPlayerId = privateAgreementPlayerId1822(state, companyId, privateCompanyId)
        if (!agreementPlayerId) {
            this.metadata = takeUpPrivate(state, this)
            return
        }
        state.privateOffer = {
            companyId,
            privateCompanyId,
            playerId: agreementPlayerId,
            ...(choice ? { choice } : {}),
            ...(discardTrainId ? { discardTrainId } : {})
        }
        state.activePlayerIds = [agreementPlayerId]
        this.metadata = { playerId: agreementPlayerId, closed: false, awaiting: true }
    }
}

const AnswerPrivateOfferAction = titleAction('AnswerPrivateOffer', {
    accept: Type.Boolean(),
    metadata: Type.Optional(
        Type.Object(
            {
                companyId: Type.String(),
                privateCompanyId: Type.String(),
                choice: Type.Optional(AcquirePrivate.properties.choice),
                /** What the company took, where the holder agreed. */
                acquired: Type.Optional(AcquirePrivate.properties.metadata)
            },
            { additionalProperties: false }
        )
    )
})
export const AnswerPrivateOffer = AnswerPrivateOfferAction.schema
export type AnswerPrivateOffer = Type.Static<typeof AnswerPrivateOffer>
export const isAnswerPrivateOffer = AnswerPrivateOfferAction.is

/** The holder of a private company lets another director's company have it, or declines (§3.1.2). */
export class HydratedAnswerPrivateOffer extends AnswerPrivateOfferAction.Base {
    declare playerId: string
    declare accept: AnswerPrivateOffer['accept']
    declare metadata?: AnswerPrivateOffer['metadata']
    isValid(state: HydratedState1822): boolean {
        return this.source === ActionSource.User && state.privateOffer?.playerId === this.playerId
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'No offer awaits this player')
        const offer = state.privateOffer
        assertExists(offer, 'An answer needs an offer')
        const { companyId, privateCompanyId, choice } = offer
        const director = presidentOf(state, companyId)
        assert(director?.kind === 'player', 'An operating company has a director')
        const terms = { companyId, privateCompanyId, ...(choice ? { choice } : {}) }
        if (this.accept) this.metadata = { ...terms, acquired: takeUpPrivate(state, offer) }
        else {
            this.metadata = terms
            markTurn(state, declinedMark(privateCompanyId))
        }
        delete state.privateOffer
        state.activePlayerIds = [director.playerId]
    }
}

/** While a company's request for a private company awaits its holder, only their answer is taken (§3.1.2). */
export function awaitsPrivateAnswer(handler: StateHandler1822): StateHandler1822 {
    return awaitsAnswer(handler, {
        type: AnswerPrivateOfferAction.type,
        is: (action): action is HydratedAnswerPrivateOffer =>
            action instanceof HydratedAnswerPrivateOffer,
        isValid: (action, state) => action.isValid(state),
        offeredTo: (state) => state.privateOffer?.playerId
    })
}

/** Gives a company discount tokens of a kind, added to any it already holds. */
export function addDiscountTokens(
    state: HydratedState1822,
    companyId: string,
    kind: HydratedState1822['discountTokens'][number]['kind'],
    count: number
): void {
    const held =
        state.discountTokens.find((entry) => entry.companyId === companyId && entry.kind === kind)
            ?.count ?? 0
    state.discountTokens = [
        ...state.discountTokens.filter(
            (entry) => !(entry.companyId === companyId && entry.kind === kind)
        ),
        ...(held + count > 0 ? [{ companyId, kind, count: held + count }] : [])
    ]
}

export const AcquirePrivateStep: StepAction<HydratedState1822> = stepAction(
    AcquirePrivateAction.type,
    (action: HydratedAction): action is HydratedAcquirePrivate =>
        action instanceof HydratedAcquirePrivate,
    (state, playerId) => acquirablePrivates1822(state, playerId).length > 0
)

export const PrivateAcquisitionActions = [
    AcquirePrivateAction.define((action) => new HydratedAcquirePrivate(action)),
    AnswerPrivateOfferAction.define((action) => new HydratedAnswerPrivateOffer(action))
]
