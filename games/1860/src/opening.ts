import {
    beginOpening,
    createCompanyStations,
    createOrdinaryShareCertificates,
    drawFirstPlayer,
    startingCashByPlayerCount,
    type Certificate,
    type InitialPosition,
    type Opening,
    type OpeningSetup
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import {
    Companies1860,
    FerryPrivateIds,
    PrivateCatalog1860,
    ShareCount,
    company1860
} from './companies.js'
import { GameConfig1860 } from './definition/gameConfig.js'
import { Map1860 } from './map.js'
import { BankPrivatesPoolId, IpoPoolId, MarketPoolId } from './names.js'
import { ChoiceAuctionState, type HydratedState1860, type State1860 } from './state.js'
import { TileSet1860 } from './tiles.js'
import { TrainDepot1860 } from './trains.js'

/** Starting money by player count (Starting Money). */
export const startingCash1860 = startingCashByPlayerCount({ 2: 1000, 3: 670, 4: 500 })

/**
 * The bank's £10,000 of player money; company credits are a separate currency, so only the money
 * in players' hands counts against it (Components; The End of the Game).
 */
export const BankMoney1860 = 10000

/** The share of each company kept for its private's exchange, at the bottom of its IPO pile. */
export function reservedCertificateId(companyId: string): string | undefined {
    return company1860(companyId).exchangePrivateId
        ? `${companyId}:share:${ShareCount - 2}`
        : undefined
}

function companyCertificates(companyId: string): Certificate[] {
    const ipo = { owner: { kind: 'bank' as const }, poolId: IpoPoolId }
    return createOrdinaryShareCertificates(
        companyId,
        Array.from({ length: ShareCount - 2 }, () => ipo),
        ipo
    )
}

export function createOpening1860(
    setup: OpeningSetup
): Opening<typeof State1860, HydratedState1860> {
    const { players, config, startingPositions } = setup
    assert(players.length >= 2 && players.length <= 4, '1860 supports two to four players')
    const capital = startingCash1860({ playerCount: players.length, config })
    const options = GameConfig1860.options(config)
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...Companies1860.map((company) => ({
                id: company.id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...PrivateCatalog1860.privates.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            // Company credits never run out; the title watches the players' money instead.
            { owner: { kind: 'bank' }, amount: 'unlimited' },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...Companies1860.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: IpoPoolId, owner: { kind: 'bank' } },
            { id: MarketPoolId, owner: { kind: 'bank' } },
            { id: BankPrivatesPoolId, owner: { kind: 'bank' } }
        ],
        certificates: [
            ...Companies1860.flatMap((company) => companyCertificates(company.id)),
            ...PrivateCatalog1860.privates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: Companies1860.flatMap((company) =>
            createCompanyStations(company.id, company.stationCosts.length)
        ),
        stationReservations: Map1860.stationReservations(),
        tileInventory: TileSet1860.createInventory(),
        trainInventory: TrainDepot1860.createInventory(GameConfig1860.depotId(config)),
        phaseId: '2'
    }
    return {
        position,
        titleState: { options, insolventIds: [], bankruptIds: [] },
        begin(state) {
            const firstPlayerId = drawFirstPlayer(
                state.turnManager.turnOrder,
                state.getPublicPrng(),
                startingPositions
            )
            state.turnManager.newFirstPlayer(firstPlayerId)
            state.choiceAuction = {
                starterId: firstPlayerId,
                passedIds: [],
                lotIds: [
                    ...FerryPrivateIds,
                    ...Companies1860.filter((c) => c.layer === 1).map((c) => c.id)
                ]
            }
            beginOpening(state, ChoiceAuctionState, firstPlayerId)
        }
    }
}
