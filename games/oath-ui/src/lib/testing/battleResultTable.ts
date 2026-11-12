import { ActionSource, Color, calculateActionChecksum, createAction } from '@tabletop/common'
import {
    Campaign,
    CampaignDefeatKills,
    CampaignSacrifice,
    CampaignTargetKind,
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    OBSIDIAN_CAGE_ID,
    PlayerStatus,
    Region,
    allMapSlots,
    mapSlotsFor,
    type RolledAttackFace,
    type WarbandGroup
} from '@tabletop/oath'
import { campaignRecords, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { played, type PlayedTable } from './sessionHarness.js'

const HOSPITAL = 'denizen.hearth.hospital'
const ZEALOTS = 'denizen.discord.zealots'
const HEARTS_AND_MINDS = 'denizen.hearth.hearts-and-minds'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const WRESTLERS = 'denizen.order.wrestlers'
const [HOME, PLAINS] = mapSlotsFor(Region.Cradle)
const SKULL: RolledAttackFace = { swords: 2, hollowSwords: 0, skulls: 1 }
const SWORD: RolledAttackFace = { swords: 1, hollowSwords: 0, skulls: 0 }
const HOLLOW: RolledAttackFace = { swords: 0, hollowSwords: 1, skulls: 0 }

const atPlains = (count: number): WarbandGroup => ({
    at: { kind: 'site', siteId: PLAINS },
    owner: IMPERIAL_WARBANDS,
    count
})
const onBoard = (playerId: string, count: number): WarbandGroup => ({
    at: { kind: 'board', playerId },
    owner: IMPERIAL_WARBANDS,
    count
})

export type BattleResultScene =
    | 'gap'
    | 'zealots'
    | 'short'
    | 'outright'
    | 'hospital'
    | 'bandits'
    | 'hearts'
    | 'gapSpoils'
    | 'cageSpoils'
    | 'outrightSpoils'
    | 'hospitalSpoils'
    | 'banditsSpoils'
    | 'envoySpoils'
    | 'allySpoils'
    | 'allyHospitalSpoils'

export interface Battle {
    danaBoard: number
    annBoard: number
    annSite: number
    attackRoll: RolledAttackFace[]
    swords: number
    shields: number
    defense: number
    /** What the skulls killed of Dana's force, as the declaration recorded it. */
    skullsKilled: number
    zealots?: boolean
    hospital?: boolean
    hearts?: boolean
    envoy?: boolean
    cage?: boolean
    bandits?: boolean
    /** Ann also used Wrestlers, and Hospital set aside the warband it sacrificed before the roll. */
    wrestlers?: boolean
    /** Dana used a Hospital of their own, at the Drowned City: their warbands killed are set aside. */
    attackerHospital?: boolean
    /** Rhys (a Citizen, blue) is Ann's ally, with 2 of the Empire's warbands on Rhys's board. */
    ally?: boolean
}

/**
 * R-5.5 — Dana (an Exile, red) campaigns against Ann (the Chancellor, purple) at the Plains, which
 * Ann rules: the Plains adds an attack die (R-11.4). Dana's declaration is recorded with what the
 * skulls killed; the state is the battle at its sacrifice step. With `hospital`, Ann rules the
 * Drowned City, where Hospital is, and used it; with `hearts`, Ann used Hearts and Minds and is
 * victorious now; with `envoy`, Dana used Peace Envoy; with `cage`, Dana holds the Obsidian Cage and
 * used it; with `zealots`, Dana used Zealots (a sacrifice adds 3); with `bandits`, no one rules the
 * Plains and 1 bandit defends it (R-2.8.3); `wrestlers` and `attackerHospital` as `Battle` says.
 */
function battleTable(battle: Battle): PlayedTable {
    const attackerPlans = [
        ...(battle.zealots ? [ZEALOTS] : []),
        ...(battle.attackerHospital ? [HOSPITAL] : []),
        ...(battle.envoy ? [PEACE_ENVOY] : []),
        ...(battle.cage ? [OBSIDIAN_CAGE_ID] : [])
    ]
    const defenderPlans = [
        ...(battle.hospital ? [HOSPITAL] : []),
        ...(battle.wrestlers ? [WRESTLERS] : []),
        ...(battle.hearts ? [HEARTS_AND_MINDS] : [])
    ]
    const killRedirects = [
        ...(battle.hospital ? [{ playerId: 'Ann', siteId: HOME }] : []),
        ...(battle.attackerHospital ? [{ playerId: 'Dana', siteId: HOME }] : [])
    ]
    const plansUsedBy: Record<string, string[]> = {}
    if (attackerPlans.length > 0) plansUsedBy.Dana = attackerPlans
    if (defenderPlans.length > 0) plansUsedBy.Ann = defenderPlans
    const decided = battle.hearts ? 'defender' : battle.envoy ? 'attacker' : undefined
    const defendingForce = battle.bandits
        ? []
        : [
              atPlains(battle.annSite),
              onBoard('Ann', battle.annBoard),
              ...(battle.ally ? [onBoard('Rhys', 2)] : [])
          ].filter((g) => g.count > 0)
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: PLAINS,
                warbandsOnBoard: { Dana: battle.danaBoard },
                warbandsInPersonalBank: { Dana: 14 - battle.danaBoard },
                relicIds: battle.cage ? [OBSIDIAN_CAGE_ID] : [],
                advisers: [
                    ...(battle.zealots ? [{ cardId: ZEALOTS, faceUp: true }] : []),
                    ...(battle.envoy ? [{ cardId: PEACE_ENVOY, faceUp: true }] : [])
                ]
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: battle.bandits ? HOME : PLAINS,
                favor: 2,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: battle.annBoard },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 },
                advisers: battle.hearts ? [{ cardId: HEARTS_AND_MINDS, faceUp: true }] : []
            }),
            ...(battle.ally
                ? [
                      testPlayer({
                          playerId: 'Rhys',
                          color: Color.Blue,
                          status: PlayerStatus.Citizen,
                          siteId: PLAINS,
                          warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                          warbandsInPersonalBank: { Rhys: 14 }
                      })
                  ]
                : [])
        ],
        {
            machineState: MachineState.CampaignSacrifice,
            chancellorPlayerId: 'Ann',
            oathRevision: CURRENT_OATH_REVISION,
            map: allMapSlots(),
            siteCards: { [HOME]: 'site.drowned-city', [PLAINS]: 'site.plains' },
            denizensBySite: { [HOME]: battle.hospital ? [HOSPITAL] : [], [PLAINS]: [] },
            warbandsBySite: {
                [HOME]: { [IMPERIAL_WARBANDS]: 1 },
                [PLAINS]: battle.annSite ? { [IMPERIAL_WARBANDS]: battle.annSite } : {}
            },
            campaign: {
                attackerPlayerId: 'Dana',
                defenderPlayerId: battle.bandits ? undefined : 'Ann',
                nonImperialPlayerIds: [],
                allyPlayerIds: battle.ally ? ['Rhys'] : [],
                targets: [{ kind: CampaignTargetKind.Site, siteId: PLAINS }],
                attackPool: battle.attackRoll.length,
                defensePool: 1,
                attackRoll: battle.attackRoll,
                defenseRoll: decided ? [] : [{ shields: battle.shields, doubling: false }],
                defense: battle.defense,
                swords: battle.swords,
                defendingForce,
                defendingBandits: battle.bandits ? 1 : 0,
                ...campaignRecords(),
                plansUsed: [...attackerPlans, ...defenderPlans],
                plansUsedBy,
                sacrificeWorth: battle.zealots ? 3 : 1,
                killRedirects,
                ...(battle.wrestlers
                    ? {
                          heldForHospital: [
                              { playerId: 'Ann', siteId: HOME, owner: IMPERIAL_WARBANDS, count: 1 }
                          ]
                      }
                    : {}),
                ...(decided ? { decidedVictor: decided } : {}),
                ...(battle.envoy ? { ignoreDefeatKills: true } : {})
            }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    const declaration = createAction(Campaign, {
        gameId: state.gameId,
        source: ActionSource.User,
        playerId: 'Dana',
        defender: battle.bandits ? { kind: 'bandits' } : { kind: 'player', playerId: 'Ann' },
        targets: [{ kind: CampaignTargetKind.Site, siteId: PLAINS }],
        attackDice: battle.danaBoard + battle.skullsKilled,
        plans: [],
        metadata: {
            supplySpent: 2,
            battle: {
                attackPool: battle.attackRoll.length,
                defensePool: 1,
                defense: battle.defense,
                swords: battle.swords,
                skullsKilled: battle.skullsKilled,
                plansUsed: [...attackerPlans, ...defenderPlans]
            }
        }
    })
    // The declaration is the history's one action, so the state follows it.
    const recorded = { ...declaration, id: 'a-0', index: 0 }
    state.actionCount = 1
    state.actionChecksum = calculateActionChecksum(0, [recorded])
    return { state: state.dehydrate(), actions: [recorded] }
}

