import { assert, assertExists, shuffle, type Prng } from '@tabletop/common'
import {
    awardCertificates,
    awardPrivate,
    beginSelectionAuction,
    closePrivate,
    createCompanyStations,
    createOrdinaryShareCertificates,
    finiteCashOwnedBy,
    privateIncomePayments,
    requirePar,
    startingCashByPlayerCount,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from '@tabletop/18xx'
import {
    BcrId,
    ForeignInvestors1880,
    Majors1880,
    P0Id,
    P1Id,
    P6Id,
    PrivateCatalog1880,
    Privates1880,
    StationCosts1880
} from './companies.js'
import { GameConfig1880 } from './definition/gameConfig.js'
import { Map1880 } from './map.js'
import { BankPoolId1880, ReservePoolId1880 } from './names.js'
import type { HydratedState1880, State1880 } from './state.js'
import { Charters1880 } from './stock.js'
import { TileSet1880 } from './tiles.js'
import { TrainDepot1880 } from './trains.js'

/** Starting capital by player count (§IV). */
export const startingCash1880 = startingCashByPlayerCount({
    3: 600,
    4: 480,
    5: 400,
    6: 340,
    7: 300
})

/** The privates whose opening bid falls by ¥5 each time every player passes on them (§V). */
const DiscountedPrivateIds: readonly string[] = [P0Id, P1Id]

/**
 * The privates are auctioned in order from P0, each started by the player after the one who
 * started the last; whoever passes is out of that auction (§V). After P1, a round of passes
 * pays the privates' income and the auction carries on.
 */
export const AuctionRules1880: SelectionAuctionRules = {
    lots: (state) =>
        PrivateCatalog1880.lots(state).filter(
            (lot) => !state.companies.some((company) => company.id === lot.id && company.closed)
        ),
    nominationLotIds(state) {
        assertExists(state.selectionAuction, 'Nominations belong to the selection auction')
        return state.selectionAuction.remainingLotIds.slice(0, 1)
    },
    passingWhileNominating: () => true,
    passesWithdraw: true,
    nominationFollowsOpener: true,
    openingBid: (_state, lotId) => PrivateCatalog1880.faceValue(lotId),
    increment: 5,
    award(state, award) {
        awardPrivate(state, award)
        if (award.lotId !== P6Id) return
        // P6 brings the BCR's 20% director's certificate, its price fixed at ¥100; P6 then
        // leaves play (§VI).
        awardCertificates(state, { ...award, price: 0 }, [`${BcrId}:president`])
        closePrivate(state, P6Id)
        requirePar(state, BcrId, award.playerId)
    },
    closeUnsold() {
        assert(false, 'Every 1880 private is sold')
    },
    allPassDiscount: 5,
    allPassIncome: (state, lotId) =>
        DiscountedPrivateIds.includes(lotId)
            ? undefined
            : privateIncomePayments(state, { charters: Charters1880 }),
    firstStockOrder: seatsByCash
}

/**
 * Once every private is sold, the player with least money sits first and takes priority, the
 * rest following by cash, ties in their old order (§V).
 */
export function seatsByCash(state: SelectionAuctionState): readonly string[] {
    const order = state.turnManager.turnOrder
    const cash = (playerId: string) => finiteCashOwnedBy(state, { kind: 'player', playerId })
    return [...order].sort((a, b) => cash(a) - cash(b) || order.indexOf(a) - order.indexOf(b))
}

const bank = { kind: 'bank' } as const
const unstarted = { started: false, floated: false, funded: false, operated: false }

/**
 * Each major's shares: its director's certificate and three shares on sale, the other five
 * reserved until the first 3-train (§IV, §XI).
 */
function majorCertificates(companyId: string) {
    const onSale = { owner: bank, poolId: BankPoolId1880 }
    const reserved = { owner: bank, poolId: ReservePoolId1880 }
    return createOrdinaryShareCertificates(
        companyId,
        [onSale, onSale, onSale, reserved, reserved, reserved, reserved, reserved],
        onSale
    )
}

function investorsLeftOut(playerCount: number, prng: Prng): string[] {
    const ids = ForeignInvestors1880.map((investor) => investor.id)
    shuffle(ids, prng.random)
    return ids.slice(playerCount)
}

export function createOpening1880({
    players,
    prng,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof State1880, HydratedState1880> {
    assert(players.length >= 3 && players.length <= 7, '1880 supports three through seven players')
    const capital = startingCash1880({ playerCount: players.length, config })
    const removedInvestorIds = GameConfig1880.options(config).randomInvestors
        ? investorsLeftOut(players.length, prng)
        : []
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...Majors1880.map((company) => ({ id: company.id, kind: 'major', ...unstarted })),
            ...ForeignInvestors1880.map((investor) => ({
                id: investor.id,
                kind: 'minor',
                ...unstarted,
                ...(removedInvestorIds.includes(investor.id) ? { closed: true } : {})
            })),
            ...Privates1880.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: bank, amount: 'unlimited' },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...[...Majors1880, ...ForeignInvestors1880].map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: BankPoolId1880, owner: bank },
            { id: ReservePoolId1880, owner: bank }
        ],
        certificates: [
            ...Majors1880.flatMap((company) => majorCertificates(company.id)),
            ...ForeignInvestors1880.flatMap((investor) =>
                createOrdinaryShareCertificates(investor.id, [], { owner: bank })
            ),
            ...Privates1880.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: bank
            }))
        ],
        stations: [
            ...Majors1880.flatMap((company) =>
                createCompanyStations(company.id, StationCosts1880.length)
            ),
            ...ForeignInvestors1880.flatMap((investor) => createCompanyStations(investor.id, 1))
        ],
        stationReservations: Map1880.stationReservations().filter(
            (reservation) => !removedInvestorIds.includes(reservation.companyId)
        ),
        tileInventory: TileSet1880.createInventory(),
        trainInventory: TrainDepot1880.createInventory(),
        phaseId: 'A1'
    }
    return {
        position,
        titleState: {
            parSlots: {},
            permits: {},
            fullyCapitalized: [],
            playerLoans: [],
            ...(removedInvestorIds.length ? { removedInvestorIds } : {})
        },
        begin: beginSelectionAuction(AuctionRules1880, startingPositions)
    }
}
