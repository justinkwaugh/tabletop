import {
    awardCertificates,
    beginWaterfallAuction,
    createCompanyStations,
    createOrdinaryShareCertificates,
    privateIncomePayments,
    startingCashByPlayerCount,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import { GameConfig1850 } from './definition/gameConfig.js'
import { Charters1850, Companies1850, RockIslandId, type Company1850 } from './companies.js'
import { Map1850 } from './map.js'
import { PrivateCatalog1850, Privates1850, RockIslandPrivateId } from './privates.js'
import type { HydratedState1850, State1850 } from './state.js'
import { TileSet1850 } from './tiles.js'
import type { TitleState1850 } from './titleState.js'
import { DieselVariant1850 } from './trains.js'

export const Bank1850 = 12000
// $2100 divided among the players (§3.3).
export const StartingCash1850: Readonly<Record<number, number>> = {
    2: 1050,
    3: 700,
    4: 525,
    5: 420,
    6: 350
}
export const startingCash1850 = startingCashByPlayerCount(StartingCash1850)

// The privates are offered in order; a bid beats the price or the last bid by $5, and several
// bidders settle a private by auction from the left of the highest bidder (§5.7).
export const AuctionRules1850: WaterfallAuctionRules = {
    lots: (state) => PrivateCatalog1850.lots(state),
    increment: 5,
    bidOrder: 'clockwise-from-highest',
    award(state, award) {
        awardCertificates(state, award, [
            `${award.lotId}:charter`,
            ...(award.lotId === RockIslandPrivateId ? [`${RockIslandId}:share:1`] : [])
        ])
    },
    incomePayments(state) {
        return privateIncomePayments(state, { charters: Charters1850 })
    }
}

export const InitialTitleState1850 = {
    variants: {},
    edgeTokens: [],
    mesabiRights: [],
    landGrant: { lays: 0, usedAnywhere: false }
}

/** Reduced Tokens takes a $100 token from each company with two (§16.3). */
function stationCount(company: Company1850, variants: TitleState1850['variants']): number {
    const { stationCosts } = company
    return variants.reducedTokens && stationCosts.length > 3 ? 3 : stationCosts.length
}

export function createOpening1850({
    players,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof State1850, HydratedState1850> {
    assert(players.length >= 2 && players.length <= 6, '1850 supports two through six players')
    const variants = GameConfig1850.variants(config)
    const capital = startingCash1850({ playerCount: players.length, config })
    const ipo = { owner: { kind: 'bank' } as const, poolId: 'initial-offering' }
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...Companies1850.map((company) => ({
                id: company.id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...Privates1850.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: Bank1850 - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...Companies1850.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: 'initial-offering', owner: { kind: 'bank' } },
            { id: 'open-market', owner: { kind: 'bank' } }
        ],
        certificates: [
            ...Companies1850.flatMap((company) =>
                createOrdinaryShareCertificates(
                    company.id,
                    Array.from({ length: 8 }, () => ipo),
                    ipo
                )
            ),
            ...Privates1850.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: Companies1850.flatMap((company) =>
            createCompanyStations(company.id, stationCount(company, variants))
        ),
        stationReservations: Map1850.stationReservations(),
        tileInventory: TileSet1850.createInventory(),
        trainInventory: DieselVariant1850.inventory(!!variants.diesels),
        phaseId: '2'
    }
    return {
        position,
        titleState: { ...InitialTitleState1850, variants },
        begin: beginWaterfallAuction(AuctionRules1850, startingPositions)
    }
}
