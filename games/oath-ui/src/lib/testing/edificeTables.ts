import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    Campaign,
    CampaignTargetKind,
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    OathType,
    PlayerStatus,
    PowerQuestionKind,
    Region,
    Search,
    SearchSource,
    allMapSlots,
    mapSlotsFor,
    type HydratedOathGameState,
    type OathPlayerState
} from '@tabletop/oath'
import {
    fillDispossessed,
    openTurn,
    placeEdifice,
    testPlayer,
    testState,
    testVaultWithRelics,
    wholeWorld
} from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

// The edifices on the board, in a chronicle's later games: Dana (purple) is the Chancellor, Rhys
// (red) and Ann (blue) are Exiles. Each edifice is one card, so its two sides are never in one game.

export const HALL = 'edifice.hearth.hall-of-debate'
export const FORGE = 'edifice.nomad.ancient-forge'
export const SPIRE = 'edifice.arcane.great-spire'
export const DISTRICT = 'edifice.discord.festival-district'
export const RAMPART = 'edifice.order.sprawling-rampart'
export const TEMPLE = 'edifice.beast.forest-temple'
const CUP = 'relic.cup-of-plenty'
const GRAND_SCEPTER = 'relic.grand-scepter'

export const [PLAINS, VALLEY] = mapSlotsFor(Region.Cradle)
export const [WOOD, SLUM, RIVER] = mapSlotsFor(Region.Provinces)
export const [MOUNTAIN, HIDDEN, STONES] = mapSlotsFor(Region.Hinterland)

const SITES: Record<string, string> = {
    [PLAINS]: 'site.plains',
    [VALLEY]: 'site.fertile-valley',
    [WOOD]: 'site.shrouded-wood',
    [SLUM]: 'site.great-slums',
    [RIVER]: 'site.river',
    [MOUNTAIN]: 'site.mountain',
    [HIDDEN]: 'site.the-hidden-place',
    [STONES]: 'site.standing-stones'
}

const RELICS: Record<string, string> = {
    [WOOD]: 'relic.book-of-records',
    [MOUNTAIN]: 'relic.brass-horse',
    [HIDDEN]: 'relic.ivory-eye',
    [STONES]: 'relic.whistle'
}

/** The sites' denizens, the edifices placed apart (`placeEdifice`). */
const DENIZENS: Record<string, string[]> = {
    [PLAINS]: ['denizen.beast.wolves'],
    [VALLEY]: ['denizen.hearth.armed-mob'],
    [WOOD]: ['denizen.order.encirclement'],
    [SLUM]: ['denizen.hearth.rowdy-pub', 'denizen.discord.gambling-hall'],
    [RIVER]: ['denizen.nomad.oracle'],
    [MOUNTAIN]: ['denizen.beast.birdsong'],
    [HIDDEN]: ['denizen.arcane.tutor'],
    [STONES]: []
}

/** R-1.12 — 2 Imperial warbands at the Plains and 1 at each other site with a denizen or intact edifice. */
const GARRISONS: Record<string, Record<string, number>> = {
    [PLAINS]: { [IMPERIAL_WARBANDS]: 2 },
    [VALLEY]: { [IMPERIAL_WARBANDS]: 1 },
    [WOOD]: { [IMPERIAL_WARBANDS]: 1 },
    [SLUM]: { [IMPERIAL_WARBANDS]: 1 },
    [RIVER]: { [IMPERIAL_WARBANDS]: 1 },
    [MOUNTAIN]: { [IMPERIAL_WARBANDS]: 1 },
    [HIDDEN]: { [IMPERIAL_WARBANDS]: 1 }
}

type Seat = 'dana' | 'rhys' | 'ann'

interface Scene {
    on: Seat
    at: Partial<Record<Seat, string>>
    over?: Partial<Record<Seat, Partial<OathPlayerState>>>
    denizens?: Record<string, string[]>
    warbands?: Record<string, Record<string, number>>
    round?: number
}

