import { assert, assertExists, shuffle, type Prng } from '@tabletop/common'
import {
    awardPrivate,
    beginSelectionAuction,
    createCompanyStations,
    createOrdinaryShareCertificates,
    homeStationId,
    treasuryPool,
    treasuryPoolId,
    NationalCompanyKind,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type SelectionAuctionRules,
    type SelectionAuctionState,
    type Station
} from '@tabletop/18xx'
import {
    BankCash1867,
    CnId,
    CnStationCount,
    MajorIds1867,
    MajorStationCount,
    MinorIds1867,
    startingCash1867
} from './companies.js'
import { GameConfig1867 } from './definition/gameConfig.js'
import { CnHome } from './map.js'
import { MarketPoolId1867 } from './names.js'
import { PrivateCatalog1867, PrivateIds1867, privateTerms1867 } from './privates.js'
import type { HydratedState1867, State1867, Variants1867 } from './state.js'
import { TileSet1867 } from './tiles.js'
import { TrainDepot1867, trainSupply1867 } from './trains.js'

/** When every player passes on a private, its lowest bid falls by $5 (GTG §5). */
const AllPassDiscount = 5

type OpeningState = SelectionAuctionState & Pick<State1867, 'variants'>

// The privates are auctioned in ascending face value (GTG §5.1); after each auction the next turn
// is the winner's left, or the proposer's with the left-of-auctioneer option (GTG §5.2, §14).
export const AuctionRules1867: SelectionAuctionRules = {
    lots: (state) =>
        PrivateCatalog1867.lots(state).filter(
            (lot) => !state.companies.some((company) => company.id === lot.id && company.closed)
        ),
    nominationLotIds(state) {
        assertExists(state.selectionAuction, 'Nominations belong to the selection auction')
        return state.selectionAuction.remainingLotIds.slice(0, 1)
    },
    passingWhileNominating: () => true,
    openingBid: (_state, lotId) => privateTerms1867(lotId).minimumBid,
    increment: 5,
    award: awardPrivate,
    nominationFollowsWinner: (state: OpeningState) => !state.variants.proposerOrder,
    closeUnsold() {
        assert(false, 'Every 1867 private is sold')
    },
    allPassDiscount: AllPassDiscount
}

const bank = { kind: 'bank' } as const
const companyIds = [...MinorIds1867, ...MajorIds1867]

/** The CN's stations, the first in Toronto from setup (GTG §2.H). */
function cnStations(): Station[] {
    return createCompanyStations(CnId, CnStationCount).map((station) =>
        station.id === homeStationId(CnId)
            ? {
                  id: station.id,
                  companyId: CnId,
                  status: 'placed',
                  position: { ...CnHome, slot: 0 }
              }
            : station
    )
}

function createPosition(
    playerCash: readonly { playerId: string; amount: number }[],
    trainSupply: string | undefined,
    removedPrivateIds: readonly string[]
): InitialPosition {
    const unstarted = { started: false, floated: false, funded: false, operated: false }
    return {
        bank: {},
        stockMarket: { stacks: [] },
        phaseId: '2',
        companies: [
            ...MinorIds1867.map((id) => ({ id, kind: 'minor', ...unstarted })),
            ...MajorIds1867.map((id) => ({ id, kind: 'major', ...unstarted })),
            { id: CnId, kind: NationalCompanyKind, ...unstarted },
            ...PrivateIds1867.map((id) =>
                removedPrivateIds.includes(id)
                    ? { id, kind: 'private', closed: true }
                    : { id, kind: 'private' }
            )
        ],
        cash: [
            {
                owner: bank,
                amount: BankCash1867 - playerCash.reduce((sum, entry) => sum + entry.amount, 0)
            },
            ...playerCash.map(({ playerId, amount }) => ({
                owner: { kind: 'player' as const, playerId },
                amount
            })),
            ...[...companyIds, CnId].map((companyId) => ({
                owner: { kind: 'company' as const, companyId },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: MarketPoolId1867, owner: bank },
            ...MajorIds1867.map((companyId) => treasuryPool(companyId))
        ],
        certificates: [
            ...MinorIds1867.flatMap((companyId) =>
                createOrdinaryShareCertificates(companyId, [], { owner: bank })
            ),
            ...MajorIds1867.flatMap((companyId) => {
                const treasury = {
                    owner: { kind: 'company' as const, companyId },
                    poolId: treasuryPoolId(companyId)
                }
                return createOrdinaryShareCertificates(
                    companyId,
                    Array.from({ length: 8 }, () => treasury),
                    treasury
                )
            }),
            ...PrivateIds1867.filter((id) => !removedPrivateIds.includes(id)).map((companyId) => ({
                id: `${companyId}:charter`,
                companyId,
                kind: 'private' as const,
                owner: bank
            }))
        ],
        stations: [
            ...MinorIds1867.flatMap((companyId) => createCompanyStations(companyId, 1)),
            ...MajorIds1867.flatMap((companyId) =>
                createCompanyStations(companyId, MajorStationCount)
            ),
            ...cnStations()
        ],
        stationReservations: [],
        tileInventory: TileSet1867.createInventory(),
        trainInventory: TrainDepot1867.createInventory(trainSupply)
    }
}

export function createOpening1867({
    players,
    prng,
    startingPositions,
    config
}: OpeningSetup): Opening<typeof State1867, HydratedState1867> {
    assert(players.length >= 2 && players.length <= 6, '1867 is for two to six players')
    const capital = startingCash1867(players.length)
    const variants: Variants1867 = GameConfig1867.variants(config)
    return {
        position: createPosition(
            players.map((player) => ({ playerId: player.playerId, amount: capital })),
            trainSupply1867(GameConfig1867.unlimitedSpecialTrains(config), players.length),
            players.length === 2 ? removedForTwoPlayers(prng) : []
        ),
        titleState: { variants },
        begin: beginSelectionAuction(AuctionRules1867, startingPositions)
    }
}

/** Two players play with two privates removed at random (GTG §16.2). */
function removedForTwoPlayers(prng: Prng): string[] {
    const privateIds = [...PrivateIds1867]
    shuffle(privateIds, prng.random)
    return privateIds.slice(0, 2)
}
