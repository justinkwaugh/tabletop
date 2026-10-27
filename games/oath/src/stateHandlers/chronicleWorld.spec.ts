import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    Color,
    Visibility,
    assertExists,
    latestPlayerUndoTarget,
    type GameAction
} from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { served, spectator } from '../testing/projection.js'
import { wonTable } from '../testing/chronicle.js'
import { chronicleCensus, wholeWorld } from '../testing/chronicleWorld.js'
import { favorCensus, warbandCensus } from '../testing/census.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { CardKind, OathType, PlayerStatus, Region, Suit } from '../model/oathEnums.js'
import type { AdviserRow, OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS, type WarbandCounts } from '../model/warbandCounts.js'
import { ChronicleStep, type TableRecord } from '../model/chronicle.js'
import type { OathVault } from '../model/vault.js'
import { WinKind } from '../model/ending.js'
import { allMapSlots, mapSlotsFor } from '../data/mapSlots.js'
import { PRINTED_DENIZENS_BY_SUIT, kindOf } from '../data/cardRegistry.js'
import { GRAND_SCEPTER_ID, OBSIDIAN_CAGE_ID } from '../data/relics.js'
import { FAVOR_BANK_ORDER } from '../data/favorBanks.js'
import { ChooseOath } from '../actions/chooseOath.js'
import { OfferChronicleCitizenship } from '../actions/offerChronicleCitizenship.js'
import { BuildOrRepairEdifice } from '../actions/buildOrRepairEdifice.js'
import { ChooseChronicleSuit } from '../actions/chooseChronicleSuit.js'
import { ChooseHealStack } from '../actions/chooseHealStack.js'
import { SkipChronicleStory } from '../actions/skipChronicleStory.js'
import { ChronicleShuffle, chronicleShuffles } from '../util/chronicleRandom.js'
import { archiveBySuit } from '../util/chronicleCards.js'
import { clearMap, discardSites, fillSlots, ruinAndSetAside } from '../util/chronicleMap.js'
import { buildOrRepair, edificeChoiceNamed } from '../util/chronicleChoices.js'
import { OathRevision } from '../util/revision.js'
import type { GameOutcome } from '../util/victory.js'
import '../powers/index.js'

// The Law's examples for R-8.3.2 to R-8.8, each scene as the Law's steps meet it: every random
// step's outcome is given, and every line the steps produce is asserted.

const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const TABLE: TableRecord = {
    name: 'Thursday table',
    date: '2026-10-27',
    seatNames: { dana: 'Dana', rhys: 'Rhys', ann: 'Ann' }
}

const [C1, C2] = mapSlotsFor(Region.Cradle)
const [P1, P2, P3] = mapSlotsFor(Region.Provinces)
const [H1, H2, H3] = mapSlotsFor(Region.Hinterland)
const SLOTS = [C1, C2, P1, P2, P3, H1, H2, H3]

const den = (id: string) => `denizen.${id}`
const site = (id: string) => `site.${id}`
const relic = (id: string) => `relic.${id}`
const FESTIVAL = 'edifice.discord.festival-district'
const GREAT_SPIRE = 'edifice.arcane.great-spire'
const HALL = 'edifice.hearth.hall-of-debate'
const FOREST_TEMPLE = 'edifice.beast.forest-temple'
const FORGE = 'edifice.nomad.ancient-forge'
const RAMPART = 'edifice.order.sprawling-rampart'

const faceup = (cardId: string): AdviserRow => ({ cardId, faceUp: true })
const facedown = (cardId: string): AdviserRow => ({ cardId, faceUp: false })

const CHANCELLOR_WINS: GameOutcome = {
    winnerPlayerId: DANA,
    kind: WinKind.StableRegime,
    rule: 'R-3.3'
}

/** A site in a slot as a scene sets it out. */
interface SiteScene {
    site: string
    facedown?: true
    cards?: string[]
    /** Edifices among `cards` on their ruined side. */
    ruined?: string[]
    relics?: string[]
    warbands?: WarbandCounts
}

interface Scene {
    players: OathPlayerState[]
    oathType: OathType
    sites: Record<string, SiteScene>
    reliquary?: string[]
    relicDeck?: string[]
    worldDeck?: string[]
    discards?: Partial<Record<Region, string[]>>
    dispossessed?: string[]
    boxIds?: string[]
    overrides?: Partial<OathProjectedState>
}

function seat(
    playerId: string,
    color: Color,
    status: PlayerStatus,
    overrides: Partial<OathPlayerState> = {}
): OathPlayerState {
    return testPlayer({ playerId, color, status, siteId: C1, ...overrides })
}

/** A game at its end, at the chronicle revision, laid out as `scene` says; the rest of the world as a game keeps it. */
function scene(spec: Scene): HydratedOathGameState {
    const siteCards: Record<string, string> = {}
    const siteFacedown: Record<string, string> = {}
    const denizensBySite: Record<string, string[]> = {}
    const relicsBySite: Record<string, { slotId: string }[]> = {}
    const relicFacedown: Record<string, string> = {}
    const warbandsBySite: Record<string, WarbandCounts> = {}
    const ruined: string[] = []
    for (const [slotId, at] of Object.entries(spec.sites)) {
        if (at.facedown) siteFacedown[slotId] = at.site
        else siteCards[slotId] = at.site
        if (at.cards) denizensBySite[slotId] = at.cards
        ruined.push(...(at.ruined ?? []))
        if (at.relics) {
            relicsBySite[slotId] = at.relics.map((relicCardId, k) => {
                relicFacedown[`${slotId}.relic.${k}`] = relicCardId
                return { slotId: `${slotId}.relic.${k}` }
            })
        }
        if (at.warbands) warbandsBySite[slotId] = at.warbands
    }
    const reliquary = (spec.reliquary ?? []).map((relicCardId, k) => {
        relicFacedown[`reliquary.${k}`] = relicCardId
        return { slotId: `reliquary.${k}` }
    })
    const discardPiles: Record<Region, string[]> = {
        [Region.Cradle]: spec.discards?.[Region.Cradle] ?? [],
        [Region.Provinces]: spec.discards?.[Region.Provinces] ?? [],
        [Region.Hinterland]: spec.discards?.[Region.Hinterland] ?? []
    }
    const vault: OathVault = {
        worldDeck: [...(spec.worldDeck ?? [])],
        discardPiles,
        siteFacedown,
        relicFacedown,
        relicDeck: [...(spec.relicDeck ?? [])],
        siteDeck: [],
        dispossessed: [...(spec.dispossessed ?? [])]
    }
    const state = wholeWorld(
        testState(spec.players, {
            oathRevision: OathRevision.Chronicle,
            table: TABLE,
            oathType: spec.oathType,
            map: allMapSlots(),
            siteCards,
            denizensBySite,
            relicsBySite,
            warbandsBySite,
            reliquary,
            ...(ruined.length > 0 ? { ruinedEdificeIds: ruined } : {}),
            boxIds: spec.boxIds ?? [],
            discardPileCounts: {
                [Region.Cradle]: discardPiles[Region.Cradle].length,
                [Region.Provinces]: discardPiles[Region.Provinces].length,
                [Region.Hinterland]: discardPiles[Region.Hinterland].length
            },
            dispossessedCount: vault.dispossessed.length,
            worldDeckVisions: vault.worldDeck.filter((id) => kindOf(id) === CardKind.Vision).length,
            vault,
            ...spec.overrides
        })
    )
    // R-6.4-H1 — the Grand Scepter's holder knows every relic in the Reliquary.
    const holder = state.relicHolderOf(GRAND_SCEPTER_ID)
    for (const slot of reliquary) holder?.recordPeek(slot.slotId, relicFacedown[slot.slotId])
    return state
}

/**
 * The given random outcomes: the next shuffle of each kind puts the given cards first, in the
 * order given, and leaves the rest as they lay. Returns what each shuffle was given, in order.
 */
