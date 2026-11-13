import {
    RailwayMapState,
    actsFor,
    closePrivate,
    finiteCashOwnedBy,
    getCompany,
    nextOperatingCompany,
    privateOwner,
    releaseTrains,
    settleCashPayments,
    stepAction,
    titleAction,
    trainsCountingForLimit,
    trainsOwnedBy,
    type StepAction
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
import type { HydratedState1822 } from './state.js'
import { TileSet1822 } from './tiles.js'
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

/** How a private company with a choice is taken up as it is acquired (Table 3: P5, P8). */
export const AcquisitionChoices1822 = ['token', 'discount', 'channel', 'available'] as const
export type AcquisitionChoice1822 = (typeof AcquisitionChoices1822)[number]

/** The company in its turn before any track is laid, when it acquires private companies (§5.3.1, §5.7). */
function acquiringCompany(state: HydratedState1822, playerId: string): string | undefined {
    const companyId = state.trackStep?.companyId
    return state.machineState === 'LayingTrack' &&
        companyId &&
        nextOperatingCompany(state) === companyId &&
        actsFor(state, playerId, companyId) &&
        !state.trackStep?.lays.length &&
        !state.trackStep?.extraLays?.length &&
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
    return [
        ...(channelSlot(state) !== undefined && !ownStation ? ['channel' as const] : []),
        'available'
    ]
}

function ownsTrain(state: HydratedState1822, companyId: string, definitionIds: readonly string[]) {
    return trainsOwnedBy(state, { kind: 'company', companyId }).some((train) =>
        definitionIds.includes(train.definitionId)
    )
}

/**
 * Why the company may not acquire the private from its director now, if it may not (§3.1.2–§3.1.5,
 * §5.5.13, §5.5.14).
 */
export function privateAcquisitionReason1822(
    state: HydratedState1822,
    companyId: string,
    entry: Private1822
): string | undefined {
    const company = getCompany(state, companyId)
    const director = company.president
    const owner = privateOwner(state, entry.id)
    if (getCompany(state, entry.id).closed || owner?.kind !== 'player')
        return 'A player does not hold this private company.'
    if (director?.kind !== 'player' || director.playerId !== owner.playerId)
        return 'A company acquires its own director’s private companies.'
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
    choice: Type.Optional(
        Type.Union([
            Type.Literal('token'),
            Type.Literal('discount'),
            Type.Literal('channel'),
            Type.Literal('available')
        ])
    ),
    /** The train the company discards where P1's 5-train takes it over its limit (§3.1.19). */
    discardTrainId: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(
        Type.Object(
            {
                playerId: Type.String(),
                closed: Type.Boolean(),
                trainId: Type.Optional(Type.String()),
                discardedDefinitionId: Type.Optional(Type.String()),
                received: Type.Optional(Type.Integer({ minimum: 0 })),
                stationId: Type.Optional(Type.String())
            },
            { additionalProperties: false }
        )
    )
})
export const AcquirePrivate = AcquirePrivateAction.schema
export type AcquirePrivate = Type.Static<typeof AcquirePrivate>
export const isAcquirePrivate = AcquirePrivateAction.is

/**
 * As its turn begins a company takes a private company from its director, for nothing, and with
 * it the private's train, tokens, money or power (§3.1.2, §3.1.7, §5.7).
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
        const company = { kind: 'company' as const, companyId: this.companyId }
        const certificate = state.certificates.find(
            (entry) => entry.id === charterCertificateId(this.privateCompanyId)
        )
        const previous = privateOwner(state, this.privateCompanyId)
        assertExists(certificate, 'A private company has its certificate')
        assert(previous?.kind === 'player', 'A player holds the private company')
        certificate.owner = company
        const result: NonNullable<AcquirePrivate['metadata']> = {
            playerId: previous.playerId,
            closed: false
        }
        const train = PrivateTrains1822[this.privateCompanyId]
        if (train) {
            if (this.discardTrainId) {
                const discarded = state.trainInventory.trains.find(
                    (entry) => entry.id === this.discardTrainId
                )
                result.discardedDefinitionId = discarded?.definitionId
                releaseTrains(state.trainInventory, [this.discardTrainId], 'market')
            }
            state.trainInventory.trains.push({ ...train, status: 'owned', owner: company })
            result.trainId = train.id
            // P1 is then an ordinary 5-train and nothing more (§5.5.5).
            if (TrainRules1822.countsForLimit?.(state, { ...train, status: 'market' }) !== false)
                result.closed = true
        }
        if (PhaseCreditPrivateIds.includes(this.privateCompanyId)) {
            const charter = { kind: 'company' as const, companyId: this.privateCompanyId }
            const received = finiteCashOwnedBy(state, charter)
            if (received)
                settleCashPayments(state, [{ from: charter, to: company, amount: received }])
            result.received = received
            result.closed = true
        }
        if (this.privateCompanyId === HillDiscountPrivateId) {
            if (this.choice === 'discount') state.hillDiscountCompanyId = this.companyId
            else {
                addDiscountTokens(state, this.companyId, 'terrain', 1)
                result.closed = true
            }
        }
        if (this.privateCompanyId === RiverDiscountPrivateId)
            addDiscountTokens(state, this.companyId, 'estuary', EstuaryTokenCount)
        if (this.privateCompanyId === EnglishChannelPrivateId) {
            if (this.choice === 'channel') {
                const slot = channelSlot(state)
                assertExists(slot, 'The English Channel has a free station space')
                result.stationId = placeExchangeToken1822(state, this.companyId, {
                    locationId: EnglishChannelLocationId,
                    nodeId: CityNodeId,
                    slot
                })
            } else if (this.choice === 'available') releaseExchangeToken1822(state, this.companyId)
            result.closed = true
        }
        if (result.closed) closePrivate(state, this.privateCompanyId)
        this.metadata = result
    }
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

export const AcquirePrivateDefinition = AcquirePrivateAction.define(
    (action) => new HydratedAcquirePrivate(action)
)
