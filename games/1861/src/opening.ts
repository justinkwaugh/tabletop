import { assert, assertExists, shuffle, type Prng } from '@tabletop/common'
import {
    awardPrivate,
    beginSelectionAuction,
    createCompanyStations,
    createOrdinaryShareCertificates,
    treasuryPool,
    treasuryPoolId,
    NationalCompanyKind,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from '@tabletop/18xx'
import {
    BankCash1861,
    MajorIds1861,
    MajorStationCount,
    MinorIds1861,
    RsrId,
    RsrStationCount,
    startingCash1861
} from './companies.js'
import { GameConfig1861 } from './definition/gameConfig.js'
import { Map1861 } from './map.js'
import { MarketPoolId1861 } from './names.js'
import { PrivateCatalog1861, PrivateIds1861, privateTerms1861 } from './privates.js'
import type { HydratedState1861, State1861, Variants1861 } from './state.js'
import { TileSet1861 } from './tiles.js'
import { TrainDepot1861, trainSupply1861 } from './trains.js'

/** When every player passes on a private, its lowest bid falls by R5 (§9.4). */
const AllPassDiscount = 5

type OpeningState = SelectionAuctionState & Pick<State1861, 'variants'>

// The privates are auctioned in order, the Tsarskoye Selo first (§9.4); after each auction the next
// turn is the winner's left, or the proposer's with §14.5.
export const AuctionRules1861: SelectionAuctionRules = {
    lots: (state) =>
        PrivateCatalog1861.lots(state).filter(
            (lot) => !state.companies.some((company) => company.id === lot.id && company.closed)
        ),
    nominationLotIds(state) {
        assertExists(state.selectionAuction, 'Nominations belong to the selection auction')
        return state.selectionAuction.remainingLotIds.slice(0, 1)
    },
    passingWhileNominating: () => true,
    openingBid: (_state, lotId) => privateTerms1861(lotId).minimumBid,
    increment: 5,
    award: awardPrivate,
    nominationFollowsWinner: (state: OpeningState) => !state.variants.proposerOrder,
    closeUnsold() {
        assert(false, 'Every 1861 private is sold')
    },
    allPassDiscount: AllPassDiscount
}

const bank = { kind: 'bank' } as const
const companyIds = [...MinorIds1861, ...MajorIds1861]

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
            ...MinorIds1861.map((id) => ({ id, kind: 'minor', ...unstarted })),
            ...MajorIds1861.map((id) => ({ id, kind: 'major', ...unstarted })),
            { id: RsrId, kind: NationalCompanyKind, ...unstarted },
            ...PrivateIds1861.map((id) =>
                removedPrivateIds.includes(id)
                    ? { id, kind: 'private', closed: true }
                    : { id, kind: 'private' }
            )
        ],
        cash: [
            {
                owner: bank,
                amount: BankCash1861 - playerCash.reduce((sum, entry) => sum + entry.amount, 0)
            },
            ...playerCash.map(({ playerId, amount }) => ({
                owner: { kind: 'player' as const, playerId },
                amount
            })),
            ...[...companyIds, RsrId].map((companyId) => ({
                owner: { kind: 'company' as const, companyId },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: MarketPoolId1861, owner: bank },
            ...MajorIds1861.map((companyId) => treasuryPool(companyId))
        ],
        certificates: [
            ...MinorIds1861.flatMap((companyId) =>
                createOrdinaryShareCertificates(companyId, [], { owner: bank })
            ),
            ...MajorIds1861.flatMap((companyId) => {
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
            ...PrivateIds1861.filter((id) => !removedPrivateIds.includes(id)).map((companyId) => ({
                id: `${companyId}:charter`,
                companyId,
                kind: 'private' as const,
                owner: bank
            }))
        ],
        stations: [
            ...MinorIds1861.flatMap((companyId) => createCompanyStations(companyId, 1)),
            ...MajorIds1861.flatMap((companyId) =>
                createCompanyStations(companyId, MajorStationCount)
            ),
            ...createCompanyStations(RsrId, RsrStationCount)
        ],
        stationReservations: Map1861.stationReservations(),
        tileInventory: TileSet1861.createInventory(),
        trainInventory: TrainDepot1861.createInventory(trainSupply)
    }
}

export function createOpening1861({
    players,
    prng,
    startingPositions,
    config
}: OpeningSetup): Opening<typeof State1861, HydratedState1861> {
    assert(players.length >= 2 && players.length <= 6, '1861 is for two to six players')
    const capital = startingCash1861(players.length)
    const variants: Variants1861 = GameConfig1861.variants(config)
    return {
        position: createPosition(
            players.map((player) => ({ playerId: player.playerId, amount: capital })),
            trainSupply1861(GameConfig1861.unlimitedSpecialTrains(config), players.length),
            players.length === 2 ? removedForTwoPlayers(prng) : []
        ),
        titleState: { variants },
        begin: beginSelectionAuction(AuctionRules1861, startingPositions)
    }
}

/** Two players play with two privates removed at random (GTG §16.2). */
function removedForTwoPlayers(prng: Prng): string[] {
    const privateIds = [...PrivateIds1861]
    shuffle(privateIds, prng.random)
    return privateIds.slice(0, 2)
}