function given(outcomes: Partial<Record<ChronicleShuffle, string[][]>>) {
    const queues = new Map<string, string[][]>()
    const shuffled = new Map<string, string[][]>()
    for (const which of Object.values(ChronicleShuffle)) {
        queues.set(which, [...(outcomes[which] ?? [])])
        shuffled.set(which, [])
    }
    vi.spyOn(chronicleShuffles, 'shuffle').mockImplementation((_state, which, cardIds) => {
        shuffled.get(which)?.push([...cardIds])
        const first = queues.get(which)?.shift() ?? []
        for (const cardId of first)
            if (!cardIds.includes(cardId)) throw Error(`${which}: ${cardId} is not being shuffled`)
        const rest = cardIds.filter((cardId) => !first.includes(cardId))
        cardIds.splice(0, cardIds.length, ...first, ...rest)
    })
    return (which: ChronicleShuffle) => shuffled.get(which) ?? []
}

afterEach(() => {
    vi.restoreAllMocks()
})

type Played = { final: OathProjectedState; actions: GameAction[] }

function run(state: OathProjectedState, ...steps: GameAction[]): Played {
    const game = testGame(state.players.map((player) => player.playerId))
    let final = state
    const actions: GameAction[] = []
    for (const step of steps) {
        const result = engine.runNext(step, final, game)
        actions.push(...result.processedActions)
        final = result.updatedState
    }
    return { final, actions }
}

const hydrated = (state: OathProjectedState) => new HydratedOathGameState(state)

const vow = (playerId: string, oathType: OathType) =>
    buildAction(ChooseOath, { id: 'vow', playerId, oathType })
const offer = (playerId: string, exilePlayerIds: string[]) =>
    buildAction(OfferChronicleCitizenship, { id: 'offer', playerId, exilePlayerIds })
const build = (playerId: string, choice?: { siteId: string; cardId: string }) =>
    buildAction(BuildOrRepairEdifice, { id: 'build', playerId, ...(choice ? { choice } : {}) })
const suit = (playerId: string, chosen: Suit) =>
    buildAction(ChooseChronicleSuit, { id: 'suit', playerId, suit: chosen })
const heal = (playerId: string, chosen: Suit) =>
    buildAction(ChooseHealStack, { id: 'heal', playerId, suit: chosen })
const skip = (playerId: string) => buildAction(SkipChronicleStory, { id: 'skip', playerId })

/** The eight slots, top Cradle first: each site with its facing, its cards and its relics. */
function stack(state: OathProjectedState) {
    const vault = state.vault
    assertExists(vault, 'the host holds the vault')
    return SLOTS.map((slotId) => {
        const faceupCard = state.siteCards[slotId]
        return {
            site: faceupCard ?? vault.siteFacedown[slotId],
            faceup: faceupCard !== undefined,
            cards: (state.denizensBySite[slotId] ?? []).map((cardId) =>
                state.ruinedEdificeIds?.includes(cardId) ? `${cardId} (ruined)` : cardId
            ),
            relics: (state.relicsBySite[slotId] ?? []).map(
                (slot) => vault.relicFacedown[slot.slotId]
            )
        }
    })
}

const at = (siteId: string, faceup: boolean, cards: string[] = [], relics: string[] = []) => ({
    site: site(siteId),
    faceup,
    cards,
    relics
})

/** The Archive's size by suit. */
function archiveCounts(state: OathProjectedState): Record<Suit, number> {
    const archive = archiveBySuit(hydrated(state))
    return {
        [Suit.Discord]: archive[Suit.Discord].length,
        [Suit.Arcane]: archive[Suit.Arcane].length,
        [Suit.Order]: archive[Suit.Order].length,
        [Suit.Hearth]: archive[Suit.Hearth].length,
        [Suit.Beast]: archive[Suit.Beast].length,
        [Suit.Nomad]: archive[Suit.Nomad].length
    }
}

/** The edifices at no site: the Archive's. */
function archiveEdifices(state: OathProjectedState): string[] {
    const atSites = new Set(Object.values(state.denizensBySite).flat())
    return [FESTIVAL, GREAT_SPIRE, HALL, FOREST_TEMPLE, FORGE, RAMPART].filter(
        (edificeId) => !atSites.has(edificeId)
    )
}

const vaultOf = (state: OathProjectedState): OathVault => {
    assertExists(state.vault, 'the host holds the vault')
    return state.vault
}

// ---------------------------------------------------------------------------------------------
// The full boundary: game 2 of a chronicle, from its end to the world game 3 is dealt from

