import { EighteenNinetyFourCharters } from './charters.js'
import {
    awardCertificates,
    beginOpening,
    createCompanyStations,
    createOrdinaryShareCertificates,
    privateIncomePayments,
    requirePar,
    startingCashByPlayerCount,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import { assert, shuffle } from '@tabletop/common'
import { BelgeCompanyId, EighteenNinetyFourMajors, FrenchCompanyIds } from './majors.js'
import { EighteenNinetyFourMap } from './map.js'
import {
    EighteenNinetyFourPrivateCatalog,
    EighteenNinetyFourPrivates,
    MajorShareholdings,
    NordMinorShareholdingId,
    StationPrivateIds
} from './privates.js'
import type { EighteenNinetyFourState, HydratedEighteenNinetyFourState } from './state.js'
import { EighteenNinetyFourStationCounts } from './stationRules.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import { EighteenNinetyFourTrainDepot } from './trains.js'

export const EighteenNinetyFourStartingCash: Readonly<Record<number, number>> = { 3: 570, 4: 480 }
export const eighteenNinetyFourStartingCash = startingCashByPlayerCount(
    EighteenNinetyFourStartingCash
)

/** The Nord share that comes with the Nord minor shareholding (§3, §11.2.2.7). */
export const NordMinorShareId = 'Nord:share:8'

export const EighteenNinetyFourAuctionRules: WaterfallAuctionRules = {
    lots: (state) => EighteenNinetyFourPrivateCatalog.lots(state),
    increment: 5,
    bidMultiple: 5,
    bidOrder: 'lowest-bid-first',
    // Ligne de Reims costs F5 less after every round of passes while it is unsold, and the
    // privates bought so far pay their income (§5.1).
    allPass: 'discount-and-income',
    award(state, award) {
        const companyId = MajorShareholdings[award.lotId]
        awardCertificates(state, award, [
            `${award.lotId}:charter`,
            ...(companyId ? [`${companyId}:president`] : []),
            ...(award.lotId === NordMinorShareholdingId ? [NordMinorShareId] : [])
        ])
        if (companyId) requirePar(state, companyId, award.playerId)
    },
    incomePayments(state) {
        // Players own every private and the map is unbuilt, so each pays its printed revenue:
        // Saint-Quentin à Guise nothing yet.
        return privateIncomePayments(state, { charters: EighteenNinetyFourCharters })
    }
}

/**
 * The setup draws (§3): the French company that starts the game floated and keeps its major
 * shareholding, the station private removed from the game, and the player number cards.
 */
export type OpeningDraws = {
    frenchCompanyId: string
    removedPrivateId: string
    playerOrder: readonly string[]
}

export function drawOpening({ players, prng, startingPositions }: OpeningSetup): OpeningDraws {
    const french = [...FrenchCompanyIds]
    shuffle(french, prng.random)
    const stationPrivates = [...StationPrivateIds]
    shuffle(stationPrivates, prng.random)
    const order = players.map((player) => player.playerId)
    shuffle(order, prng.random)
    return {
        frenchCompanyId: french[0],
        removedPrivateId: stationPrivates[0],
        // Seats replace the dealt number cards; the cards are dealt either way so the rest of
        // the seeded setup is unchanged.
        playerOrder: startingPositions ? [...startingPositions.playerIds] : order
    }
}

export function createEighteenNinetyFourOpening(
    setup: OpeningSetup
): Opening<typeof EighteenNinetyFourState, HydratedEighteenNinetyFourState> {
    const { players } = setup
    assert(players.length === 3 || players.length === 4, '1894 supports three or four players')
    const draws = drawOpening(setup)
    const majors = Object.values(EighteenNinetyFourMajors)
    const capital = EighteenNinetyFourStartingCash[players.length]
    const ipo = { owner: { kind: 'bank' } as const, poolId: 'initial-offering' }
    const market = { owner: { kind: 'bank' } as const, poolId: 'open-market' }
    // Each player is dealt a share of the drawn French company and of the Belge; with three
    // players the bank pool takes one of each too (§3).
    const dealt = [
        ...players.map((player) => ({
            owner: { kind: 'player' as const, playerId: player.playerId }
        })),
        ...(players.length === 3 ? [market] : [])
    ]
    const shareAllocations = (companyId: string) =>
        companyId === draws.frenchCompanyId || companyId === BelgeCompanyId
            ? [...dealt, ...Array.from({ length: 8 - dealt.length }, () => ipo)]
            : Array.from({ length: 8 }, () => ipo)
    const privates = EighteenNinetyFourPrivates.filter(
        (company) =>
            company.id !== draws.removedPrivateId &&
            (!(company.id in MajorShareholdings) ||
                [draws.frenchCompanyId, BelgeCompanyId].includes(MajorShareholdings[company.id]))
    )
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...majors.map((company) => ({
                id: company.id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...privates.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: 'unlimited' },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...majors.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: 'initial-offering', owner: { kind: 'bank' } },
            { id: 'open-market', owner: { kind: 'bank' } }
        ],
        certificates: [
            ...majors.flatMap((company) =>
                createOrdinaryShareCertificates(company.id, shareAllocations(company.id), ipo)
            ),
            ...privates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: majors.flatMap((company) =>
            createCompanyStations(company.id, EighteenNinetyFourStationCounts[company.id])
        ),
        stationReservations: EighteenNinetyFourMap.stationReservations(),
        tileInventory: EighteenNinetyFourTileSet.createInventory(),
        trainInventory: EighteenNinetyFourTrainDepot.createInventory(),
        phaseId: 'yellow'
    }
    return {
        position,
        begin(state) {
            const [firstPlayerId] = draws.playerOrder
            state.turnManager.turnOrder = [...draws.playerOrder]
            state.openingAuction = {
                remainingLotIds: EighteenNinetyFourAuctionRules.lots(state).map((lot) => lot.id),
                reservations: [],
                nextPlayerId: firstPlayerId,
                passedPlayerIds: [],
                discount: 0,
                awards: [],
                completed: false
            }
            beginOpening(state, 'WaterfallAuction', firstPlayerId)
        }
    }
}
