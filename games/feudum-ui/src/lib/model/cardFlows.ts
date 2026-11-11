import { assertExists, type GameAction } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    conquerOffers,
    discChoices,
    Explore,
    exploreOffer,
    goodsShort,
    GuildById,
    harvestOffers,
    Harvest,
    Improve,
    improveOffers,
    type ImproveOffer,
    Influence,
    influenceOffers,
    Migrate,
    MigrateFood,
    migrateOffers,
    PlayDefend,
    reasonConquerRefused,
    reasonExploreRefused,
    reasonHarvestRefused,
    reasonImproveRefused,
    reasonInfluenceRefused,
    reasonMigrateRefused,
    reasonPlayDefendRefused,
    reasonStarveThePeopleRefused,
    reasonTaxRefused,
    reasonTendLandscapeRefused,
    reinforcementsOffered,
    Spaces,
    StartingSpaceIds,
    Conquer,
    starveOffers,
    StarveThePeople,
    Tax,
    TendLandscape,
    tendLandscapeOffers,
    tendLandscapePreview,
    type ActionCardKind,
    type CardPlayInput,
    type Character,
    type CombatStrength,
    type ConquerOffer,
    type DiscId,
    type FeudumProjectedState,
    type GuildId,
    type HarvestMode,
    type HydratedFeudumGameState,
    type PawnNumber,
    type RegionId,
    type SpaceId,
    type StarveOffer,
    type TileId,
    type VesselType
} from '@tabletop/feudum'
import {
    feudumTarget,
    markerTarget,
    monsterTarget,
    pawnTarget,
    spaceTarget,
    stackTarget,
    type BoardTarget,
    type ChipNote
} from './boardOffer.js'
import type { CardAction, TurnContext } from './cardModes.js'
import type { SendPreview } from './confirmingSend.js'
import { coverAfterPress, coverNeeds, coverSpends } from './tileCover.js'
import { tileArt, tileName, type TileArt } from './tileName.js'

export type TurnDraftValues = {
    card: ActionCardKind
    /** R-3.3 Declared with the first card, kept by every later press. */
    secondCard: true
    /** R-3.15 The played card this Repeat replays. */
    replay: ActionCardKind
    mode: CardAction
    pawn: PawnNumber
    /** R-3.6.2 */
    distantKin: true
    tile: TileId
    /** R-1.1 Markers short: the spaces picked, stacked. */
    spaces: readonly SpaceId[]
    space: SpaceId
    target: BoardTarget
    /** R-3.8.3 */
    money: SpaceId
    character: Character
    guild: GuildId
    disc: DiscId
    /** R-4.3-H1 The earlier stack an improvement takes from. */
    fallback: RegionId
    harvest: HarvestMode
    collect: boolean
    barrel: number
    /** R-4.4-H1 The tiles covering a short payment, stacked. */
    cover: readonly TileId[]
}