function sacrifice(table: PlayedTable, count: number): PlayedTable {
    return played(table, [
        createAction(CampaignSacrifice, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'Dana',
            sacrifice: count
        })
    ])
}

/**
 * R-5.5.6.a — Dana's 4 swords and 4 sacrificed, 8 against 1 shield and 6 warbands (2 at the Plains,
 * 2 on Ann's board, 2 on Rhys's): half the defence, 3, die, and as the Chancellor Ann picks the 2 at
 * the Plains and 1 on Rhys's board.
 */
function allyPick(more: Partial<Battle>): PlayedTable {
    const table = sacrifice(
        battleTable({
            danaBoard: 6,
            annBoard: 2,
            annSite: 2,
            attackRoll: [SWORD, SWORD, SWORD, SWORD],
            swords: 4,
            shields: 1,
            defense: 7,
            skullsKilled: 0,
            ally: true,
            ...more
        }),
        4
    )
    return played(table, [
        createAction(CampaignDefeatKills, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'Ann',
            kills: [atPlains(2), onBoard('Rhys', 1)]
        })
    ])
}

/** 4 swords (a skull face, a sword, three hollow) against 0 shields and 3 + 3 warbands: 3 short. */
const gap = (more: Partial<Battle> = {}): Battle => ({
    danaBoard: 4,
    annBoard: 3,
    annSite: 3,
    attackRoll: [SKULL, SWORD, HOLLOW, HOLLOW, HOLLOW],
    swords: 4,
    shields: 0,
    defense: 6,
    skullsKilled: 1,
    ...more
})
/** 6 swords (two skull faces, a sword, two hollow) against 1 shield and 2 + 2 warbands: won. */
const outright = (more: Partial<Battle> = {}): Battle => ({
    danaBoard: 4,
    annBoard: 2,
    annSite: 2,
    attackRoll: [SKULL, SKULL, SWORD, HOLLOW, HOLLOW],
    swords: 6,
    shields: 1,
    defense: 5,
    skullsKilled: 2,
    ...more
})
/** 3 swords against 1 shield and the bandit: won. */
const bandits: Battle = {
    danaBoard: 4,
    annBoard: 2,
    annSite: 0,
    attackRoll: [SWORD, SWORD, HOLLOW, HOLLOW],
    swords: 3,
    shields: 1,
    defense: 2,
    skullsKilled: 0,
    bandits: true
}
/** Nothing rolled: a plan decided it. */
const decided = (more: Partial<Battle>): Battle => ({
    danaBoard: 4,
    annBoard: 2,
    annSite: 2,
    attackRoll: [],
    swords: 0,
    shields: 0,
    defense: 0,
    skullsKilled: 0,
    ...more
})