/** One table of the chronicle's later games, on its seat's turn in the Act Phase. */
function scene({ on, at, over = {}, denizens = {}, warbands = {}, round = 2 }: Scene) {
    const relicSlots = Object.fromEntries(
        Object.keys(RELICS).map((slotId) => [slotId, [{ slotId: `${slotId}.relic.0` }]])
    )
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: at.dana ?? PLAINS,
                favor: 5,
                secrets: 2,
                supply: 6,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 },
                ...over.dana
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                siteId: at.rhys ?? MOUNTAIN,
                favor: 4,
                secrets: 3,
                supply: 6,
                warbandsOnBoard: { rhys: 4 },
                ...over.rhys
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                siteId: at.ann ?? RIVER,
                favor: 4,
                secrets: 2,
                supply: 6,
                warbandsOnBoard: { ann: 3 },
                ...over.ann
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            oathType: OathType.Supremacy,
            oathRevision: CURRENT_OATH_REVISION,
            // A game started at this revision carries its table record, which R-8 reads once won.
            table: {
                name: 'Thursday table',
                date: '2026-10-22',
                seatNames: { dana: 'Dana', rhys: 'Rhys', ann: 'Ann' }
            },
            round,
            map: allMapSlots(),
            siteCards: SITES,
            denizensBySite: { ...DENIZENS, ...denizens },
            warbandsBySite: { ...GARRISONS, ...warbands },
            relicsBySite: relicSlots,
            vault: testVaultWithRelics(
                Object.fromEntries(
                    Object.entries(RELICS).map(([slotId, relic]) => [`${slotId}.relic.0`, relic])
                )
            )
        }
    )
    openTurn(state, on)
    state.activePlayerIds = [on]
    return state
}

function envelope(table: PlayedTable) {
    return { gameId: table.state.gameId, source: ActionSource.User }
}

/**
 * Game 3, round 2: Hall of Debate first at the Plains, Broken Forge and a relic at Standing
 * Stones, which the bandits rule. Rhys is on turn at Standing Stones, so Use a power lists Broken
 * Forge (R-7.1.1). With `forge` intact, Ann stands there instead with Ancient Forge, the relic deck
 * holding Cup of Plenty.
 */
export function edificeMapTable(forge: 'broken' | 'ancient' = 'broken'): PlayedTable {
    const broken = forge === 'broken'
    const state = scene(
        broken
            ? { on: 'rhys', at: { rhys: STONES, ann: RIVER } }
            : { on: 'ann', at: { rhys: MOUNTAIN, ann: STONES }, round: 3 }
    )
    placeEdifice(state, PLAINS, HALL)
    placeEdifice(state, STONES, FORGE, { ruined: broken })
    state.requireVault().relicDeck = [CUP, 'relic.map']
    return tableOf(state)
}

/** Game 4: Great Spire at the Great Slum, where Ann's pawn stands. */
function spireState(dispossessed: readonly string[], ruined = false): HydratedOathGameState {
    const state = scene({ on: 'ann', at: { ann: SLUM } })
    placeEdifice(state, SLUM, SPIRE, { ruined })
    fillDispossessed(state, dispossessed)
    return state
}

const SIX_DISPOSSESSED = [
    'denizen.discord.assassin',
    'denizen.nomad.elders',
    'denizen.discord.naysayers',
    'denizen.hearth.ballot-box',
    'denizen.nomad.tents',
    'denizen.order.wrestlers'
]

/** Great Spire before the Search: its Cards row, with the Dispossessed filled or empty. */
export function greatSpireMenuTable(empty = false): PlayedTable {
    return tableOf(spireState(empty ? [] : SIX_DISPOSSESSED))
}

/**
 * Great Spire declared on a Search of the world deck: Augury, Bear Traps and A Round of Ale drawn,
 * the swap step next. With `vision`, the draw is Augury, Bear Traps and a Vision, and the
 * Dispossessed holds one card.
 */
export function greatSpireSwapTable(vision = false): PlayedTable {
    const state = spireState(vision ? ['denizen.discord.assassin'] : SIX_DISPOSSESSED)
    state.requireVault().worldDeck = vision
        ? ['denizen.arcane.augury', 'denizen.order.bear-traps', 'vision.faith']
        : [
              'denizen.arcane.augury',
              'denizen.order.bear-traps',
              'denizen.hearth.a-round-of-ale',
              'denizen.beast.wolves'
          ]
    const table = tableOf(state)
    return played(table, [
        createAction(Search, {
            ...envelope(table),
            playerId: 'ann',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [{ cardId: SPIRE, powerIndex: 0 }]
        })
    ])
}

