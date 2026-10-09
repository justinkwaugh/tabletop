import { assert, assertExists, type PlayerState } from '@tabletop/common'
import {
    addShort,
    certificatesInPool,
    addCompanyStations,
    applyStationPlacement,
    getCompany,
    homeStationId,
    issueShareCertificates,
    presidentCertificate,
    type CompanyState,
    type MapStateData,
    type Owner,
    type President,
    type TrainState
} from '@tabletop/18xx'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'
import {
    BasePrivateIds,
    EighteenSeventeenTrainDepot,
    MarketPoolId,
    createEighteenSeventeenPosition,
    treasuryPoolId
} from '../index.js'

const PlayerCash = [300, 250, 280, 200]

// Pittsburgh & Lake Erie is a 2-share company at Pittsburgh; Boston & Albany a 5-share company
// at Boston with one share in its treasury and one in the market.
export function createEighteenSeventeenCompanyExample(
    players: readonly PlayerState[],
    position: PreparedPosition
): CompanyState & MapStateData & TrainState {
    assert(
        players.length === 3 || players.length === 4,
        '1817 examples require three or four players'
    )
    const [alex, blair, casey]: President[] = players.map((player) => ({
        kind: 'player',
        playerId: player.playerId
    }))
    const state = createEighteenSeventeenPosition(
        players.map((player, index) => ({ playerId: player.playerId, amount: PlayerCash[index] })),
        BasePrivateIds
    )
    startCompany(state, 'PLE', alex, { shareCount: 2, parPrice: 50, treasury: 100 }, 'F13')
    startCompany(state, 'BA', blair, { shareCount: 5, parPrice: 120, treasury: 200 }, 'C26')
    addCompanyStations(state, 'BA', 1)
    issueShareCertificates(state, 'BA', 1, { owner: alex })
    issueShareCertificates(state, 'BA', 1, { owner: { kind: 'bank' }, poolId: MarketPoolId })
    issueShareCertificates(state, 'BA', 1, {
        owner: { kind: 'company', companyId: 'BA' },
        poolId: treasuryPoolId('BA')
    })
    givePrivate(state, 'MAIL', casey)
    givePrivate(state, 'MINC', alex)
    if (position === 'company-powers') {
        for (const privateId of ['UBC', 'MAJC', 'MTE', 'MAJM'])
            givePrivate(state, privateId, { kind: 'company', companyId: 'BA' })
        givePrivate(state, 'PSM', { kind: 'company', companyId: 'PLE' })
    }
    // Casey has shorted Boston & Albany, whose share Alex bought; the market holds a short of
    // its own, as when a bankrupt player's shorts go to it, and Blair bought its share.
    if (position === 'shorts') {
        issueShareCertificates(state, 'BA', 1, { owner: alex })
        addShort(state, 'BA', casey)
        const marketShare = certificatesInPool(state, MarketPoolId).find(
            (certificate) => certificate.kind === 'share' && certificate.companyId === 'BA'
        )
        assertExists(marketShare, 'Boston & Albany has a share in the market')
        marketShare.owner = blair
        delete marketShare.poolId
        addShort(state, 'BA', { kind: 'bank' }, MarketPoolId)
    }
    // Boston & Albany is at its loan limit with nothing to pay interest, and its president has
    // no cash: it defaults when its trains are done.
    if (position === 'bankruptcy') {
        getCompany(state, 'BA').loans = 5
        for (const cash of state.cash)
            if (
                (cash.owner.kind === 'company' && cash.owner.companyId === 'BA') ||
                (cash.owner.kind === 'player' && cash.owner.playerId === blair.playerId)
            )
                cash.amount = 0
    }
    if (position !== 'trading' && position !== 'starting')
        for (const companyId of ['PLE', 'BA']) {
            const train = EighteenSeventeenTrainDepot.nextTrain(state.trainInventory, '2')
            assert(train, 'The example requires a train')
            EighteenSeventeenTrainDepot.purchase(state.trainInventory, train.id, '2', {
                kind: 'company',
                companyId
            })
        }
    return state
}

function startCompany(
    state: CompanyState & MapStateData,
    companyId: string,
    president: President,
    terms: { shareCount: number; parPrice: number; treasury: number },
    locationId: string
): void {
    Object.assign(getCompany(state, companyId), {
        shareCount: terms.shareCount,
        parPrice: terms.parPrice,
        president,
        started: true,
        floated: true,
        funded: true,
        operated: true
    })
    const certificate = presidentCertificate(state, companyId)
    assertExists(certificate, 'An example company has its president’s certificate')
    certificate.owner = president
    const cash = state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
    )
    assertExists(cash, 'An example company has a treasury')
    cash.amount = terms.treasury
    applyStationPlacement(state, {
        companyId,
        stationId: homeStationId(companyId),
        position: { locationId, nodeId: 'city', slot: 0 },
        cost: 0
    })
}

function givePrivate(state: CompanyState, privateId: string, owner: Owner): void {
    const certificate = state.certificates.find((item) => item.companyId === privateId)
    assert(certificate, 'An example private is open')
    certificate.owner = owner
}
