import {
    bidBoxesOf,
    closePrivate,
    getCompany,
    preparePhaseChange,
    settleCashPayments,
    startCompanyAtPar,
    type BidBoxAward,
    type BidBoxes,
    type BidBoxSettlement,
    type BidBoxState
} from '@tabletop/18xx'
import { assertExists, shuffle, type Prng } from '@tabletop/common'
import * as Type from 'typebox'
import {
    ConcessionIds1822,
    FirstConcessionId,
    MetropolitanId,
    MinorIds1822,
    concessionId,
    minor1822,
    minorDirectorCertificateId
} from './companies.js'
import { chargeLoanInterest1822 } from './loans.js'
import type { Variants1822 } from './definition/gameConfig.js'
import {
    EnglishChannelPrivateId,
    FirstPrivateId,
    PrivateStacks1822,
    Privates1822,
    type Private1822,
    type PrivateStack1822
} from './privates.js'
import { setupOf1822, type Setup1822 } from './scenarios.js'
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

/** The 1822+ private bidding box each kind of private company is sold from (§2.1.7). */
const PrivateStackBoxes: Readonly<Record<PrivateStack1822, number>> = {
    trains: 1,
    track: 2,
    other: 3
}

/** The stack that fills one private bidding box alone, named for its box (§2.1.7). */
export function privateBoxStackId1822(stack: PrivateStack1822): string {
    return bidBoxId1822('private', PrivateStackBoxes[stack])
}

/** What 1822+ takes out at random: one track private, never P5, and two of the rest (§2.1.7). */
const PlusRemovals: readonly { stack: PrivateStack1822; count: number; kept: readonly string[] }[] =
    [
        { stack: 'track', count: 1, kept: [EnglishChannelPrivateId] },
        { stack: 'other', count: 2, kept: [] }
    ]

/** Shuffles a stack, its fixed certificate on top where it has one (§2.1.4–§2.1.6). */
function dealStack(prng: Prng, lotIds: readonly string[], first?: string): string[] {
    const rest = lotIds.filter((id) => id !== first)
    shuffle(rest, prng.random)
    return first && lotIds.includes(first) ? [first, ...rest] : rest
}

/** The minor companies in play: thirty with 1822+, the first twenty-four without (§3.3.1). */
export function minorIdsInPlay1822(variants: Variants1822): string[] {
    return MinorIds1822.filter((id) => variants.plus || !minor1822(id)?.expansion)
}

/** The private companies of the set played with: twenty-one with 1822+, eighteen without (§3.1.1). */
export function privateSet1822(variants: Variants1822): Private1822[] {
    return Privates1822.filter((entry) => variants.plus || !entry.expansion)
}

/** So many of the candidates, chosen at random. */
function drawnAtRandom(prng: Prng, candidates: readonly string[], count: number): string[] {
    return dealStack(prng, candidates).slice(0, count)
}

/**
 * The companies of the original game a setup plays without (§6.2.1; scenario pack, General
 * sheet): the regional scenarios name theirs; the full-map scenarios remove theirs at random,
 * keeping P1 and the Metropolitan Railway and taking at most one major company from each of the
 * groups the scenario names.
 */
function removals(
    prng: Prng,
    setup: Setup1822
): { privateIds: string[]; minorIds: string[]; majorIds: string[] } {
    const privates = privateSet1822({}).map((entry) => entry.id)
    const { majors } = setup
    const groupOf = (majorId: string) =>
        'groups' in majors ? majors.groups.findIndex((group) => group.includes(majorId)) : -1
    const majorIds =
        'groups' in majors
            ? dealStack(prng, majors.groups.flat())
                  .filter(
                      (id, index, order) =>
                          !order.slice(0, index).some((earlier) => groupOf(earlier) === groupOf(id))
                  )
                  .slice(0, majors.count)
            : [...majors.removedIds]
    return {
        privateIds:
            'through' in setup.privates
                ? privates.slice(setup.privates.through)
                : drawnAtRandom(
                      prng,
                      privates.filter((id) => id !== FirstPrivateId),
                      setup.privates.removed
                  ),
        minorIds:
            'removedIds' in setup.minors
                ? [...setup.minors.removedIds]
                : drawnAtRandom(
                      prng,
                      minorIdsInPlay1822({}).filter((id) => id !== MetropolitanId),
                      setup.minors.removed
                  ),
        majorIds
    }
}