/** Game 5: Fallen Spire at the Great Slum; the Provinces pile holds `pile` cards, the Dispossessed six. */
export function fallenSpireTable(pile = 5): PlayedTable {
    const state = spireState(SIX_DISPOSSESSED, true)
    state.discardPileCounts[Region.Provinces] = pile
    state.requireVault().discardPiles[Region.Provinces] = [
        'denizen.order.encirclement',
        'denizen.beast.bracken',
        'denizen.hearth.charming-friend',
        'denizen.beast.wild-cry',
        'denizen.discord.gossip'
    ].slice(0, pile)
    return tableOf(state)
}

/**
 * Game 5, the end of round 6: Dana, Chancellor and Oathkeeper, rolled a 5; Rhys rules Squalid
 * District at Fertile Valley, so they are asked (R-3.3; its Q&A). Hotseat shows Rhys. Dana holds
 * the Grand Scepter and every card of the game is somewhere, so a win runs the chronicle to its
 * result (R-8.5, R-8.6.1).
 */
export function squalidAskedTable(): PlayedTable {
    const state = scene({
        on: 'dana',
        at: { rhys: VALLEY },
        round: 6,
        warbands: { [VALLEY]: { rhys: 2 } },
        over: { dana: { relicIds: [GRAND_SCEPTER] } }
    })
    placeEdifice(state, VALLEY, DISTRICT, { ruined: true })
    wholeWorld(state)
    state.oathkeeperPlayerId = 'dana'
    state.machineState = MachineState.PowerQuestion
    state.pendingQuestions = {
        queue: [
            {
                kind: PowerQuestionKind.AdjustEndDie,
                cardId: DISTRICT,
                askedPlayerId: 'rhys',
                roll: 5,
                round: 6,
                threshold: 5
            }
        ],
        askingPlayerId: 'dana',
        resumeMachineState: MachineState.EndOfRound
    }
    state.activePlayerIds = ['rhys']
    return tableOf(state)
}

/** Festival District at Fertile Valley, where Ann stands; Rhys holds a faceup and a facedown adviser. */
export function festivalTable(): PlayedTable {
    const state = scene({
        on: 'ann',
        at: { ann: VALLEY },
        over: {
            ann: { advisers: [{ cardId: 'denizen.nomad.tents', faceUp: true }] },
            rhys: {
                advisers: [{ cardId: 'denizen.nomad.elders', faceUp: true }, { faceUp: false }],
                adviserIds: ['denizen.nomad.elders', 'denizen.hearth.a-round-of-ale'],
                relicIds: [CUP]
            }
        }
    })
    placeEdifice(state, VALLEY, DISTRICT)
    return tableOf(state)
}

/**
 * Bandit Rampart at Standing Stones. `defender`: Rhys rules it and Dana attacks him there, so Rhys
 * picks his plans. Otherwise the bandits rule it and Rhys attacks them: they use it unasked.
 */
export function banditRampartTable(defender: boolean): PlayedTable {
    const state = defender
        ? scene({
              on: 'dana',
              at: { dana: STONES, rhys: STONES },
              over: { dana: { warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 } } },
              warbands: { [STONES]: { rhys: 2 } }
          })
        : scene({ on: 'rhys', at: { rhys: STONES } })
    placeEdifice(state, STONES, RAMPART, { ruined: true })
    const table = tableOf(state)
    return played(table, [
        createAction(Campaign, {
            ...envelope(table),
            playerId: defender ? 'dana' : 'rhys',
            defender: defender ? { kind: 'player', playerId: 'rhys' } : { kind: 'bandits' },
            targets: [{ kind: CampaignTargetKind.Site, siteId: STONES }],
            attackDice: 3
        })
    ])
}

/**
 * Ruined Temple at the Plains, which Dana rules; Rhys, an Exile and so her enemy (R-10.7), has
 * searched and drawn Wolves (a beast card), Tents and Augury. With `intact`, Forest Temple stands
 * there instead and forbids nothing.
 */
export function ruinedTempleTable(intact = false): PlayedTable {
    const state = scene({ on: 'rhys', at: { rhys: SLUM } })
    placeEdifice(state, PLAINS, TEMPLE, { ruined: !intact })
    state.requireVault().worldDeck = [
        'denizen.beast.wolves',
        'denizen.nomad.tents',
        'denizen.arcane.augury'
    ]
    state.denizensBySite[SLUM] = ['denizen.hearth.rowdy-pub']
    const table = tableOf(state)
    return played(table, [
        createAction(Search, {
            ...envelope(table),
            playerId: 'rhys',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true
        })
    ])
}