/** Game 2 at its end: Dana, the Chancellor, won by a Stable Regime under Supremacy. */
function gameTwoEnd(): HydratedOathGameState {
    return scene({
        oathType: OathType.Supremacy,
        players: [
            seat(DANA, Color.Purple, PlayerStatus.Chancellor, {
                advisers: [
                    faceup(den('order.knights-errant')),
                    faceup(den('hearth.land-warden')),
                    facedown(den('arcane.alchemist'))
                ],
                relicIds: [GRAND_SCEPTER_ID, relic('dragonskin-drum')]
            }),
            seat(RHYS, Color.Red, PlayerStatus.Exile, {
                advisers: [
                    faceup(den('beast.giant-python')),
                    faceup(den('order.palanquin')),
                    facedown(den('nomad.rain-boots'))
                ],
                relicIds: [relic('sticky-fire')],
                revealedVisionId: 'vision.conquest'
            }),
            seat(ANN, Color.Yellow, PlayerStatus.Exile, {
                advisers: [
                    facedown('vision.faith'),
                    faceup(den('hearth.marriage')),
                    faceup(den('arcane.tutor'))
                ],
                relicIds: [relic('circlet-of-command')]
            })
        ],
        sites: {
            [C1]: {
                site: site('fertile-valley'),
                cards: [den('hearth.armed-mob'), den('order.curfew')],
                warbands: { [IMPERIAL_WARBANDS]: 2 }
            },
            [C2]: {
                site: site('the-tribunal'),
                cards: [den('order.forced-labor')],
                relics: [relic('oracular-pig')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [P1]: {
                site: site('steppe'),
                cards: [FORGE, den('nomad.great-herd')],
                relics: [relic('brass-horse')],
                warbands: { [ANN]: 2 }
            },
            [P2]: {
                site: site('great-slums'),
                cards: [den('discord.gambling-hall'), den('beast.roving-terror')],
                warbands: { [RHYS]: 1 }
            },
            [P3]: {
                site: site('mountain'),
                cards: [den('order.toll-roads')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [H1]: {
                site: site('deep-woods'),
                cards: [den('beast.walled-garden')],
                relics: [relic('cup-of-plenty')]
            },
            [H2]: { site: site('river'), facedown: true },
            [H3]: {
                site: site('lush-coast'),
                cards: [den('nomad.oracle'), den('hearth.hospital'), den('arcane.wizard-school')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            }
        },
        reliquary: [
            relic('ring-of-devotion'),
            OBSIDIAN_CAGE_ID,
            relic('grand-mask'),
            relic('truthful-harp')
        ],
        relicDeck: [
            'bandit-crown',
            'book-of-records',
            'cracked-horn',
            'cursed-cauldron',
            'dowsing-sticks',
            'horned-mask',
            'ivory-eye',
            'map',
            'skeleton-key',
            'whistle'
        ].map(relic),
        discards: {
            [Region.Cradle]: [
                'discord.blackmail',
                'beast.bracken',
                'hearth.crop-rotation',
                'order.bear-traps',
                'arcane.augury'
            ].map(den),
            [Region.Provinces]: [
                'discord.charlatan',
                'beast.errand-boy',
                'hearth.deed-writer',
                'order.garrison',
                'nomad.elders',
                'arcane.bewitch'
            ].map(den),
            [Region.Hinterland]: [
                'discord.dissent',
                'beast.rangers',
                'hearth.homesteaders',
                'order.messenger'
            ].map(den)
        },
        worldDeck: [
            ...[
                'arcane.dazzle',
                'arcane.jinx',
                'arcane.revelation',
                'beast.wolves',
                'beast.wild-cry',
                'beast.second-chance',
                'discord.riots',
                'discord.scryer',
                'discord.zealots',
                'hearth.levelers',
                'hearth.storyteller',
                'hearth.tavern-songs',
                'nomad.lancers',
                'nomad.tents',
                'nomad.rival-khan',
                'nomad.storm-caller',
                'order.outriders',
                'order.scouts',
                'order.shield-wall',
                'order.wrestlers'
            ].map(den),
            'vision.rebellion',
            'vision.sanctuary'
        ],
        boxIds: ['vision.conspiracy'],
        dispossessed: [
            'discord.cracked-sage',
            'discord.downtrodden',
            'arcane.fire-talkers',
            'nomad.mountain-giant',
            'beast.fae-merchant',
            'hearth.salad-days'
        ].map(den)
    })
}

/** The rebuild's given shuffle of the 48 denizens, top first. */
const POOL_ORDER = [
    'order.bear-traps',
    'hearth.levelers',
    'discord.blackmail',
    'order.toll-roads',
    'order.wrestlers',
    'hearth.tavern-songs',
    'arcane.dazzle',
    'nomad.tents',
    'discord.gambling-hall',
    'order.knights-errant',
    'hearth.deed-writer',
    'discord.scryer',
    'order.scouts',
    'nomad.elders',
    'arcane.jinx',
    'beast.giant-python',
    'beast.walled-garden',
    'nomad.great-herd',
    'arcane.revelation',
    'hearth.storyteller',
    'hearth.fabled-feast',
    'discord.riots',
    'beast.wolves',
    'hearth.land-warden',
    'beast.bracken',
    'arcane.bewitch',
    'beast.rangers',
    'order.messenger',
    'hearth.news-from-afar',
    'nomad.rival-khan',
    'beast.new-growth',
    'order.shield-wall',
    'discord.dissent',
    'beast.second-chance',
    'nomad.lancers',
    'discord.zealots',
    'hearth.crop-rotation',
    'nomad.storm-caller',
    'order.outriders',
    'arcane.alchemist',
    'arcane.tutor',
    'nomad.horse-archers',
    'hearth.homesteaders',
    'hearth.traveling-doctor',
    'beast.forest-paths',
    'order.palanquin',
    'beast.wild-cry',
    'beast.errand-boy'
].map(den)
const S = (k: number) => POOL_ORDER[k]
const range = (from: number, to: number) => POOL_ORDER.slice(from, to + 1)
const TOP_PILE = [
    S(0),
    S(1),
    S(2),
    'vision.rebellion',
    S(3),
    S(4),
    S(5),
    S(6),
    'vision.faith',
    S(7),
    S(8),
    S(9)
]
const SECOND_PILE = [
    S(10),
    S(11),
    'vision.conquest',
    ...range(12, 16),
    'vision.conspiracy',
    ...range(17, 21),
    'vision.sanctuary',
    S(22),
    S(23),
    S(24)
]

const GAME_TWO_GIVEN: Partial<Record<ChronicleShuffle, string[][]>> = {
    [ChronicleShuffle.SiteDeck]: [['buried-giant', 'river', 'charming-valley'].map(site)],
    [ChronicleShuffle.Archive]: [
        ['hearth.fabled-feast', 'hearth.news-from-afar', 'hearth.traveling-doctor'].map(den),
        ['beast.forest-paths', 'beast.new-growth'].map(den),
        [den('nomad.horse-archers')]
    ],
    [ChronicleShuffle.Dispossess]: [
        [
            'discord.charlatan',
            'beast.roving-terror',
            'hearth.marriage',
            'order.garrison',
            'nomad.rain-boots',
            'arcane.augury'
        ].map(den)
    ],
    [ChronicleShuffle.RelicDeck]: [
        [
            'ivory-eye',
            'whistle',
            'sticky-fire',
            'map',
            'bandit-crown',
            'cup-of-plenty',
            'horned-mask',
            'cracked-horn',
            'circlet-of-command',
            'skeleton-key',
            'book-of-records',
            'dowsing-sticks',
            'cursed-cauldron'
        ].map(relic)
    ],
    [ChronicleShuffle.RelicStack]: [
        ['obsidian-cage', 'dragonskin-drum', 'truthful-harp', 'ring-of-devotion', 'grand-mask'].map(
            relic
        )
    ],
    [ChronicleShuffle.Rebuild]: [
        POOL_ORDER,
        ['vision.rebellion', 'vision.faith'],
        TOP_PILE,
        SECOND_PILE
    ]
}

/** Game 2's chronicle up to its build: Dana vows The People; nothing has been drawn yet. */
function gameTwoAtTheBuild(): Played {
    return run(wonTable(gameTwoEnd(), CHANCELLOR_WINS), vow(DANA, OathType.ThePeople))
}

const BUILD_AT_MOUNTAIN = build(DANA, { siteId: P3, cardId: den('order.toll-roads') })

describe('the full boundary: game 2 of a chronicle to the world game 3 is dealt from', () => {
    it('the input holds every card once, and the Vow waits on Dana with nothing drawn', () => {
        const start = gameTwoEnd()
        expect(archiveCounts(start.dehydrate())).toEqual({
            [Suit.Arcane]: 24,
            [Suit.Beast]: 23,
            [Suit.Discord]: 24,
            [Suit.Hearth]: 22,
            [Suit.Nomad]: 24,
            [Suit.Order]: 21
        })
        expect(archiveEdifices(start.dehydrate())).toEqual([
            FESTIVAL,
            GREAT_SPIRE,
            HALL,
            FOREST_TEMPLE,
            RAMPART
        ])
        expect(vaultOf(start.dehydrate()).siteDeck).toHaveLength(15)
        const { final, actions } = gameTwoAtTheBuild()
        expect(final.chronicle?.step).toBe(ChronicleStep.BuildOrRepair)
        expect(actions.every((action) => !action.revealsInfo)).toBe(true)
        // Before the first draw the Vow is still Dana's to undo (R-X.3).
        expect(latestPlayerUndoTarget(actions, DANA)?.type).toBe(ActionType.ChooseOath)
    })

    it('R-8.3.2 to R-8.3.5, step by step on the map as the build leaves it', () => {
        given(GAME_TWO_GIVEN)
        const state = hydrated(gameTwoAtTheBuild().final)
        const vault = state.requireVault()
        buildOrRepair(
            state,
            edificeChoiceNamed(state, { siteId: P3, cardId: den('order.toll-roads') })
        )

        // 8.3.2
        expect(discardSites(state)).toEqual({
            kept: ['fertile-valley', 'the-tribunal', 'steppe', 'mountain', 'lush-coast'].map(site),
            discarded: ['great-slums', 'deep-woods'].map(site),
            discardedFacedown: 1,
            denizensDiscarded: 3
        })
        expect(vault.siteDeck).toHaveLength(18)
        expect(vault.siteDeck.slice(0, 3)).toEqual(
            ['buried-giant', 'river', 'charming-valley'].map(site)
        )
        expect(vault.relicDeck).toHaveLength(11)
        expect(vault.relicDeck).toContain(relic('cup-of-plenty'))
        expect([...vault.discardPiles[Region.Cradle]].sort()).toEqual(
            [
                'discord.blackmail',
                'beast.bracken',
                'hearth.crop-rotation',
                'order.bear-traps',
                'arcane.augury',
                'discord.gambling-hall',
                'beast.roving-terror',
                'beast.walled-garden'
            ]
                .map(den)
                .sort()
        )

        // 8.3.3
        expect(ruinAndSetAside(state)).toEqual({
            ruins: [{ edificeId: FORGE, siteCardId: site('steppe'), denizensDiscarded: 1 }],
            setAside: [P1]
        })
        expect(state.denizensAt(P1)).toEqual([FORGE])
        expect(state.isRuined(FORGE)).toBe(true)
        expect(vault.discardPiles[Region.Cradle]).toHaveLength(9)
        expect(state.discardPileCounts[Region.Cradle]).toBe(9)

        // 8.3.4
        const pieces = { favor: favorCensus(state), warbands: warbandCensus(state) }
        clearMap(state)
        expect(state.warbandsBySite).toEqual({})
        expect(state.players.map((player) => player.siteId)).toEqual([
            undefined,
            undefined,
            undefined
        ])
        expect({ favor: favorCensus(state), warbands: warbandCensus(state) }).toEqual(pieces)

        // 8.3.5
        expect(fillSlots(state, [P1])).toEqual({
            moved: [
                { siteCardId: site('mountain'), from: P3, to: P1 },
                { siteCardId: site('lush-coast'), from: H3, to: P2 },
                { siteCardId: site('steppe'), from: P1, to: H3 }
            ],
            dealt: [P3, H1, H2],
            flipped: []
        })
    })

    it('the build runs R-8.3.2 to R-8.3.5: the map is the positional stack, and nothing can be undone', () => {
        given(GAME_TWO_GIVEN)
        const { final, actions } = run(gameTwoAtTheBuild().final, BUILD_AT_MOUNTAIN)
        expect(final.chronicle?.step).toBe(ChronicleStep.Suit)
        expect(final.activePlayerIds).toEqual([DANA])
        expect(stack(final)).toEqual([
            at('fertile-valley', true, [den('hearth.armed-mob'), den('order.curfew')]),
            at('the-tribunal', true, [den('order.forced-labor')], [relic('oracular-pig')]),
            at('mountain', true, [RAMPART]),
            at('lush-coast', true, [
                den('nomad.oracle'),
                den('hearth.hospital'),
                den('arcane.wizard-school')
            ]),
            at('buried-giant', false),
            at('river', false),
            at('charming-valley', false),
            at('steppe', true, [`${FORGE} (ruined)`], [relic('brass-horse')])
        ])
        expect(final.chronicle?.map).toMatchObject({
            ruins: [{ edificeId: FORGE, siteCardId: site('steppe'), denizensDiscarded: 1 }],
            dealt: [P3, H1, H2],
            flipped: []
        })
        expect(archiveEdifices(final)).toEqual([FESTIVAL, GREAT_SPIRE, HALL, FOREST_TEMPLE])
        expect(final.chronicle?.returnedDenizenId).toBe(den('order.toll-roads'))
        expect(actions[0].revealsInfo).toBe(true)
        expect(latestPlayerUndoTarget(actions, DANA)).toBeUndefined()
    })

    it('R-8.4 to R-8.8 after the suit: the carried world, line for line', () => {
        const shuffled = given(GAME_TWO_GIVEN)
        const built = run(gameTwoAtTheBuild().final, BUILD_AT_MOUNTAIN).final
        const { final, actions } = run(built, suit(DANA, Suit.Hearth))
        const vault = vaultOf(final)
        expect(actions[0].revealsInfo).toBe(true)
        expect(final.chronicle?.step).toBe(ChronicleStep.Story)

        // 8.4
        expect(final.chronicle?.added).toEqual({ suits: [Suit.Hearth, Suit.Beast, Suit.Nomad] })
        expect(final.chronicle?.healTie).toBeUndefined()
        expect(archiveCounts(final)).toEqual({
            [Suit.Arcane]: 24,
            [Suit.Beast]: 21,
            [Suit.Discord]: 24,
            [Suit.Hearth]: 19,
            [Suit.Nomad]: 23,
            [Suit.Order]: 21
        })
        // 8.5 — the piles and the losers' advisers, never the winner's; Faith is set aside.
        const [dispossessPool] = shuffled(ChronicleShuffle.Dispossess)
        expect([...dispossessPool].sort()).toEqual(
            [
                'discord.blackmail',
                'beast.bracken',
                'hearth.crop-rotation',
                'order.bear-traps',
                'arcane.augury',
                'discord.gambling-hall',
                'beast.roving-terror',
                'beast.walled-garden',
                'nomad.great-herd',
                'discord.charlatan',
                'beast.errand-boy',
                'hearth.deed-writer',
                'order.garrison',
                'nomad.elders',
                'arcane.bewitch',
                'discord.dissent',
                'beast.rangers',
                'hearth.homesteaders',
                'order.messenger',
                'beast.giant-python',
                'order.palanquin',
                'nomad.rain-boots',
                'hearth.marriage',
                'arcane.tutor'
            ]
                .map(den)
                .sort()
        )
        expect(final.chronicle?.dispossessed).toBe(6)
        expect(vault.dispossessed).toEqual(
            [
                'discord.cracked-sage',
                'discord.downtrodden',
                'arcane.fire-talkers',
                'nomad.mountain-giant',
                'beast.fae-merchant',
                'hearth.salad-days',
                'discord.charlatan',
                'beast.roving-terror',
                'hearth.marriage',
                'order.garrison',
                'nomad.rain-boots',
                'arcane.augury'
            ].map(den)
        )
        expect(final.dispossessedCount).toBe(12)
        // 8.6
        expect(final.boxIds).toEqual([GRAND_SCEPTER_ID])
        expect(final.chronicle?.relics).toEqual({
            returned: [
                { playerId: RHYS, count: 1 },
                { playerId: ANN, count: 1 }
            ],
            placed: [{ slotId: P1, count: 1 }],
            stacked: { winner: 1, reliquary: 4 }
        })
        expect(stack(final).map((slot) => slot.relics)).toEqual([
            [],
            [relic('oracular-pig')],
            [relic('ivory-eye')],
            [],
            [],
            [],
            [],
            [relic('brass-horse')]
        ])
        expect(vault.relicDeck).toEqual(
            [
                'obsidian-cage',
                'dragonskin-drum',
                'truthful-harp',
                'ring-of-devotion',
                'grand-mask',
                'whistle',
                'sticky-fire',
                'map',
                'bandit-crown',
                'cup-of-plenty',
                'horned-mask',
                'cracked-horn',
                'circlet-of-command',
                'skeleton-key',
                'book-of-records',
                'dowsing-sticks',
                'cursed-cauldron'
            ].map(relic)
        )
        expect(final.reliquary).toEqual([])
        // 8.7 — the boards keep their sides: every Exile board is on its Exile side.
        expect(final.players.map((player) => player.status)).toEqual([
            PlayerStatus.Chancellor,
            PlayerStatus.Exile,
            PlayerStatus.Exile
        ])
        expect(final.boxedCitizenColors).toBeUndefined()
        // 8.8
        expect(final.chronicle?.rebuilt).toBe(true)
        expect(vault.worldDeck).toEqual([...TOP_PILE, ...SECOND_PILE, ...range(25, 47)])
        expect(final.worldDeckVisions).toBe(5)
        expect(final.topCardBackType).toBe(CardKind.Denizen)
        expect(final.chronicle?.returnedDenizenId).toBeUndefined()
        expect(chronicleCensus(hydrated(final))).toEqual([])
    })

    it('the rebuild takes the 48 denizens still in play, 10 with 2 Visions over 15 with 3 over the rest', () => {
        given(GAME_TWO_GIVEN)
        const built = run(gameTwoAtTheBuild().final, BUILD_AT_MOUNTAIN).final
        const deck = vaultOf(run(built, suit(DANA, Suit.Hearth)).final).worldDeck
        expect(deck).toHaveLength(53)
        expect([...deck.filter((id) => kindOf(id) === CardKind.Denizen)].sort()).toEqual(
            [...POOL_ORDER].sort()
        )
        const visionsIn = (cards: string[]) => cards.filter((id) => kindOf(id) === CardKind.Vision)
        expect(visionsIn(deck.slice(0, 12))).toHaveLength(2)
        expect(visionsIn(deck.slice(12, 30))).toHaveLength(3)
        expect(visionsIn(deck.slice(30))).toHaveLength(0)
    })

    it('the entry: the next Oath, the suits added, the edifice built and the one ruined', () => {
        given(GAME_TWO_GIVEN)
        const built = run(gameTwoAtTheBuild().final, BUILD_AT_MOUNTAIN).final
        const { final } = run(built, suit(DANA, Suit.Hearth), skip(DANA))
        expect(final.machineState).toBe(MachineState.EndOfGame)
        expect(final.chronicleRecord?.at(-1)).toEqual({
            gameNumber: 1,
            sessionName: 'Thursday table',
            date: '2026-10-27',
            startingOath: OathType.Supremacy,
            mark: 'O',
            kind: WinKind.StableRegime,
            rule: 'R-3.3',
            winner: { name: 'Dana', color: Color.Purple },
            nextOath: OathType.ThePeople,
            added: { suits: [Suit.Hearth, Suit.Beast, Suit.Nomad] },
            built: { edificeId: RAMPART, siteId: P3, repaired: false },
            ruined: [FORGE]
        })
        expect(chronicleCensus(hydrated(final))).toEqual([])
    })

    it('every piece goes back: favor and warbands are counted the same at the end', () => {
        const start = gameTwoEnd()
        const pieces = { favor: favorCensus(start), warbands: warbandCensus(start) }
        const built = run(gameTwoAtTheBuild().final, BUILD_AT_MOUNTAIN).final
        const final = hydrated(run(built, suit(DANA, Suit.Hearth), skip(DANA)).final)
        expect({ favor: favorCensus(final), warbands: warbandCensus(final) }).toEqual(pieces)
    })
})

describe('hidden information through the steps (R-9.4)', () => {
    const PERSPECTIVES: Visibility.Perspective[] = [
        { kind: 'player', playerId: DANA },
        { kind: 'player', playerId: RHYS },
        { kind: 'player', playerId: ANN },
        spectator
    ]

    it('no seat and no spectator is served a facedown site, a relic drawn or a card dispossessed; the counts are public', () => {
        given(GAME_TWO_GIVEN)
        const built = run(gameTwoAtTheBuild().final, BUILD_AT_MOUNTAIN).final
        const ended = run(built, suit(DANA, Suit.Hearth)).final
        const dealt = ['buried-giant', 'river', 'charming-valley'].map(site)
        const hiddenAt: [OathProjectedState, string[]][] = [
            [built, dealt],
            [
                ended,
                [
                    ...dealt,
                    ...vaultOf(ended).dispossessed.slice(6),
                    ...Object.values(vaultOf(ended).relicFacedown),
                    ...vaultOf(ended).relicDeck
                ]
            ]
        ]
        for (const [state, hidden] of hiddenAt) {
            const views = PERSPECTIVES.map((perspective) => served(state, perspective))
            for (const view of views) {
                expect(view.vault).toBeUndefined()
                const json = JSON.stringify(view)
                expect(hidden.filter((cardId) => json.includes(`"${cardId}"`))).toEqual([])
                // The public result is the same on every view.
                expect(view.chronicle).toEqual(state.chronicle)
                expect(view.siteCards).toEqual(state.siteCards)
                expect(view.relicsBySite).toEqual(state.relicsBySite)
                expect(view.chronicle?.healTie).toBeUndefined()
            }
        }
        const view = served(ended, spectator)
        expect(view.dispossessedCount).toBe(12)
        expect(view.discardPileCounts).toEqual({
            [Region.Cradle]: 0,
            [Region.Provinces]: 0,
            [Region.Hinterland]: 0
        })
        expect(view.worldDeckExhausted).toBe(false)
    })

    it('the chooser’s own view: the Vow applies there as on the host; the build defers to the host, which draws', () => {
        // A game with hidden information guards execution on a player's view.
        const game = testGame([DANA, RHYS, ANN], { protectedInformation: true })
        const start = wonTable(gameTwoEnd(), CHANCELLOR_WINS)
        const asDana: Visibility.Perspective = { kind: 'player', playerId: DANA }
        const vowing = { ...vow(DANA, OathType.ThePeople), id: 'v-1', index: start.actionCount }
        const onView = engine.executeAction({
            action: vowing,
            state: start,
            game,
            perspective: asDana
        })
        const onHost = engine.executeAction({ action: vowing, state: start, game })
        const plain = (state: OathProjectedState) => JSON.parse(JSON.stringify(state))
        expect(plain(served(onView.updatedState, asDana))).toEqual(
            plain(served(onHost.updatedState, asDana))
        )

        const atBuild = onHost.updatedState
        const building = { ...BUILD_AT_MOUNTAIN, id: 'b-1', index: atBuild.actionCount }
        expect(() =>
            engine.executeAction({ action: building, state: atBuild, game, perspective: asDana })
        ).toThrow(Visibility.UnavailableProjectedValueError)
        expect(
            engine.executeAction({ action: building, state: atBuild, game }).updatedState.chronicle
                ?.step
        ).toBe(ChronicleStep.Suit)
    })

    it('what anyone knew of a pile, the world deck or the relic deck is gone after its shuffle', () => {
        const start = gameTwoEnd()
        const forge = relic('whistle')
        start.seenRelicDeckBottom = [forge]
        start.seenWorldDeckBottom = [den('order.scouts')]
        start.seenDiscardPiles = {
            [Region.Cradle]: [den('arcane.augury')],
            [Region.Provinces]: [],
            [Region.Hinterland]: []
        }
        start.getPlayerState(RHYS).knownWorldDeckTop = [den('arcane.dazzle')]
        const built = run(
            run(wonTable(start, CHANCELLOR_WINS), vow(DANA, OathType.ThePeople)).final,
            BUILD_AT_MOUNTAIN
        ).final
        const final = hydrated(run(built, suit(DANA, Suit.Hearth)).final)
        expect(final.seenRelicDeckBottom).toEqual([])
        expect(final.seenWorldDeckBottom).toEqual([])
        expect(final.seenDiscardPiles[Region.Cradle]).toEqual([])
        expect(final.getPlayerState(RHYS).knownWorldDeckTop).toEqual([])
    })
})

// ---------------------------------------------------------------------------------------------
// R-8.3.5's seven steps, on two maps

/** Game 3 of a chronicle at its end: Dana, the Chancellor, won by a Stable Regime. */
function gameThreeEnd(): HydratedOathGameState {
    return scene({
        oathType: OathType.Supremacy,
        players: [
            seat(DANA, Color.Purple, PlayerStatus.Chancellor, {
                advisers: [faceup(den('order.scouts'))],
                relicIds: [GRAND_SCEPTER_ID]
            }),
            seat(RHYS, Color.Red, PlayerStatus.Exile),
            seat(ANN, Color.Yellow, PlayerStatus.Exile)
        ],
        sites: {
            [C1]: {
                site: site('plains'),
                cards: [den('order.curfew'), den('order.toll-roads')],
                warbands: { [IMPERIAL_WARBANDS]: 2 }
            },
            [C2]: {
                site: site('mountain'),
                cards: [RAMPART, den('discord.gossip')],
                relics: [relic('whistle')],
                warbands: { [RHYS]: 1 }
            },
            [P1]: {
                site: site('fertile-valley'),
                cards: [den('hearth.wayside-inn'), den('hearth.rowdy-pub')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [P2]: {
                site: site('steppe'),
                cards: [den('nomad.great-herd')],
                relics: [relic('map')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [P3]: {
                site: site('great-slums'),
                cards: [den('discord.gambling-hall')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [H1]: {
                site: site('charming-valley'),
                cards: [den('beast.walled-garden')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [H2]: { site: site('lush-coast'), warbands: { [IMPERIAL_WARBANDS]: 1 } },
            [H3]: {
                site: site('marshes'),
                cards: [FORGE, den('arcane.portal')],
                ruined: [FORGE],
                relics: [relic('ivory-eye')]
            }
        }
    })
}

describe('R-8.3.5 — a Chancellor winner keeps six sites: steps 1, 2, 3, 4 and 6 move sites', () => {
    function atTheBuild() {
        return run(wonTable(gameThreeEnd(), CHANCELLOR_WINS), vow(DANA, OathType.ThePeople)).final
    }

    it('the build’s refusals: Ancient Forge is a ruin on the map, not in the Archive; a ruin Dana does not rule; a site she does not rule', () => {
        const state = atTheBuild()
        const game = testGame([DANA, RHYS, ANN])
        for (const choice of [
            { siteId: P2, cardId: den('nomad.great-herd') },
            { siteId: C2, cardId: den('discord.gossip') },
            { siteId: H3, cardId: FORGE }
        ]) {
            expect(() => engine.runNext(build(DANA, choice), state, game)).toThrow()
        }
    })

    it('Hall of Debate at the Fertile Valley; Mountain is ruined and set aside; the stack fills down to the Hinterland', () => {
        given({ [ChronicleShuffle.SiteDeck]: [[site('buried-giant')]] })
        const state = hydrated(atTheBuild())
        const vault = state.requireVault()
        buildOrRepair(
            state,
            edificeChoiceNamed(state, { siteId: P1, cardId: den('hearth.rowdy-pub') })
        )
        expect(discardSites(state)).toEqual({
            kept: [
                'plains',
                'mountain',
                'fertile-valley',
                'steppe',
                'great-slums',
                'charming-valley',
                'lush-coast'
            ].map(site),
            discarded: [site('marshes')],
            discardedFacedown: 0,
            denizensDiscarded: 1
        })
        expect(vault.relicDeck).toContain(relic('ivory-eye'))
        expect(vault.discardPiles[Region.Cradle]).toEqual([den('arcane.portal')])
        expect(state.isRuined(FORGE)).toBe(false)
        expect(ruinAndSetAside(state)).toEqual({
            ruins: [{ edificeId: RAMPART, siteCardId: site('mountain'), denizensDiscarded: 1 }],
            setAside: [C2]
        })
        clearMap(state)
        expect(fillSlots(state, [C2])).toEqual({
            moved: [
                { siteCardId: site('fertile-valley'), from: P1, to: C2 },
                { siteCardId: site('steppe'), from: P2, to: P1 },
                { siteCardId: site('great-slums'), from: P3, to: P2 },
                { siteCardId: site('charming-valley'), from: H1, to: P3 },
                { siteCardId: site('lush-coast'), from: H2, to: H1 },
                { siteCardId: site('mountain'), from: C2, to: H3 }
            ],
            dealt: [H2],
            flipped: []
        })
    })

    it('the stack as saved, through the engine', () => {
        given({ [ChronicleShuffle.SiteDeck]: [[site('buried-giant')]] })
        const { final } = run(
            atTheBuild(),
            build(DANA, { siteId: P1, cardId: den('hearth.rowdy-pub') }),
            skip(DANA)
        )
        expect(stack(final)).toEqual([
            at('plains', true, [den('order.curfew'), den('order.toll-roads')]),
            at('fertile-valley', true, [HALL, den('hearth.wayside-inn')]),
            at('steppe', true, [den('nomad.great-herd')], [relic('map')]),
            at('great-slums', true, [den('discord.gambling-hall')]),
            at('charming-valley', true, [den('beast.walled-garden')]),
            at('lush-coast', true),
            at('buried-giant', false),
            at('mountain', true, [`${RAMPART} (ruined)`], [relic('whistle')])
        ])
        expect(archiveEdifices(final)).toEqual([FESTIVAL, GREAT_SPIRE, FOREST_TEMPLE, FORGE])
        expect(chronicleCensus(hydrated(final))).toEqual([])
    })
})

/** Game 5 at its end: Rhys, an Exile, won as Usurper of Devotion; three edifices stand at sites they do not rule. */
function gameFiveEnd(): HydratedOathGameState {
    return scene({
        oathType: OathType.Devotion,
        players: [
            seat(DANA, Color.Purple, PlayerStatus.Chancellor, { relicIds: [GRAND_SCEPTER_ID] }),
            seat(RHYS, Color.Red, PlayerStatus.Exile, { advisers: [faceup(den('beast.wolves'))] }),
            seat(ANN, Color.Yellow, PlayerStatus.Exile)
        ],
        sites: {
            [C1]: {
                site: site('ancient-city'),
                cards: [FESTIVAL, den('order.keep')],
                relics: [relic('horned-mask')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [C2]: {
                site: site('the-tribunal'),
                cards: [den('order.secret-police')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [P1]: {
                site: site('standing-stones'),
                cards: [GREAT_SPIRE, den('arcane.observatory')],
                relics: [relic('book-of-records')],
                warbands: { [ANN]: 1 }
            },
            [P2]: { site: site('shrouded-wood'), facedown: true },
            [P3]: {
                site: site('wastes'),
                cards: [HALL],
                relics: [relic('dowsing-sticks')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [H1]: { site: site('deep-woods'), cards: [den('beast.marsh-spirit')] },
            [H2]: {
                site: site('rocky-coast'),
                cards: [den('nomad.convoys'), den('hearth.hospital')],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            },
            [H3]: {
                site: site('the-hidden-place'),
                cards: [RAMPART, den('beast.mushrooms')],
                ruined: [RAMPART],
                relics: [relic('skeleton-key')],
                warbands: { [RHYS]: 1 }
            }
        },
        overrides: { oathkeeperPlayerId: RHYS, oathkeeperIsUsurper: true }
    })
}

const RHYS_USURPS: GameOutcome = { winnerPlayerId: RHYS, kind: WinKind.Usurper, rule: 'R-3.1' }

describe('R-8.3.5 — an Exile winner who rules only a ruin: steps 4, 5, 6 and 7, and R-8.6.2 at the flipped site', () => {
    const GIVEN = {
        [ChronicleShuffle.SiteDeck]: [['mine', 'plains', 'river', 'barren-coast'].map(site)],
        [ChronicleShuffle.RelicDeck]: [[relic('cracked-horn')]]
    }

    function offered() {
        const vowed = run(wonTable(gameFiveEnd(), RHYS_USURPS), vow(RHYS, OathType.Supremacy))
        expect(vowed.final.chronicle?.step).toBe(ChronicleStep.Citizenship)
        // No offer; an Exile builds nothing, so the map step runs with the answer.
        return run(vowed.final, offer(RHYS, []))
    }

    it('three edifices flip, the hidden place keeps its Mushrooms, and every site is set aside', () => {
        given(GIVEN)
        const vowed = run(wonTable(gameFiveEnd(), RHYS_USURPS), vow(RHYS, OathType.Supremacy))
        const state = hydrated(vowed.final)
        expect(discardSites(state)).toEqual({
            kept: ['ancient-city', 'standing-stones', 'wastes', 'the-hidden-place'].map(site),
            discarded: ['the-tribunal', 'deep-woods', 'rocky-coast'].map(site),
            discardedFacedown: 1,
            denizensDiscarded: 4
        })
        expect(ruinAndSetAside(state)).toEqual({
            ruins: [
                { edificeId: FESTIVAL, siteCardId: site('ancient-city'), denizensDiscarded: 1 },
                {
                    edificeId: GREAT_SPIRE,
                    siteCardId: site('standing-stones'),
                    denizensDiscarded: 1
                },
                { edificeId: HALL, siteCardId: site('wastes'), denizensDiscarded: 0 }
            ],
            setAside: [C1, P1, P3, H3]
        })
        expect(state.denizensAt(H3)).toEqual([RAMPART, den('beast.mushrooms')])
        clearMap(state)
        expect(fillSlots(state, [C1, P1, P3, H3])).toEqual({
            moved: [
                { siteCardId: site('ancient-city'), from: C1, to: P3 },
                { siteCardId: site('standing-stones'), from: P1, to: H1 },
                { siteCardId: site('wastes'), from: P3, to: H2 }
            ],
            dealt: [C1, C2, P1, P2],
            flipped: [{ slotId: C1, siteCardId: site('mine') }]
        })
    })

    it('the stack as saved: the Mine flipped with no reveal prompt, then given the Cracked Horn', () => {
        given(GIVEN)
        const { final, actions } = offered()
        expect(actions[0].revealsInfo).toBe(true)
        expect(final.chronicle?.step).toBe(ChronicleStep.Story)
        expect(stack(final)).toEqual([
            at('mine', true, [], [relic('cracked-horn')]),
            at('plains', false),
            at('river', false),
            at('barren-coast', false),
            at('ancient-city', true, [`${FESTIVAL} (ruined)`], [relic('horned-mask')]),
            at('standing-stones', true, [`${GREAT_SPIRE} (ruined)`], [relic('book-of-records')]),
            at('wastes', true, [`${HALL} (ruined)`], [relic('dowsing-sticks')]),
            at(
                'the-hidden-place',
                true,
                [`${RAMPART} (ruined)`, den('beast.mushrooms')],
                [relic('skeleton-key')]
            )
        ])
        // R-8.3.5-H1 — no favor or secret at the flip.
        expect(final.cardTokens[site('mine')]).toBeUndefined()
        expect(final.chronicle?.relics?.placed).toEqual([{ slotId: C1, count: 1 }])
        expect(archiveEdifices(final)).toEqual([FOREST_TEMPLE, FORGE])
        expect(chronicleCensus(hydrated(final))).toEqual([])
    })

    it('the entry lists the three ruins', () => {
        given(GIVEN)
        const { final } = run(offered().final, skip(RHYS))
        expect(final.chronicleRecord?.at(-1)?.ruined).toEqual([FESTIVAL, GREAT_SPIRE, HALL])
    })
})

// ---------------------------------------------------------------------------------------------
// R-8.4.a — healing the Archive

/** The Order ids the scene leaves to circulation: the scouts are Dana's. */
function archiveScene(
    archive: Record<Suit, number | string[]>,
    dispossessed: string[]
): HydratedOathGameState {
    const advisers = ['arcane.alchemist', 'arcane.inquisitor', 'order.scouts'].map(den)
    const taken = new Set([...dispossessed, ...advisers])
    const inArchive = new Set(
        Object.values(Suit).flatMap((stackSuit) => {
            const wanted = archive[stackSuit]
            if (Array.isArray(wanted)) return wanted
            return PRINTED_DENIZENS_BY_SUIT[stackSuit]
                .filter((cardId) => !taken.has(cardId))
                .slice(0, wanted)
        })
    )
    const circulating = Object.values(PRINTED_DENIZENS_BY_SUIT)
        .flat()
        .filter((cardId) => !taken.has(cardId) && !inArchive.has(cardId))
    const sites = Object.fromEntries(
        SLOTS.map((slotId, k): [string, SiteScene] => [
            slotId,
            {
                site: [
                    'plains',
                    'mountain',
                    'fertile-valley',
                    'steppe',
                    'great-slums',
                    'charming-valley',
                    'lush-coast',
                    'marshes'
                ].map(site)[k],
                warbands: { [IMPERIAL_WARBANDS]: 1 }
            }
        ])
    )
    return scene({
        oathType: OathType.Supremacy,
        players: [
            seat(DANA, Color.Purple, PlayerStatus.Chancellor, {
                advisers: advisers.map(faceup),
                relicIds: [GRAND_SCEPTER_ID]
            }),
            seat(RHYS, Color.Red, PlayerStatus.Exile)
        ],
        sites,
        discards: { [Region.Cradle]: circulating.slice(0, 12) },
        worldDeck: circulating.slice(12),
        dispossessed
    })
}

const V2_DISPOSSESSED = [
    ...[
        'acting-troupe',
        'augury',
        'bewitch',
        'billowing-fog',
        'blood-pact',
        'cracking-ground',
        'dazzle',
        'dream-thief',
        'fire-talkers',
        'forgotten-vault',
        'gleaming-armor',
        'initiation-rite'
    ].map((id) => den(`arcane.${id}`)),
    ...[
        'battle-honors',
        'bear-traps',
        'captains',
        'code-of-honor',
        'council-seat',
        'curfew',
        'encirclement',
        'field-promotion',
        'forced-labor',
        'garrison',
        'hunting-party',
        'keep'
    ].map((id) => den(`order.${id}`)),
    ...[
        'a-round-of-ale',
        'armed-mob',
        'awaited-return',
        'ballot-box',
        'book-binders',
        'charming-friend',
        'crop-rotation',
        'deed-writer',
        'extra-provisions'
    ].map((id) => den(`hearth.${id}`)),
    ...[
        'a-fast-steed',
        'ancient-binding',
        'ancient-bloodline',
        'ancient-pact',
        'convoys',
        'elders'
    ].map((id) => den(`nomad.${id}`)),
    ...['a-small-favor', 'assassin', 'bandit-chief', 'beast-tamer', 'blackmail'].map((id) =>
        den(`discord.${id}`)
    ),
    ...['animal-host', 'animal-playmates', 'birdsong', 'bracken'].map((id) => den(`beast.${id}`))
]

const SHORT_ARCANE = [den('arcane.witchs-bargain'), den('arcane.terror-spells')]

/** The ninth boundary: the Archive holds two Arcane; the Dispossessed's Arcane and Order stacks tie at 12. */
function ninthBoundary(): HydratedOathGameState {
    return archiveScene(
        {
            [Suit.Arcane]: SHORT_ARCANE,
            [Suit.Order]: 10,
            [Suit.Hearth]: 17,
            [Suit.Nomad]: 21,
            [Suit.Discord]: 22,
            [Suit.Beast]: 24
        },
        V2_DISPOSSESSED
    )
}

describe('R-8.4.a — the Archive cannot give the 3/2/1: heal it instead', () => {
    function tied() {
        const vowed = run(wonTable(ninthBoundary(), CHANCELLOR_WINS), vow(DANA, OathType.ThePeople))
        expect(vowed.actions[0].revealsInfo).toBe(true)
        return vowed.final
    }

    it('nothing of the 3/2/1 is added; the tie for the largest stack is published, and the winner is asked', () => {
        const start = ninthBoundary().dehydrate()
        const state = tied()
        expect(state.chronicle?.suit).toBe(Suit.Arcane)
        expect(state.chronicle?.step).toBe(ChronicleStep.HealStack)
        expect(state.chronicle?.healTie).toEqual({ suits: [Suit.Arcane, Suit.Order], count: 12 })
        expect(state.chronicle?.added).toBeUndefined()
        expect(archiveCounts(state)).toEqual(archiveCounts(start))
        expect(vaultOf(state).dispossessed).toHaveLength(48)
        for (const perspective of [{ kind: 'player' as const, playerId: RHYS }, spectator])
            expect(served(state, perspective).chronicle?.healTie).toEqual(state.chronicle?.healTie)
    })

    it('Dana picks Arcane: six from it, every stack back to the Archive, no 3/2/1 after', () => {
        given({
            [ChronicleShuffle.Heal]: [
                [
                    'augury',
                    'blood-pact',
                    'dazzle',
                    'dream-thief',
                    'fire-talkers',
                    'gleaming-armor'
                ].map((id) => den(`arcane.${id}`))
            ]
        })
        const { final, actions } = run(tied(), heal(DANA, Suit.Arcane))
        expect(actions[0].revealsInfo).toBe(true)
        expect(final.chronicle?.added).toEqual({ heal: { suit: Suit.Arcane, count: 6 } })
        expect(archiveBySuit(hydrated(final))[Suit.Arcane].sort()).toEqual(
            [
                ...SHORT_ARCANE,
                ...[
                    'acting-troupe',
                    'bewitch',
                    'billowing-fog',
                    'cracking-ground',
                    'forgotten-vault',
                    'initiation-rite'
                ].map((id) => den(`arcane.${id}`))
            ].sort()
        )
        expect(archiveCounts(final)).toEqual({
            [Suit.Arcane]: 8,
            [Suit.Order]: 22,
            [Suit.Hearth]: 26,
            [Suit.Nomad]: 27,
            [Suit.Discord]: 27,
            [Suit.Beast]: 28
        })
        // R-8.5 then fills the empty Dispossessed with six: 138 + 6.
        expect(vaultOf(final).dispossessed).toHaveLength(6)
        expect(chronicleCensus(hydrated(final))).toEqual([])
    })

    it('or Order: six Order cards, and the Archive is Arcane 14, Order 16', () => {
        given({
            [ChronicleShuffle.Heal]: [
                ['battle-honors', 'captains', 'curfew', 'encirclement', 'garrison', 'keep'].map(
                    (id) => den(`order.${id}`)
                )
            ]
        })
        const { final } = run(tied(), heal(DANA, Suit.Order))
        expect(final.chronicle?.added).toEqual({ heal: { suit: Suit.Order, count: 6 } })
        expect(archiveCounts(final)).toMatchObject({ [Suit.Arcane]: 14, [Suit.Order]: 16 })
    })

    it('a stack not among the largest is refused', () => {
        const state = tied()
        expect(() =>
            engine.runNext(heal(DANA, Suit.Hearth), state, testGame([DANA, RHYS]))
        ).toThrow('Hearth is not among the largest Dispossessed stacks')
    })

    it('a unique largest stack heals without a stop', () => {
        const state = archiveScene(
            {
                [Suit.Arcane]: SHORT_ARCANE,
                [Suit.Order]: 10,
                [Suit.Hearth]: 17,
                [Suit.Nomad]: 21,
                [Suit.Discord]: 22,
                [Suit.Beast]: 24
            },
            V2_DISPOSSESSED.filter((cardId) => cardId !== den('order.keep'))
        )
        const { final } = run(wonTable(state, CHANCELLOR_WINS), vow(DANA, OathType.ThePeople))
        expect(final.chronicle?.healTie).toBeUndefined()
        expect(final.chronicle?.added).toEqual({ heal: { suit: Suit.Arcane, count: 6 } })
        expect(final.chronicle?.step).toBe(ChronicleStep.Story)
    })
})

describe('R-8.4.a with R-9.3 — the largest stack holds fewer than six', () => {
    it('all six stacks tie at three; Dana picks Arcane and its three are all added', () => {
        const dispossessed = [
            ...['dazzle', 'jinx', 'revelation'].map((id) => den(`arcane.${id}`)),
            ...['messenger', 'outriders', 'wrestlers'].map((id) => den(`order.${id}`)),
            ...['levelers', 'storyteller', 'tavern-songs'].map((id) => den(`hearth.${id}`)),
            ...['lancers', 'tents', 'rival-khan'].map((id) => den(`nomad.${id}`)),
            ...['riots', 'scryer', 'zealots'].map((id) => den(`discord.${id}`)),
            ...['wolves', 'wild-cry', 'second-chance'].map((id) => den(`beast.${id}`))
        ]
        const state = archiveScene(
            {
                [Suit.Arcane]: SHORT_ARCANE,
                [Suit.Order]: 18,
                [Suit.Hearth]: 24,
                [Suit.Nomad]: 27,
                [Suit.Discord]: 27,
                [Suit.Beast]: 28
            },
            dispossessed
        )
        const vowed = run(wonTable(state, CHANCELLOR_WINS), vow(DANA, OathType.ThePeople)).final
        expect(vowed.chronicle?.healTie).toEqual({ suits: [...FAVOR_BANK_ORDER], count: 3 })
        const { final } = run(vowed, heal(DANA, Suit.Arcane))
        expect(final.chronicle?.added).toEqual({ heal: { suit: Suit.Arcane, count: 3 } })
        expect(archiveCounts(final)).toEqual({
            [Suit.Arcane]: 2,
            [Suit.Order]: 21,
            [Suit.Hearth]: 27,
            [Suit.Nomad]: 30,
            [Suit.Discord]: 30,
            [Suit.Beast]: 31
        })
        // Three came in and six went out: the Archive and the Dispossessed now hold 147.
        expect(vaultOf(final).dispossessed).toHaveLength(6)
        expect(chronicleCensus(hydrated(final))).toEqual([])
    })
})

// ---------------------------------------------------------------------------------------------
// The cards and pieces the steps meet

describe('R-8.6.1-H1 — the Grand Scepter goes to the box wherever it is', () => {
    function scepterAt(where: 'deck' | 'site' | 'reliquary') {
        const state = gameTwoEnd()
        const dana = state.getPlayerState(DANA)
        dana.relicIds = [relic('dragonskin-drum')]
        const vault = state.requireVault()
        if (where === 'deck') vault.relicDeck.push(GRAND_SCEPTER_ID)
        if (where === 'site') {
            // The Tribunal's relic slot holds it; the Oracular Pig waits in the deck.
            vault.relicFacedown[`${C2}.relic.0`] = GRAND_SCEPTER_ID
            vault.relicDeck.push(relic('oracular-pig'))
        }
        if (where === 'reliquary') {
            vault.relicFacedown['reliquary.3'] = GRAND_SCEPTER_ID
            vault.relicDeck.push(relic('truthful-harp'))
        }
        return state
    }

    for (const where of ['deck', 'site', 'reliquary'] as const) {
        it(`from the ${where}: boxed, and the census holds`, () => {
            const built = run(
                run(wonTable(scepterAt(where), CHANCELLOR_WINS), vow(DANA, OathType.ThePeople))
                    .final,
                BUILD_AT_MOUNTAIN
            ).final
            const final = run(built, suit(DANA, Suit.Hearth)).final
            expect(final.boxIds).toEqual([GRAND_SCEPTER_ID])
            expect(vaultOf(final).relicDeck).not.toContain(GRAND_SCEPTER_ID)
            expect(Object.values(vaultOf(final).relicFacedown)).not.toContain(GRAND_SCEPTER_ID)
            expect(chronicleCensus(hydrated(final))).toEqual([])
        })
    }

    it('from a site, the site is topped up again by R-8.6.2', () => {
        const built = run(
            run(wonTable(scepterAt('site'), CHANCELLOR_WINS), vow(DANA, OathType.ThePeople)).final,
            BUILD_AT_MOUNTAIN
        ).final
        const final = run(built, suit(DANA, Suit.Hearth)).final
        expect(final.relicsBySite[C2]).toEqual([{ slotId: `${C2}.relic.0` }])
        expect(final.chronicle?.relics?.placed).toEqual([
            { slotId: C2, count: 1 },
            { slotId: P1, count: 1 }
        ])
    })
})

describe('R-8.3.2 — Forest Temple keeps a site with a beast card', () => {
    function templeTable() {
        const state = gameTwoEnd()
        // Forest Temple stands at the Great Slums, which Rhys rules; the Deep Woods hold a beast card.
        state.denizensBySite[P2] = [FOREST_TEMPLE, den('discord.gambling-hall')]
        return state
    }

    it('the Deep Woods stay, though no one Dana rules holds them; the Temple itself is then ruined', () => {
        const state = hydrated(
            run(wonTable(templeTable(), CHANCELLOR_WINS), vow(DANA, OathType.ThePeople)).final
        )
        const kept = discardSites(state).kept
        expect(kept).toContain(site('deep-woods'))
        expect(kept).toContain(site('great-slums'))
        expect(ruinAndSetAside(state).ruins.map((ruin) => ruin.edificeId)).toEqual([
            FORGE,
            FOREST_TEMPLE
        ])
        expect(state.denizensAt(H1)).toEqual([den('beast.walled-garden')])
    })
})

describe('R-8.3.2 — the Bandit Crown’s two chronicle answers', () => {
    it('a winner holding it keeps the empty sites its bandits hold', () => {
        const table = gameFiveEnd()
        table.getPlayerState(RHYS).relicIds = [relic('bandit-crown')]
        const state = hydrated(
            run(wonTable(table, RHYS_USURPS), vow(RHYS, OathType.Supremacy)).final
        )
        // The Deep Woods hold no warbands; the bandits there are Rhys's.
        expect(discardSites(state).kept).toContain(site('deep-woods'))
    })

    it('a Chancellor winner keeps the sites a Citizen’s Crown holds', () => {
        const table = gameTwoEnd()
        const ann = table.getPlayerState(ANN)
        ann.status = PlayerStatus.Citizen
        ann.relicIds = [relic('bandit-crown')]
        table.warbandsBySite[P1] = { [IMPERIAL_WARBANDS]: 2 }
        const state = hydrated(
            run(wonTable(table, CHANCELLOR_WINS), vow(DANA, OathType.ThePeople)).final
        )
        expect(discardSites(state).kept).toContain(site('deep-woods'))
    })

    it('without the Crown the bandits’ site is discarded', () => {
        const state = hydrated(
            run(wonTable(gameFiveEnd(), RHYS_USURPS), vow(RHYS, OathType.Supremacy)).final
        )
        expect(discardSites(state).discarded).toContain(site('deep-woods'))
    })
})

describe('R-8.3.4 — every piece leaves the map', () => {
    it('warbands on the Obsidian Cage go back to their bank with the rest; the Cage goes on the relic deck', () => {
        const state = gameTwoEnd()
        state.warbandsOnCards = { [OBSIDIAN_CAGE_ID]: { [RHYS]: 2 } }
        state.addTokensOn(den('order.curfew'), { favor: 1, secrets: 1 })
        const pieces = { favor: favorCensus(state), warbands: warbandCensus(state) }
        const built = run(
            run(wonTable(state, CHANCELLOR_WINS), vow(DANA, OathType.ThePeople)).final,
            BUILD_AT_MOUNTAIN
        ).final
        const after = hydrated(built)
        expect(after.warbandsOnCards[OBSIDIAN_CAGE_ID]).toEqual({ [RHYS]: 0 })
        expect(after.cardTokens).toEqual({})
        expect({ favor: favorCensus(after), warbands: warbandCensus(after) }).toEqual(pieces)
    })

    it('Salt the Earth’s capacity moves with its site', () => {
        const state = gameTwoEnd()
        state.siteCapacityOverrides = { [H3]: 1, [P2]: 1 }
        const built = run(
            run(wonTable(state, CHANCELLOR_WINS), vow(DANA, OathType.ThePeople)).final,
            BUILD_AT_MOUNTAIN
        ).final
        // Lush Coast moved from H3 to P2; the Great Slums were discarded with theirs.
        expect(built.siteCapacityOverrides).toEqual({ [P2]: 1 })
    })

    it('a relic someone peeked at keeps its name in their memory where its site moved', () => {
        const state = gameTwoEnd()
        const ann = state.getPlayerState(ANN)
        ann.recordPeek(`${P1}.relic.0`, relic('brass-horse'))
        const built = run(
            run(wonTable(state, CHANCELLOR_WINS), vow(DANA, OathType.ThePeople)).final,
            BUILD_AT_MOUNTAIN
        ).final
        const moved = hydrated(built).getPlayerState(ANN)
        expect(moved.peekedRelicSlotIds).toEqual([`${H3}.relic.0`])
        expect(moved.peekedRelics).toEqual({ [`${H3}.relic.0`]: relic('brass-horse') })
    })
})