export const TurnStageOrder = [
    'card',
    'secondCard',
    'replay',
    'mode',
    'pawn',
    'distantKin',
    'tile',
    'spaces',
    'space',
    'target',
    'money',
    'character',
    'guild',
    'disc',
    'fallback',
    'harvest',
    'collect',
    'barrel',
    'cover'
] as const satisfies readonly (keyof TurnDraftValues)[]
type MissingStages = Exclude<keyof TurnDraftValues, (typeof TurnStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export type TurnStage = (typeof TurnStageOrder)[number]

/** How a press changes the draft; rows and picks carry theirs, so a component only calls it. */
export interface TurnPresser {
    /** A set; the same value again unpicks it. */
    pick<K extends TurnStage>(stage: K, value: TurnDraftValues[K]): void
    /** One press on a stacked stage. */
    stack<K extends 'spaces' | 'cover'>(stage: K, value: TurnDraftValues[K]): void
}
export type TurnPress = (draft: TurnPresser) => void

/** The piece a row shows before its label; the panel paints a pawn in the seat's colour. */
export type ChoiceArt = { readonly kind: 'pawn'; readonly character?: Character } | TileArt

export interface PanelChoice {
    readonly label: string
    /** Its piece, with the label kept as the row's accessible name. */
    readonly art?: ChoiceArt
    /** The text beside the art when the art stands for part of the label (a tile for its name). */
    readonly shown?: string
    readonly note?: ChipNote
    readonly picked: boolean
    /** Dimmed, with the line a press gives; it has no `press`. */
    readonly refusal?: string
    readonly press?: TurnPress
    /** Contract, Hover: what this row's press would light, read only while the row is pointed at. */
    readonly lights?: () => readonly BoardTarget[]
}

export interface FlowPick {
    readonly target: BoardTarget
    readonly notes?: readonly ChipNote[]
    readonly press: TurnPress
}

export interface FlowPopup {
    readonly anchor: BoardTarget
    readonly choices: readonly PanelChoice[]
}

type ActionMaker = Pick<
    GameSession<FeudumProjectedState, HydratedFeudumGameState>,
    'createPlayerAction'
>

/** Defined once the logic's refusal has passed: what a press or the primary sends. */
export interface FlowPlay extends SendPreview {
    readonly build: (maker: ActionMaker) => GameAction
}

export interface TallyLine {
    readonly source: string
    readonly attack?: number
    readonly defence?: number
}

export interface FlowView {
    readonly picks: readonly FlowPick[]
    readonly picked: readonly BoardTarget[]
    readonly rows: readonly PanelChoice[]
    readonly popup?: FlowPopup
    /** "Place 2 of 3", "The Desert tile is not yet legal: take an earlier tile". */
    readonly line?: string
    readonly tally?: readonly TallyLine[]
    readonly tallyNote?: string
    /** R-X.2 Names the primary button, when this flow can show one. */
    readonly primaryName?: string
    /** The primary is the only press that sends, whatever the preview says. */
    readonly confirms?: boolean
    readonly play?: FlowPlay
    /** This mode's stages are another draft's: Move and the guild functions. */
    readonly handedOff?: ActionType
}

export interface FlowInput extends TurnContext {
    readonly input: CardPlayInput
    readonly read: <K extends TurnStage>(stage: K) => TurnDraftValues[K] | undefined
}

const Empty: FlowView = { picks: [], picked: [], rows: [] }

const Pick =
    <K extends TurnStage>(stage: K, value: TurnDraftValues[K]): TurnPress =>
    (draft) => {
        draft.pick(stage, value)
    }

function titled(word: string): string {
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
}

export function regionOf(spaceId: SpaceId): RegionId {
    const space = Spaces.find(({ id }) => id === spaceId)
    assertExists(space, `R-1.4 There is a space ${spaceId}`)
    return space.region
}

/** "Desert 4" */
export function spaceLabel(spaceId: SpaceId): string {
    return `${titled(regionOf(spaceId))} ${spaceId.split('.')[2]}`
}

const VesselNames: Readonly<Record<VesselType, string>> = {
    ship: 'a ship',
    submersible: 'a submersible',
    'flying-machine': 'a flying machine'
}

/**
 * "Knight at Desert 4, on a ship": R-1.1 a seat's pawns are alike, so one is told from another
 * only by where it stands, its character and the vessel under it (R-4.2.2), never by its number.
 */
export function pawnPlace({
    character,
    spaceId,
    vessel
}: {
    readonly character: Character
    readonly spaceId: SpaceId
    readonly vessel?: VesselType
}): string {
    const place = `${titled(character)} at ${spaceLabel(spaceId)}`
    return vessel ? `${place}, on ${VesselNames[vessel]}` : place
}

function placeOfPawn(state: HydratedFeudumGameState, playerId: string, n: PawnNumber): string {
    const pawn = state.getPlayerState(playerId).pawns.find((entry) => entry.n === n)
    assertExists(pawn?.spaceId, `R-3.6 Pawn ${n} stands on the board`)
    assertExists(pawn.character, `R-3.6 Pawn ${n} on the board has a character`)
    return pawnPlace({ ...pawn, character: pawn.character, spaceId: pawn.spaceId })
}

function playIf(
    reason: string | undefined,
    build: FlowPlay['build'],
    preview: SendPreview = {}
): FlowPlay | undefined {
    return reason === undefined ? { ...preview, build } : undefined
}

function priceLabel(): string {
    return Object.entries(MigrateFood)
        .map(([good, count]) => `${count} ${good}`)
        .join(', ')
}

/** R-3.6 */
function migrateFlow(flow: FlowInput): FlowView {
    const { state, playerId, input, read } = flow
    const offers = migrateOffers(state, playerId)
    const pawn = read('pawn')
    const canEnter = offers.spaces.length + offers.distantKinSpaces.length > 0
    // R-1.1 Pawns in supply stand nowhere and have no character, so nothing tells them apart: one
    // figure stands for them all, and its press takes the first.
    const rows: PanelChoice[] = offers.pawnsOff.slice(0, 1).map((n) => ({
        label: 'Pawn from supply',
        art: { kind: 'pawn' },
        picked: pawn !== undefined && offers.pawnsOff.includes(pawn),
        ...(canEnter
            ? { press: Pick('pawn', n) }
            : {
                  refusal:
                      reasonMigrateRefused(state, playerId, {
                          ...input,
                          pawn: n,
                          onto: { character: 'farmer', spaceId: StartingSpaceIds[0] }
                      }) ?? 'No space to migrate to.'
              })
    }))
    if (pawn === undefined || offers.pawnsOn.includes(pawn)) {
        const data = pawn === undefined ? undefined : { ...input, pawn, onto: 'off' as const }
        return {
            ...Empty,
            rows,
            picks: offers.pawnsOn.map((n) => ({
                target: pawnTarget(playerId, n),
                notes: [{ kind: 'role', label: 'off' }],
                press: Pick('pawn', n)
            })),
            picked: pawn === undefined ? [] : [pawnTarget(playerId, pawn)],
            ...(data
                ? {
                      primaryName: `Migrate the ${placeOfPawn(state, playerId, data.pawn)} off`,
                      play: playIf(reasonMigrateRefused(state, playerId, data), (maker) =>
                          maker.createPlayerAction(Migrate, data)
                      )
                  }
                : {})
        }
    }
    const distantKin = read('distantKin')
    if (offers.distantKinSpaces.length > 0) {
        rows.push({
            label: 'Distant Kin',
            picked: distantKin === true,
            press: Pick('distantKin', true)
        })
    }
    const spaceId = read('space')
    const picks: FlowPick[] = (distantKin ? StartingSpaceIds : offers.spaces).map((id) => ({
        target: spaceTarget(id),
        notes: [
            distantKin
                ? { kind: 'role', label: 'Distant Kin' }
                : { kind: 'cost', label: priceLabel() }
        ],
        press: Pick('space', id)
    }))
    const picked = spaceId ? [spaceTarget(spaceId)] : []
    if (!spaceId) {
        return { ...Empty, rows, picks, picked }
    }
    const character = read('character')
    if (!character) {
        return {
            ...Empty,
            rows,
            picks,
            picked,
            popup: {
                anchor: spaceTarget(spaceId),
                choices: offers.characters.map(({ character: choice, rank }) => ({
                    label: GuildById[choice].name,
                    note: { kind: 'role', label: rank ?? 'no rank' },
                    picked: false,
                    press: Pick('character', choice)
                }))
            }
        }
    }
    const needs = coverNeeds(goodsShort(state, playerId, MigrateFood))
    const cover = read('cover') ?? []
    const data = {
        ...input,
        pawn,
        onto: { character, spaceId },
        ...(distantKin ? { distantKin } : {}),
        ...(needs.length > 0 ? { wildTiles: coverSpends(cover, needs) } : {})
    }
    const reason = reasonMigrateRefused(state, playerId, data)
    const play = playIf(cover.length === needs.length ? reason : 'A tile is still owed.', (maker) =>
        maker.createPlayerAction(Migrate, data)
    )
    if (needs.length === 0) {
        return {
            ...Empty,
            rows,
            picks,
            picked,
            primaryName: `Migrate to ${spaceLabel(spaceId)}`,
            ...(play ? { play } : {})
        }
    }
    return {
        ...Empty,
        rows: state.getPlayerState(playerId).regionTiles.map((tileId) => {
            const next = coverAfterPress(cover, tileId, needs)
            return {
                label: `${tileName(tileId)} tile: ${needs.join(', ')}`,
                art: tileArt(state, tileId),
                shown: `for ${needs.join(', ')}`,
                picked: cover.includes(tileId),
                ...(next
                    ? {
                          press: (draft: TurnPresser) => {
                              draft.stack('cover', next)
                          }
                      }
                    : { refusal: 'Every short good has its tile.' })
            }
        }),
        picks,
        picked,
        primaryName: 'Cover with a tile',
        confirms: true,
        ...(play ? { play } : {})
    }
}

/** R-3.8, R-3.8.3, R-1.1 */
function influenceFlow({ state, playerId, input, read }: FlowInput): FlowView {
    const offers = influenceOffers(state, playerId)
    const money = read('money')
    const spaces = read('spaces') ?? []
    const moneyNote: ChipNote = { kind: 'cost', label: 'Money is Influence · 1s' }
    const data = {
        ...input,
        ...(offers.short ? { spaceIds: [...spaces] } : {}),
        ...(money ? { moneyIsInfluence: money } : {})
    }
    const ready = !offers.short || spaces.length === offers.markers
    const play = playIf(
        ready ? reasonInfluenceRefused(state, playerId, data) : 'Pick every marker.',
        (maker) => maker.createPlayerAction(Influence, data)
    )
    const primary = {
        primaryName: money ? `Influence · Money is Influence at ${spaceLabel(money)}` : 'Influence',
        confirms: true,
        ...(play ? { play } : {})
    }
    if (offers.short) {
        return {
            ...Empty,
            ...primary,
            line: `Place ${spaces.length} of ${offers.markers}`,
            picks: offers.spaces.map((spaceId) => ({
                target: spaceTarget(spaceId),
                press: (draft) => {
                    if (spaces.includes(spaceId)) {
                        draft.stack(
                            'spaces',
                            spaces.filter((id) => id !== spaceId)
                        )
                    } else if (spaces.length < offers.markers) {
                        draft.stack('spaces', [...spaces, spaceId])
                    }
                }
            })),
            picked: spaces.map(spaceTarget),
            rows: spaces
                .filter((spaceId) => offers.moneyIsInfluence.includes(spaceId))
                .map((spaceId) => ({
                    label: `Money is Influence at ${spaceLabel(spaceId)}`,
                    note: moneyNote,
                    picked: money === spaceId,
                    press: Pick('money', spaceId)
                }))
        }
    }
    return {
        ...Empty,
        ...primary,
        picks: offers.moneyIsInfluence.map((spaceId) => ({
            target: spaceTarget(spaceId),
            notes: [moneyNote],
            press: Pick('money', spaceId)
        })),
        picked: money ? [spaceTarget(money)] : []
    }
}

/** R-4.3-H1 What the chip says of the tile: said before the press, since a press may send. */
function improveTileNote({ tile }: ImproveOffer): ChipNote {
    if (tile.kind === 'legal') {
        return { kind: 'gain', label: `tile · +${tile.vp} vp` }
    }
    return {
        kind: 'gain',
        label:
            tile.kind === 'prohibited' && tile.candidates.length > 0
                ? 'earlier tile · no vp'
                : 'no tile'
    }
}

/** R-4.3-H1, R-4.3.2 */
function improveTileLine({ spaceId, tile }: ImproveOffer): string {
    const name = titled(regionOf(spaceId))
    return tile.kind === 'prohibited' && tile.candidates.length > 0
        ? `The ${name} tile is not yet legal: take an earlier tile`
        : `The ${name} tile is not yet legal: no earlier tile to take`
}

/** R-3.9.1, R-3.9-H1, R-4.3-H1 */
function improveFlow({ state, playerId, input, read }: FlowInput): FlowView {
    const offers = improveOffers(state, playerId)
    const spaceId = read('space')
    const offer = offers.find((row) => row.spaceId === spaceId)
    const picks: FlowPick[] = offers.map((row) => ({
        target: spaceTarget(row.spaceId),
        notes: [{ kind: 'cost', label: `→ ${row.to} · 1 ${row.cost}` }, improveTileNote(row)],
        press: Pick('space', row.spaceId)
    }))
    const prohibited = offers.filter(({ tile }) => tile.kind === 'prohibited')
    if (!spaceId || !offer) {
        return {
            ...Empty,
            picks,
            ...(prohibited.length > 0
                ? { line: Array.from(new Set(prohibited.map(improveTileLine))).join(' ') }
                : {})
        }
    }
    const tileLine = offer.tile.kind === 'prohibited' ? { line: improveTileLine(offer) } : {}
    const picked = [spaceTarget(spaceId)]
    const anchor = spaceTarget(spaceId)
    const guild = read('guild')
    if (offer.to === 'feudum' && !guild) {
        return {
            ...Empty,
            ...tileLine,
            picks,
            picked,
            popup: {
                anchor,
                choices: offer.feudumGuilds.map((id) => ({
                    label: GuildById[id].name,
                    picked: false,
                    press: Pick('guild', id)
                }))
            }
        }
    }
    const discs = guild ? discChoices(state, 'feudum', guild) : offer.discs
    const disc = read('disc')
    if (discs.length > 1 && !disc) {
        return {
            ...Empty,
            ...tileLine,
            picks,
            picked,
            popup: {
                anchor,
                choices: discs.map(({ discId, other }) => ({
                    label: other ? `Other face: ${other}` : 'Plain back',
                    picked: false,
                    press: Pick('disc', discId)
                }))
            }
        }
    }
    const candidates = offer.tile.kind === 'prohibited' ? offer.tile.candidates : []
    const fallback = read('fallback')
    const data = {
        ...input,
        spaceId,
        ...(guild ? { feudumGuild: guild } : {}),
        ...(disc ? { discId: disc } : {}),
        ...(fallback ? { fallbackRegion: fallback } : {})
    }
    const asksFallback = candidates.length > 0
    const view: FlowView = {
        ...Empty,
        primaryName: `Improve ${spaceLabel(spaceId)} to a ${offer.to}`,
        ...tileLine,
        picks: asksFallback
            ? candidates.map(({ stack }) => ({
                  target: stackTarget(stack),
                  notes: [{ kind: 'gain', label: 'no vp' }],
                  press: Pick('fallback', stack)
              }))
            : picks,
        picked: fallback ? [stackTarget(fallback)] : picked
    }
    if (asksFallback && !fallback) {
        return view
    }
    const play = playIf(
        reasonImproveRefused(state, playerId, data),
        (maker) => maker.createPlayerAction(Improve, data),
        { revealsInfo: offer.revealsInfo }
    )
    return { ...view, ...(play ? { play } : {}) }
}

/** R-3.9.3, R-4.3.4, R-4.10.2 */
function tendFlow({ state, playerId, input, read }: FlowInput): FlowView {
    const offers = tendLandscapeOffers(state, playerId)
    const tileId = read('tile')
    const rows: PanelChoice[] = offers.tiles.map((row) => ({
        label: `${titled(row.landscape)} tile`,
        picked: tileId === row.tileId,
        press: Pick('tile', row.tileId)
    }))
    if (!tileId) {
        return { ...Empty, rows }
    }
    const spaceId = read('space')
    const picks: FlowPick[] = offers.spaceIds.map((id) => ({
        target: spaceTarget(id),
        press: Pick('space', id)
    }))
    if (!spaceId) {
        return { ...Empty, rows, picks }
    }
    const picked = [spaceTarget(spaceId)]
    const anchor = spaceTarget(spaceId)
    const preview = tendLandscapePreview(state, tileId, spaceId)
    const collect = read('collect')
    if (collect === undefined) {
        const { kept, paid } = preview.collected
        const { resource } = offers.tiles.find((row) => row.tileId === tileId) ?? {}
        return {
            ...Empty,
            rows,
            picks,
            picked,
            popup: {
                anchor,
                choices: [
                    {
                        label: `Collect ${kept + paid} ${resource} · ${paid} to the ruler`,
                        picked: false,
                        press: Pick('collect', true)
                    },
                    { label: 'Leave it', picked: false, press: Pick('collect', false) }
                ]
            }
        }
    }
    const barrel = read('barrel')
    if (collect && preview.sulfurToBarrel > 0 && barrel === undefined) {
        return {
            ...Empty,
            rows,
            picks,
            picked,
            popup: {
                anchor,
                choices: Array.from({ length: preview.sulfurToBarrel + 1 }, (_, count) => ({
                    label: count === 0 ? 'Keep it all' : `${count} into the barrel`,
                    picked: false,
                    press: Pick('barrel', count)
                }))
            }
        }
    }
    const data = {
        ...input,
        tileId,
        spaceId,
        collect,
        ...(collect && barrel ? { sulfurToBarrel: barrel } : {})
    }
    const play = playIf(reasonTendLandscapeRefused(state, playerId, data), (maker) =>
        maker.createPlayerAction(TendLandscape, data)
    )
    return {
        ...Empty,
        rows,
        picks,
        picked,
        primaryName: `Tend Landscape at ${spaceLabel(spaceId)}`,
        ...(play ? { play } : {})
    }
}

/** R-3.10 */
function exploreFlow({ state, playerId, input }: FlowInput): FlowView {
    const offer = exploreOffer(state, playerId, input)
    const data = { ...input, revealsInfo: true as const }
    const play = playIf(
        reasonExploreRefused(state, playerId, input),
        (maker) => maker.createPlayerAction(Explore, data),
        { revealsInfo: true }
    )
    return {
        ...Empty,
        primaryName: offer ? `Explore: draw ${offer.drawCount} writs` : 'Explore',
        confirms: true,
        ...(play ? { play } : {})
    }
}

const HarvestModeNames: Readonly<Record<HarvestMode, string>> = {
    plain: 'Harvest',
    favours: 'Favours',
    inspect: 'Inspect the harvest'
}

/** R-3.11 */
function harvestFlow({ state, playerId, input, read }: FlowInput): FlowView {
    const offers = harvestOffers(state, playerId)
    const spaceId = read('space')
    const picks: FlowPick[] = offers.farms.map((farm) => ({
        target: spaceTarget(farm.spaceId),
        notes: [{ kind: 'gain', label: `${farm.total} goods` }],
        press: Pick('space', farm.spaceId)
    }))
    const farm = offers.farms.find((row) => row.spaceId === spaceId)
    if (!spaceId || !farm) {
        return { ...Empty, picks }
    }
    const picked = [spaceTarget(spaceId)]
    const harvest = read('harvest')
    if (!harvest) {
        return {
            ...Empty,
            picks,
            picked,
            popup: {
                anchor: spaceTarget(spaceId),
                choices: [
                    {
                        label: `Harvest ${farm.total}`,
                        picked: false,
                        press: Pick('harvest', 'plain')
                    },
                    {
                        label: `Favours: ${farm.partial} here, ${farm.favours} to you`,
                        ...(offers.beads > 0
                            ? {
                                  note: {
                                      kind: 'cost',
                                      label: `your ${offers.beads} beads turn to seals`
                                  }
                              }
                            : {}),
                        picked: false,
                        press: Pick('harvest', 'favours')
                    },
                    ...(offers.inspect
                        ? [
                              {
                                  label: 'Inspect the harvest',
                                  picked: false,
                                  press: Pick('harvest', 'inspect')
                              }
                          ]
                        : [])
                ]
            }
        }
    }
    const data = { ...input, revealsInfo: true as const, spaceId, mode: harvest }
    const play = playIf(
        reasonHarvestRefused(state, playerId, data),
        (maker) => maker.createPlayerAction(Harvest, data),
        { revealsInfo: true }
    )
    const name = harvest === 'plain' ? `Harvest ${farm.total}` : HarvestModeNames[harvest]
    return {
        ...Empty,
        picks,
        picked,
        primaryName: `${name} at ${spaceLabel(spaceId)}`,
        ...(play ? { play } : {})
    }
}

/**
 * R-3.12, R-3.12-H1 With Reinforcements to collect, two rows ask whether to; the button, which says
 * what the card will do, sends once answered. Without, the one press is the button.
 */
function taxFlow({ state, playerId, input, read }: FlowInput, name: string): FlowView {
    if (!reinforcementsOffered(state, playerId)) {
        const play = playIf(reasonTaxRefused(state, playerId, input), (maker) =>
            maker.createPlayerAction(Tax, { ...input })
        )
        return { ...Empty, primaryName: name, confirms: true, ...(play ? { play } : {}) }
    }
    const collect = read('collect')
    const rows: PanelChoice[] = [
        {
            label: 'Collect Reinforcements · +1 marker',
            picked: collect === true,
            press: Pick('collect', true)
        },
        {
            label: 'Decline Reinforcements',
            picked: collect === false,
            press: Pick('collect', false)
        }
    ]
    const data = collect === undefined ? undefined : { ...input, collect }
    const play =
        data &&
        playIf(reasonTaxRefused(state, playerId, data), (maker) =>
            maker.createPlayerAction(Tax, data)
        )
    return {
        ...Empty,
        rows,
        primaryName: collect ? `${name} · Reinforcements +1 marker` : name,
        confirms: true,
        ...(play ? { play } : {})
    }
}

/** R-3.14.1 */
function defendFlow({ state, playerId, input }: FlowInput, name: string): FlowView {
    const play = playIf(reasonPlayDefendRefused(state, playerId, input), (maker) =>
        maker.createPlayerAction(PlayDefend, { ...input })
    )
    return { ...Empty, primaryName: name, confirms: true, ...(play ? { play } : {}) }
}

function conquerTarget({ spaceId, target }: ConquerOffer): BoardTarget {
    switch (target.kind) {
        case 'pawn': {
            return pawnTarget(target.playerId, target.n)
        }
        case 'monster': {
            return monsterTarget(target.monsterId)
        }
        case 'feudum': {
            return feudumTarget(spaceId)
        }
    }
}

function conquerName({ state, nameOf }: TurnContext, { target, defenderId }: ConquerOffer): string {
    const name = nameOf(defenderId)
    switch (target.kind) {
        case 'pawn': {
            const pawn = state.getPlayerState(target.playerId).pawns.find(({ n }) => n === target.n)
            return `${name}'s ${pawn?.character ?? 'pawn'}`
        }
        case 'monster': {
            return `${name}'s ${target.monsterId}`
        }
        case 'feudum': {
            return `${name}'s feudum`
        }
    }
}

/** R-4.8.1 The tally by source, as the logic package counts it now. */
export function tallyLines({ attack, defence }: CombatStrength): readonly TallyLine[] {
    return [
        { source: 'pawns', attack: attack.pawns, defence: defence.pawns },
        { source: 'monsters', attack: attack.monsters, defence: defence.monsters },
        { source: 'saltpeter', attack: attack.saltpeter },
        { source: 'weapons', attack: attack.weapons },
        { source: 'serf', attack: attack.serf },
        { source: 'feudum', defence: defence.feudum },
        { source: 'subject', defence: defence.subject },
        { source: 'defend', defence: defence.defend },
        { source: 'total', attack: attack.total, defence: defence.total }
    ]
}

/** R-3.13, R-4.8 */
function conquerFlow(flow: FlowInput): FlowView {
    const { state, playerId, input, read, nameOf } = flow
    const offers = conquerOffers(state, playerId, input)
    const target = read('target')
    const picks: FlowPick[] = offers.map((offer) => ({
        target: conquerTarget(offer),
        notes: [
            {
                kind: 'threat',
                label: `${offer.strength.attack.total} vs ${offer.strength.defence.total}`
            }
        ],
        press: Pick('target', conquerTarget(offer))
    }))
    const offer = offers.find((row) => conquerTarget(row) === target)
    if (!target || !offer) {
        return { ...Empty, picks }
    }
    const data = { ...input, spaceId: offer.spaceId, target: offer.target }
    const name = conquerName(flow, offer)
    const play = playIf(
        reasonConquerRefused(state, playerId, data),
        (maker) => maker.createPlayerAction(Conquer, data),
        { revealsInfo: offer.revealsInfo }
    )
    return {
        ...Empty,
        picks,
        picked: [target],
        tally: tallyLines(offer.strength),
        ...(offer.revealsInfo ? { tallyNote: 'Defence may rise by 1 if they answer' } : {}),
        primaryName: offer.revealsInfo
            ? `Conquer ${name} · ${nameOf(offer.defenderId)} may answer`
            : `Conquer ${name}`,
        ...(play ? { play } : {})
    }
}

function starveTarget({ spaceId, targetPlayerId, role }: StarveOffer): BoardTarget {
    return markerTarget(spaceId, targetPlayerId, role)
}

/** R-3.13.2, R-3.14-H1 */
function starveFlow({ state, playerId, input, read, nameOf }: FlowInput): FlowView {
    const offers = starveOffers(state, playerId, input)
    const target = read('target')
    const picks: FlowPick[] = offers.map((offer) => ({
        target: starveTarget(offer),
        notes: [{ kind: 'threat', label: 'starve' }],
        press: Pick('target', starveTarget(offer))
    }))
    const offer = offers.find((row) => starveTarget(row) === target)
    if (!target || !offer) {
        return { ...Empty, picks }
    }
    const { spaceId, targetPlayerId, role, revealsInfo } = offer
    const data = { ...input, spaceId, targetPlayerId, role }
    const owner = nameOf(targetPlayerId)
    const play = playIf(
        reasonStarveThePeopleRefused(state, playerId, data),
        (maker) => maker.createPlayerAction(StarveThePeople, data),
        { revealsInfo }
    )
    return {
        ...Empty,
        picks,
        picked: [target],
        primaryName: revealsInfo
            ? `Starve ${owner}'s ${role} · ${owner} may answer`
            : `Starve ${owner}'s ${role}`,
        ...(play ? { play } : {})
    }
}

const handedOff = (action: ActionType) => (): FlowView => ({ ...Empty, handedOff: action })

/**
 * One row per mode. Move and the guild functions keep a row with `handedOff`: the draft that builds
 * them reads `TurnDraft.mode` and `TurnDraft.cardInput` and shows its own stages.
 */
const Flows: Readonly<Record<CardAction, (flow: FlowInput, modeLabel: string) => FlowView>> = {
    [ActionType.Migrate]: migrateFlow,
    [ActionType.Move]: handedOff(ActionType.Move),
    [ActionType.Influence]: influenceFlow,
    [ActionType.Improve]: improveFlow,
    [ActionType.TendLandscape]: tendFlow,
    [ActionType.Explore]: exploreFlow,
    [ActionType.Harvest]: harvestFlow,
    [ActionType.Tax]: taxFlow,
    [ActionType.Conquer]: conquerFlow,
    [ActionType.StarveThePeople]: starveFlow,
    [ActionType.PlayDefend]: defendFlow,
    [ActionType.GuildAction]: handedOff(ActionType.GuildAction),
    [ActionType.Feast]: handedOff(ActionType.Feast)
}

export function flowOf(action: CardAction, flow: FlowInput, modeLabel: string): FlowView {
    return Flows[action](flow, modeLabel)
}