/**
 * The stacks the bidding boxes fill from, each shuffled under its fixed first certificate
 * (§2.1.4–§2.1.6). 1822+ first removes three private companies at random and gives each private
 * box its own stack, unless the players chose otherwise (§2.1.7, §6.1.3). A scenario first
 * removes its companies, and may name another minor company for the first box (§6.2.1).
 */
export function dealLots1822(
    prng: Prng,
    variants: Variants1822
): {
    stacks: { id: string; lotIds: string[] }[]
    removedPrivateIds: string[]
    removedCompanyIds: string[]
} {
    const setup = setupOf1822({ variants })
    // The standard game removes nothing, and so draws nothing here.
    const removed = removals(prng, setup)
    const minors = dealStack(
        prng,
        minorIdsInPlay1822(variants).filter((id) => !removed.minorIds.includes(id)),
        setup.firstMinorId
    )
    const concessions = dealStack(
        prng,
        ConcessionIds1822.filter(
            (id) => !removed.majorIds.some((majorId) => concessionId(majorId) === id)
        ),
        FirstConcessionId
    )
    const privates = privateSet1822(variants)
    const removedPrivateIds =
        variants.plus && !variants.allPrivates
            ? PlusRemovals.flatMap(({ stack, count, kept }) =>
                  drawnAtRandom(
                      prng,
                      privates
                          .filter((entry) => entry.stack === stack && !kept.includes(entry.id))
                          .map((entry) => entry.id),
                      count
                  )
              )
            : removed.privateIds
    const dealt = privates.filter((entry) => !removedPrivateIds.includes(entry.id))
    const ids = (entries: readonly Private1822[]) => entries.map((entry) => entry.id)
    const privateStacks =
        variants.plus && !variants.mixedPrivates
            ? PrivateStacks1822.map((stack) => ({
                  id: privateBoxStackId1822(stack),
                  lotIds: dealStack(
                      prng,
                      ids(dealt.filter((entry) => entry.stack === stack)),
                      FirstPrivateId
                  )
              }))
            : [{ id: 'private', lotIds: dealStack(prng, ids(dealt), FirstPrivateId) }]
    return {
        stacks: [
            { id: 'minor', lotIds: minors },
            { id: 'concession', lotIds: concessions },
            ...privateStacks
        ],
        removedPrivateIds,
        removedCompanyIds: [...removed.majorIds, ...removed.minorIds]
    }
}

type Stacks = Pick<BidBoxes, 'stacks'>

/** The one stack every box of a kind fills from, where the kind has one (§4.5.2). */
export function sharedStack1822(
    bidBoxes: Stacks,
    kind: LotKind1822
): Stacks['stacks'][number] | undefined {
    return bidBoxes.stacks.find((stack) => stack.id === kind)
}

/** The stack that fills one box alone, where its kind has no shared stack (§2.1.7). */
export function boxStack1822(bidBoxes: Stacks, boxId: string): Stacks['stacks'][number] {
    const stack = bidBoxes.stacks.find((entry) => entry.id === boxId)
    assertExists(stack, `Box ${boxId} has its stack`)
    return stack
}

/**
 * Fills the empty bidding boxes from the top of their stacks. Certificates of a kind sold from
 * one stack first move down to its lowest-numbered boxes (§4.1.1, §4.5.2); a box with its own
 * stack keeps its place and fills from that stack alone (§2.1.7).
 */
export function refillBidBoxes1822(state: BidBoxState): void {
    const bidBoxes = bidBoxesOf(state)
    bidBoxes.boxes = LotKinds1822.flatMap((kind) => {
        const present = bidBoxes.boxes.filter((box) => boxKind(box.boxId) === kind)
        const boxIds = BidBoxIds1822.filter((boxId) => boxKind(boxId) === kind)
        const shared = sharedStack1822(bidBoxes, kind)
        if (shared) {
            const drawn = shared.lotIds.splice(0, Math.max(0, boxIds.length - present.length))
            return [...present.map((box) => box.lotId), ...drawn].map((lotId, index) => ({
                boxId: boxIds[index],
                lotId
            }))
        }
        return boxIds.flatMap((boxId) => {
            const box = present.find((entry) => entry.boxId === boxId)
            if (box) return [box]
            const lotId = boxStack1822(bidBoxes, boxId).lotIds.shift()
            return lotId ? [{ boxId, lotId }] : []
        })
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
