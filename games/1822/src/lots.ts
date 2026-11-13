import {
    bidBoxesOf,
    closePrivate,
    getCompany,
    preparePhaseChange,
    settleCashPayments,
    startCompanyAtPar,
    type BidBoxAward,
    type BidBoxSettlement,
    type BidBoxState
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import {
    ConcessionIds1822,
    FirstConcessionId,
    FirstMinorId,
    MinorIds1822,
    minor1822,
    minorDirectorCertificateId
} from './companies.js'
import { chargeLoanInterest1822 } from './loans.js'
import { FirstPrivateId, Privates1822 } from './privates.js'
import { BiddingBoxes1822, FaceValues1822 } from './setup.js'
import { requireState1822 } from './state.js'
import { Market1822, MinorOnlyParSpaceId1822, minorParSpaceId1822 } from './stockMarket.js'
import { LocalTrainId, Phases1822, TrainDepot1822 } from './trains.js'

export const LotKinds1822 = ['minor', 'concession', 'private'] as const
export type LotKind1822 = (typeof LotKinds1822)[number]

/** What kind of certificate a lot is, from its company. */
export function lotKind1822(lotId: string): LotKind1822 {
    if (MinorIds1822.includes(lotId)) return 'minor'
    return ConcessionIds1822.includes(lotId) ? 'concession' : 'private'
}

export function bidBoxId1822(kind: LotKind1822, number: number): string {
    return `${kind}:${number}`
}

/** Every bidding box, in the order the board prints them (§4.5.1). */
export const BidBoxIds1822: readonly string[] = LotKinds1822.flatMap((kind) =>
    Array.from({ length: BiddingBoxes1822[kind] }, (_, index) => bidBoxId1822(kind, index + 1))
)

function boxKind(boxId: string): LotKind1822 {
    const kind = LotKinds1822.find((entry) => boxId.startsWith(`${entry}:`))
    assertExists(kind, 'A bidding box belongs to a kind of lot')
    return kind
}

/** The certificate a private company or concession is owned through. */
export function charterCertificateId(companyId: string): string {
    return `${companyId}:charter`
}

/** The lots of the base game, each stack's fixed first certificate named (§2.1.4–§2.1.6). */
export const LotStacks1822: Readonly<Record<LotKind1822, { first: string; lotIds: string[] }>> = {
    minor: {
        first: FirstMinorId,
        lotIds: MinorIds1822.filter((id) => !minor1822(id)?.expansion)
    },
    concession: { first: FirstConcessionId, lotIds: [...ConcessionIds1822] },
    private: {
        first: FirstPrivateId,
        lotIds: Privates1822.filter((entry) => !entry.expansion).map((entry) => entry.id)
    }
}

/**
 * Moves the certificates of each kind down to its lowest-numbered boxes and fills the empty ones
 * from the top of its stack (§4.1.1, §4.5.2).
 */
export function refillBidBoxes1822(state: BidBoxState): void {
    const bidBoxes = bidBoxesOf(state)
    bidBoxes.boxes = LotKinds1822.flatMap((kind) => {
        const present = bidBoxes.boxes
            .filter((box) => boxKind(box.boxId) === kind)
            .map((box) => box.lotId)
        const stack = bidBoxes.stacks.find((entry) => entry.id === kind)
        assertExists(stack, 'Each kind of lot has its stack')
        const drawn = stack.lotIds.splice(0, Math.max(0, BiddingBoxes1822[kind] - present.length))
        return [...present, ...drawn].map((lotId, index) => ({
            boxId: bidBoxId1822(kind, index + 1),
            lotId
        }))
    })
}

const TrainRemoval = Type.Object(
    { trainId: Type.String(), definitionId: Type.String() },
    { additionalProperties: false }
)

export const BidBoxSettlement1822 = Type.Object(
    {
        /** The minor companies bought, with the value and treasury each starts with (§3.3.5). */
        minors: Type.Array(
            Type.Object(
                {
                    companyId: Type.String(),
                    playerId: Type.String(),
                    marketSpaceId: Type.String(),
                    parPrice: Type.Integer({ minimum: 1 }),
                    treasury: Type.Integer({ minimum: 0 })
                },
                { additionalProperties: false }
            )
        ),
        /** An L/2 train removed for each minor company no one bid on (§4.10.3). */
        removedTrains: Type.Array(TrainRemoval),
        /** The minor company removed from box 1 with no bid, and the train that went with it (§4.10.3). */
        removedMinor: Type.Optional(
            Type.Object(
                { companyId: Type.String(), train: Type.Optional(TrainRemoval) },
                { additionalProperties: false }
            )
        ),
        /** The phase the train removed with that minor began, if it began one (§4.10.3). */
        toPhaseId: Type.Optional(Type.String()),
        /** Interest added to each outstanding loan (§4.10.6). */
        loanInterest: Type.Array(
            Type.Object(
                { playerId: Type.String(), interest: Type.Integer({ minimum: 1 }) },
                { additionalProperties: false }
            )
        ),
        /** The first stock round ended with nothing sold (§1.3.1). */
        nothingSold: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type BidBoxSettlement1822 = Type.Static<typeof BidBoxSettlement1822>

/**
 * A minor company starts at £50 in phase 1 whatever was bid, and from phase 2 at half the bid
 * rounded down to a starting value. Its treasury is £100 in phase 1, twice its value in phase 2
 * and the sum bid from phase 3 (§3.3.5).
 */
export function minorStart1822(
    phaseId: string,
    bid: number
): { marketSpaceId: string; treasury: number } {
    if (!Phases1822.isAtLeast(phaseId, '2'))
        return { marketSpaceId: MinorOnlyParSpaceId1822, treasury: FaceValues1822.minor }
    const marketSpaceId = minorParSpaceId1822(bid)
    return {
        marketSpaceId,
        treasury: Phases1822.isAtLeast(phaseId, '3')
            ? bid
            : Market1822.space(marketSpaceId).price * 2
    }
}

function awardMinor(
    state: BidBoxState,
    award: BidBoxAward
): BidBoxSettlement1822['minors'][number] {
    const title = requireState1822(state)
    const { marketSpaceId, treasury } = minorStart1822(title.phaseId, award.amount)
    const director = { kind: 'player' as const, playerId: award.playerId }
    startCompanyAtPar(title, Market1822, award.lotId, marketSpaceId, director)
    const company = getCompany(state, award.lotId)
    company.floated = true
    company.funded = true
    const certificate = state.certificates.find(
        (entry) => entry.id === minorDirectorCertificateId(award.lotId)
    )
    assertExists(certificate, 'A minor company has its director’s certificate')
    certificate.owner = director
    delete certificate.poolId
    settleCashPayments(state, [
        {
            from: { kind: 'bank' },
            to: { kind: 'company', companyId: award.lotId },
            amount: treasury
        }
    ])
    return {
        companyId: award.lotId,
        playerId: award.playerId,
        marketSpaceId,
        parPrice: Market1822.space(marketSpaceId).price,
        treasury
    }
}

function awardCharter(state: BidBoxState, award: BidBoxAward): void {
    const certificate = state.certificates.find(
        (entry) => entry.id === charterCertificateId(award.lotId)
    )
    assertExists(certificate, 'A private company or concession has its certificate')
    certificate.owner = { kind: 'player', playerId: award.playerId }
    delete certificate.poolId
}

/**
 * Takes a minor company no player bought out of play, freeing its reserved station space
 * (§4.10.3, §5.19).
 */
export function removeUnsoldMinor1822(state: BidBoxState, companyId: string): void {
    const title = requireState1822(state)
    getCompany(title, companyId).closed = true
    title.certificates = title.certificates.filter((entry) => entry.companyId !== companyId)
    title.certificatePools = title.certificatePools.filter(
        (pool) => !(pool.owner.kind === 'company' && pool.owner.companyId === companyId)
    )
    title.stationReservations = title.stationReservations.filter(
        (reservation) => reservation.companyId !== companyId
    )
    title.stations = title.stations.map((station) =>
        station.companyId === companyId
            ? { id: station.id, companyId, status: 'removed' as const }
            : station
    )
}

function lotsWithoutBid(state: BidBoxState, awards: readonly BidBoxAward[]) {
    return bidBoxesOf(state).boxes.filter(
        (box) => !awards.some((award) => award.lotId === box.lotId)
    )
}

/**
 * The end of a stock round's bidding (§4.10): the items bid on are bought; an L/2 train leaves
 * the bank for each minor company without a bid; a minor company left in box 1 leaves the game
 * with the next train in the bank, which counts as sold; the boxes are refilled; and loans gather
 * interest.
 */
export const BidBoxSettlementRules1822: BidBoxSettlement<typeof BidBoxSettlement1822> = {
    schema: BidBoxSettlement1822,
    settle(state, awards) {
        const title = requireState1822(state)
        const minors = awards
            .filter((award) => lotKind1822(award.lotId) === 'minor')
            .map((award) => awardMinor(state, award))
        for (const award of awards)
            if (lotKind1822(award.lotId) !== 'minor') awardCharter(state, award)
        const unsoldMinors = lotsWithoutBid(state, awards).filter(
            (box) => lotKind1822(box.lotId) === 'minor'
        )
        const removedTrains = unsoldMinors.flatMap(() =>
            TrainDepot1822.remaining(title.trainInventory, LocalTrainId) === 0
                ? []
                : [TrainDepot1822.export(title.trainInventory, LocalTrainId)]
        )
        const first = unsoldMinors.find((box) => box.boxId === bidBoxId1822('minor', 1))
        let removedMinor: BidBoxSettlement1822['removedMinor']
        let toPhaseId: string | undefined
        if (first) {
            removeUnsoldMinor1822(state, first.lotId)
            const definitionId = TrainDepot1822.nextDefinitionId(title.trainInventory)
            const train = definitionId
                ? TrainDepot1822.export(title.trainInventory, definitionId)
                : undefined
            removedMinor = {
                companyId: first.lotId,
                ...(train ? { train: { trainId: train.id, definitionId: train.definitionId } } : {})
            }
            if (train) {
                const next = Phases1822.phaseAfterPurchase(title.phaseId, train.definitionId)
                if (next !== title.phaseId) {
                    toPhaseId = next
                    preparePhaseChange(title, train.id, train.definitionId, next, {
                        machineState: 'StockRound'
                    })
                }
            }
        }
        bidBoxesOf(state).boxes = bidBoxesOf(state).boxes.filter(
            (box) =>
                box.lotId !== first?.lotId && !awards.some((award) => award.lotId === box.lotId)
        )
        refillBidBoxes1822(state)
        const nothingSold = state.stockRound.number === 1 && awards.length === 0
        if (nothingSold) title.nothingSold = true
        return {
            minors,
            removedTrains: removedTrains.map((train) => ({
                trainId: train.id,
                definitionId: train.definitionId
            })),
            ...(removedMinor ? { removedMinor } : {}),
            ...(toPhaseId ? { toPhaseId } : {}),
            loanInterest: chargeLoanInterest1822(state),
            ...(nothingSold ? { nothingSold: true as const } : {})
        }
    }
}

/** A concession no longer in play once phase 5 begins: closed, and gone from the boxes and stack (§3.2.5). */
export function removeConcessions1822(state: BidBoxState): string[] {
    const removed = state.companies
        .filter((company) => ConcessionIds1822.includes(company.id) && !company.closed)
        .map((company) => company.id)
    for (const companyId of removed) closePrivate(state, companyId)
    bidBoxesOf(state).boxes = bidBoxesOf(state).boxes.filter((box) => !removed.includes(box.lotId))
    bidBoxesOf(state).bids = bidBoxesOf(state).bids.filter((bid) => !removed.includes(bid.lotId))
    bidBoxesOf(state).stacks = bidBoxesOf(state).stacks.map((stack) => ({
        ...stack,
        lotIds: stack.lotIds.filter((lotId) => !removed.includes(lotId))
    }))
    return removed
}