const SCENES: Record<BattleResultScene, (more: Partial<Battle>) => PlayedTable> = {
    gap: (more) => battleTable(gap(more)),
    zealots: (more) => battleTable(gap({ zealots: true, ...more })),
    short: (more) =>
        battleTable({
            danaBoard: 3,
            annBoard: 3,
            annSite: 3,
            attackRoll: [SWORD, HOLLOW, HOLLOW],
            swords: 2,
            shields: 0,
            defense: 6,
            skullsKilled: 0,
            ...more
        }),
    outright: (more) => battleTable(outright(more)),
    hospital: (more) => battleTable(outright({ hospital: true, ...more })),
    bandits: (more) => battleTable({ ...bandits, ...more }),
    hearts: (more) => battleTable(decided({ hearts: true, ...more })),
    gapSpoils: (more) => sacrifice(battleTable(gap(more)), 3),
    cageSpoils: (more) => sacrifice(battleTable(gap({ cage: true, ...more })), 3),
    outrightSpoils: (more) => sacrifice(battleTable(outright(more)), 0),
    hospitalSpoils: (more) => sacrifice(battleTable(outright({ hospital: true, ...more })), 0),
    banditsSpoils: (more) => sacrifice(battleTable({ ...bandits, ...more }), 0),
    envoySpoils: (more) => sacrifice(battleTable(decided({ envoy: true, ...more })), 0),
    allySpoils: (more) => allyPick(more),
    allyHospitalSpoils: (more) => allyPick({ hospital: true, ...more })
}

/** A battle's result, at its sacrifice step or after it (the spoils), as Dana's turn. */
export function battleResultTable(
    scene: BattleResultScene,
    more: Partial<Battle> = {}
): PlayedTable {
    return SCENES[scene](more)
}
