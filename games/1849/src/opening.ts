import {
    awardCertificates,
    beginWaterfallAuction,
    createCompanyStations,
    privateIncomePayments,
    requirePar,
    treasuryPoolId,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import { assert, assertExists, shuffle, type Prng } from '@tabletop/common'
import { GameConfig1849, type Variants1849 } from './definition/gameConfig.js'
import {
    Charters1849,
    CorporationIds1849,
    StationTokenCount1849,
    createCertificates1849
} from './companies.js'
import { Map1849 } from './map.js'
import { PrivateCatalog1849, Privates1849, RealeSocietaPrivateId } from './privates.js'
import { Bank1849, CorporationCountsByPlayers1849, startingCash1849 } from './setup.js'
import { MarketPoolId1849 } from './stock.js'
import { requireState1849, type HydratedState1849, type State1849 } from './state.js'
import { TileSet1849 } from './tiles.js'
import { TrainDepot1849, depotId1849 } from './trains.js'

/** How many corporations a new player should not find the IFT among (§2.2). */
const DelayedIftPosition = 3
const IftId = 'IFT'

// Private companies sell lowest first; a bid tops the value or the last bid by L. 5, and
// several bidders settle by auction from the lowest bid (§8). The Reale Società d'Affari brings
// the president's certificate of the first corporation in order, whose value its buyer sets
// (§8.1).
export const AuctionRules1849: WaterfallAuctionRules = {
    lots: (state) => PrivateCatalog1849.lots(state),
    increment: 5,
    bidOrder: 'lowest-bid-first',
    award(stateObject, award) {
        const state = requireState1849(stateObject)
        awardCertificates(state, award, [`${award.lotId}:charter`])
        if (award.lotId !== RealeSocietaPrivateId) return
        const companyId = state.royalCompanyId
        assertExists(companyId, 'The Reale Società d’Affari names its corporation')
        const president = state.certificates.find(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.president &&
                certificate.companyId === companyId
        )
        assertExists(president, 'The first corporation has its president’s certificate')
        president.owner = { kind: 'player', playerId: award.playerId }
        delete president.poolId
        state.royalFunding = companyId
        requirePar(state, companyId, award.playerId)
    },
    incomePayments(state) {
        return privateIncomePayments(state, { charters: Charters1849 })
    }
}

/**
 * Deals the corporations' order (§2.2): with five, the sixth leaves the game; for new players the
 * IFT may be moved back to fourth.
 */
export function dealCorporations(
    prng: Prng,
    variants: Variants1849,
    corporations: 5 | 6
): { order: string[]; removed?: string } {
    const order = [...CorporationIds1849]
    shuffle(order, prng.random)
    const removed = corporations === 5 ? order.pop() : undefined
    const ift = order.indexOf(IftId)
    if (variants.delayIft && ift >= 0 && ift < DelayedIftPosition) {
        order.splice(ift, 1)
        order.splice(DelayedIftPosition, 0, IftId)
    }
    return { order, ...(removed ? { removed } : {}) }
}

export function corporationsInPlay(playerCount: number, variants: Variants1849): 5 | 6 {
    const counts = CorporationCountsByPlayers1849[playerCount]
    assertExists(counts, '1849 supports three to five players')
    return counts.includes(5) && (counts.length === 1 || variants.fiveCorporations) ? 5 : 6
}

export function createOpening1849({
    players,
    prng,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof State1849, HydratedState1849> {
    assert(players.length >= 3 && players.length <= 5, '1849 supports three to five players')
    const variants = GameConfig1849.variants(config)
    const corporations = corporationsInPlay(players.length, variants)
    const { order, removed } = dealCorporations(prng, variants, corporations)
    const capital = startingCash1849({ playerCount: players.length, config })
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...order.map((id) => ({
                id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...Privates1849.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: Bank1849 - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...order.map((companyId) => ({
                owner: { kind: 'company' as const, companyId },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: MarketPoolId1849, owner: { kind: 'bank' } },
            ...order.map((companyId) => ({
                id: treasuryPoolId(companyId),
                owner: { kind: 'company' as const, companyId }
            }))
        ],
        certificates: [
            ...order.flatMap((companyId) => createCertificates1849(companyId)),
            ...Privates1849.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: order.flatMap((companyId) =>
            createCompanyStations(companyId, StationTokenCount1849)
        ),
        // A removed corporation's home is open to others (§10.4).
        stationReservations: Map1849.stationReservations().filter(
            (reservation) => reservation.companyId !== removed
        ),
        tileInventory: TileSet1849.createInventory(),
        trainInventory: (() => {
            const depotId = depotId1849(corporations, variants.electricDreams === true)
            return TrainDepot1849.createInventory(
                depotId === TrainDepot1849.definition.id ? undefined : depotId
            )
        })(),
        phaseId: '4H'
    }
    return {
        position,
        titleState: {
            variants,
            corporationOrder: order,
            ...(removed ? { removedCorporationId: removed } : {}),
            restarts: [],
            royalCompanyId: order[0],
            floats: [],
            loans: []
        },
        begin: beginWaterfallAuction(AuctionRules1849, startingPositions)
    }
}
