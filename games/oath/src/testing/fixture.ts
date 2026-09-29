import { Color, assertExists, getPrng, type TurnManager } from '@tabletop/common'
import { BannerState, HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { OathPlayerState } from '../model/playerState.js'
import { MachineState } from '../definition/states.js'
import {
    Banner,
    CardKind,
    IMPERIAL_COLOR,
    OathType,
    PlayerStatus,
    Region
} from '../model/oathEnums.js'
import { RELIQUARY_SIZE } from '../data/relics.js'
import { reliquarySlotId, warbandOwnersBySeat } from '../model/setup.js'
import { createOathVault, type OathVault } from '../model/vault.js'
import { bySuit } from '../data/typedData.js'
import type { CampaignState } from '../model/campaign.js'
import { registerCards } from '../data/cardRegistry.js'

/** The eight map slots (R-2.1.1): 2 Cradle, 3 Provinces, 3 Hinterland. */
export const CRADLE = ['c1', 'c2']
export const PROVINCES = ['p1', 'p2', 'p3']
export const HINTERLAND = ['h1', 'h2', 'h3']

/** R-2.8.1 — every site prints a capacity, so each fixture slot's own card is a powerless site. */
export const FIXTURE_SITE_CAPACITY = 3
registerCards(
    [...CRADLE, ...PROVINCES, ...HINTERLAND].map((slotId) => ({
        id: slotId,
        name: slotId,
        kind: CardKind.Site,
        capacity: FIXTURE_SITE_CAPACITY
    }))
)

export function testPlayer(overrides: Partial<OathPlayerState> = {}): OathPlayerState {
    const advisers = overrides.advisers ?? []
    return {
        playerId: 'p1',
        color: Color.Red,
        status: PlayerStatus.Exile,
        supply: 7,
        supplySpentThisTurn: 0,
        favor: 0,
        secrets: 0,
        secretsFacedown: 0,
        warbandsOnBoard: {},
        warbandsInPersonalBank: { [Color.Red]: 14 },
        siteId: undefined,
        relicIds: [],
        adviserLimit: 3,
        handIds: [],
        handCount: overrides.handIds?.length ?? 0,
        visionIds: [],
        revealedVisionId: undefined,
        peekedRelicSlotIds: [],
        peekedRelics: {},
        peekedSiteSlotIds: [],
        homelandUsedThisTurn: [],
        restPowersUsedThisTurn: [],
        ...overrides,
        // R-9.4 — a fixture names every adviser; the public row names a faceup one only.
        advisers: advisers.map((row) => (row.faceUp ? row : { faceUp: false })),
        adviserIds:
            overrides.adviserIds ??
            advisers.map((row) => {
                assertExists(row.cardId, 'A fixture adviser names its card')
                return row.cardId
            }),
        // R-4.3.4 — marker and ledger agree unless a fixture refreshes Supply mid-turn.
        supplyAtTurnStart:
            overrides.supplyAtTurnStart ??
            (overrides.supply ?? 7) + (overrides.supplySpentThisTurn ?? 0)
    }
}

export function testState(
    players: OathPlayerState[],
    overrides: Partial<OathProjectedState> = {}
): HydratedOathGameState {
    const raw = {
        id: 'state-1',
        gameId: 'game-1',
        players,
        activePlayerIds: [players[0].playerId],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.ActPhase,
        turnManager: {
            series: [],
            turnOrder: players.map((p) => p.playerId),
            turnCounts: Object.fromEntries(players.map((p) => [p.playerId, 0]))
        },
        winningPlayerIds: [],
        round: 1,
        map: {
            [Region.Cradle]: CRADLE,
            [Region.Provinces]: PROVINCES,
            [Region.Hinterland]: HINTERLAND
        },
        denizensBySite: {},
        cardTokens: {},
        relicsBySite: {},
        warbandsBySite: {},
        warbandsOnCards: {},
        // R-2.3, R-1.17 — covered, or R-6.6.2.a would give every Chancellor all four traits.
        reliquary: Array.from({ length: RELIQUARY_SIZE }, (_, i) => ({
            slotId: reliquarySlotId(i)
        })),
        favorBank: bySuit(() => 3),
        // R-1.4's 36 favor, less the 18 in the suit banks above.
        favorSupply: 18,
        chancellorPlayerId: players.find((player) => player.status === PlayerStatus.Chancellor)
            ?.playerId,
        warbandOwnerPlayerId: warbandOwners(players, overrides.chancellorPlayerId),
        banners: testBanners(),
        worldDeckExhausted: false,
        topCardBackType: CardKind.Denizen,
        visionsDrawn: 0,
        discardPileCounts: {
            [Region.Cradle]: 0,
            [Region.Provinces]: 0,
            [Region.Hinterland]: 0
        },
        discardTopBackType: {},
        boxIds: [],
        siteCapacityOverrides: {},
        oathType: OathType.Supremacy,
        vault: testVaultWithRelics({}),
        ...overrides
    }
    // R-1.1, R-9.4 — every fixture site is faceup unless `siteCards` says otherwise (R-10.21).
    const siteCards =
        overrides.siteCards ??
        Object.fromEntries(
            Object.values(raw.map)
                .flat()
                .map((slotId) => [slotId, slotId])
        )
    return new HydratedOathGameState({ ...raw, siteCards })
}

export function openTurn(state: { turnManager: TurnManager }, playerId: string): void {
    state.turnManager.series = [{ type: 'turn', playerId, start: 0 }]
}

/** R-1.7 — a table seats a Chancellor; one is added away from play when none is given. */
export function withChancellor(players: OathPlayerState[]): OathPlayerState[] {
    if (players.some((player) => player.status === PlayerStatus.Chancellor)) return players
    return [
        ...players,
        testPlayer({
            playerId: 'chancellor',
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            siteId: 'h3',
            warbandsInPersonalBank: {}
        })
    ]
}

/** R-9.4 */
export function testVaultWithRelics(relicFacedown: Record<string, string>): OathVault {
    return createOathVault({ relicFacedown }, getPrng(1))
}

/** R-10.13 — each seat's colour, and purple to the Chancellor, as setup records them. */
function warbandOwners(
    players: OathPlayerState[],
    chancellorPlayerId: string | undefined
): Record<string, string> {
    const chancellor =
        chancellorPlayerId ??
        players.find((player) => player.status === PlayerStatus.Chancellor)?.playerId
    return {
        ...warbandOwnersBySeat(players),
        ...(chancellor ? { [IMPERIAL_COLOR]: chancellor } : {})
    }
}

/** R-2.5 — `value` 1 makes a banner a Recover target (R-5.4.2) worth one die (R-2.5.2). */
export function testBanners(
    holders: Partial<Record<Banner, string>> = {},
    value = 1
): Record<Banner, BannerState> {
    return {
        [Banner.PeoplesFavor]: {
            value,
            mobSide: false,
            holderPlayerId: holders[Banner.PeoplesFavor]
        },
        [Banner.DarkestSecret]: {
            value,
            mobSide: false,
            holderPlayerId: holders[Banner.DarkestSecret]
        }
    }
}

/** What `HydratedCampaign` writes to a Campaign's running records when it is declared. */
export function campaignRecords(): Pick<
    CampaignState,
    | 'plansUsed'
    | 'forceSiteIds'
    | 'killRedirects'
    | 'discardAtEnd'
    | 'plansUsedBy'
    | 'rollRules'
    | 'sacrificeWorth'
> {
    return {
        plansUsed: [],
        forceSiteIds: [],
        killRedirects: [],
        discardAtEnd: [],
        plansUsedBy: {},
        rollRules: {},
        sacrificeWorth: 1
    }
}
