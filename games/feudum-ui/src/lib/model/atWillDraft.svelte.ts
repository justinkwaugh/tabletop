import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    ActionType,
    DiscardAnyTime,
    DiscardWrit,
    discardWritOffers,
    type Good,
    goodsShort,
    type GuildId,
    MachineState,
    type MandateAlternativeId,
    type PawnNumber,
    PlaceVessel,
    placeVesselOffers,
    PlayMandate,
    playMandateOffers,
    priceOfGoods,
    reasonPlayMandateRefused,
    ReclaimImmunitySeal,
    reclaimImmunitySealOffers,
    type SpaceId,
    SpendRegionTile,
    spendRegionTileOffers,
    type StarveRole,
    type TileId,
    type VesselType,
    type WritId
} from '@tabletop/feudum'
import { markerTarget, pawnTarget, type BoardTarget, type StagePick } from './boardOffer.js'
import type { FlowPick, FlowPlay } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { primaryLabel, sendsOnPress } from './confirmingSend.js'
import {
    coverChoices,
    DeciderDraft,
    draftChoice,
    playUnless,
    type DraftArt,
    type DraftChoice
} from './deciderDraft.svelte.js'
import { withLoneChoice } from './stagedDraft.svelte.js'
import { coverNeeds, coverSpends, loneCover } from './tileCover.js'
import { tileArt, tileName } from './tileName.js'
import type { TurnPrimary } from './turnDraft.svelte.js'
import { mandateChoiceLabel, writName } from './writLabels.js'

export type AtWillList = 'writs' | 'tiles' | 'vessels' | 'immunity'

export interface MandatePick {
    readonly writId: WritId
    readonly alternative?: MandateAlternativeId
    readonly rewardGuild?: GuildId
    /** R-4.4-H4 The vessel an any-vessel reward takes. */
    readonly vessel?: VesselType
}

export interface SealPick {
    readonly spaceId: SpaceId
    readonly role: StarveRole
}

export type AtWillValues = {
    list: AtWillList
    mandate: MandatePick
    /** R-4.4-H1 Stacked: each tile brings the next good owed. */
    cover: readonly TileId[]
    discard: WritId
    tile: TileId
    good: { readonly good: Good; readonly sulfurToBarrel?: true }
    vessel: VesselType
    pawn: PawnNumber
    seal: SealPick
}

export const AtWillStageOrder: readonly (keyof AtWillValues)[] = [
    'list',
    'mandate',
    'cover',
    'discard',
    'tile',
    'good',
    'vessel',
    'pawn',
    'seal'
]

export interface AtWillContext extends TurnContext {
    readonly offered: readonly ActionType[]
}

export interface AtWillPanel {
    readonly chips: readonly (DraftChoice & { readonly list: AtWillList })[]
    readonly writs?: readonly {
        readonly writId: WritId
        readonly name: string
        readonly choices: readonly DraftChoice[]
    }[]
    readonly tiles?: readonly (DraftChoice & { readonly tileId: TileId })[]
    readonly goods?: readonly (DraftChoice & { readonly good: Good })[]
    readonly vessels?: readonly (DraftChoice & { readonly vesselType: VesselType })[]
    readonly covers?: readonly DraftChoice[]
    readonly line?: string
    readonly primary?: TurnPrimary
}

type WritRow = NonNullable<AtWillPanel['writs']>[number]

/** The contract's at-will row: what a seat may do any time its window is open (R-4.4-H1). */
export class AtWillDraft extends DeciderDraft<AtWillValues, AtWillContext> {
    constructor(contextOf: () => AtWillContext | undefined) {
        super(AtWillStageOrder, contextOf)
    }

    /** R-4.4.2 What a held mandate can do now; an alternative the logic refuses is not drawn. */
    private mandateOffers({ state, playerId }: AtWillContext) {
        return playMandateOffers(state, playerId).filter(({ refused }) => !refused)
    }

    /** R-4.4.4 While the limit asks this seat for a discard, its own panel is where it is pressed. */
    private discardOffers({ state, playerId, offered }: AtWillContext): readonly WritId[] {
        const asked =
            state.machineState === MachineState.DiscardingWrits &&
            state.activePlayerIds.includes(playerId)
        return offered.includes(ActionType.DiscardWrit) && !asked
            ? discardWritOffers(state, playerId)
            : []
    }

    private tileOffers({ state, playerId, offered }: AtWillContext) {
        return offered.includes(ActionType.SpendRegionTile)
            ? spendRegionTileOffers(state, playerId)
            : []
    }

    private vesselOffers({ state, playerId, offered }: AtWillContext) {
        return offered.includes(ActionType.PlaceVessel) ? placeVesselOffers(state, playerId) : []
    }

    private sealOffers({ state, playerId, offered }: AtWillContext) {
        return offered.includes(ActionType.ReclaimImmunitySeal)
            ? reclaimImmunitySealOffers(state, playerId)
            : []
    }

    private needsOf(context: AtWillContext, picked: MandatePick | undefined): readonly Good[] {
        const offer = picked
            ? this.mandateOffers(context).find((row) => AtWillDraft.sameMandate(picked, row))
            : undefined
        return offer
            ? coverNeeds(goodsShort(context.state, context.playerId, priceOfGoods(offer.turnedIn)))
            : []
    }

    protected override withAutos(
        stored: StagedSelectionState<AtWillValues>,
        context: AtWillContext
    ): StagedSelectionState<AtWillValues> {
        const list = stored.list?.value
        if (list === 'tiles') {
            return withLoneChoice<AtWillValues, 'tile'>(
                stored,
                AtWillStageOrder,
                'tile',
                this.tileOffers(context).map(({ tileId }) => tileId)
            )
        }
        if (list === 'vessels') {
            return withLoneChoice<AtWillValues, 'vessel'>(
                stored,
                AtWillStageOrder,
                'vessel',
                this.vesselOffers(context).map(({ vesselType }) => vesselType)
            )
        }
        const needs = list === 'writs' ? this.needsOf(context, stored.mandate?.value) : []
        return needs.length > 0
            ? withLoneChoice<AtWillValues, 'cover'>(
                  stored,
                  AtWillStageOrder,
                  'cover',
                  loneCover(context.state, context.playerId, needs)
              )
            : stored
    }

    play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        if (!context) {
            return undefined
        }
        switch (this.value('list')) {
            case 'writs':
                return this.writPlay(context)
            case 'tiles':
                return this.tilePlay()
            case 'vessels':
                return this.vesselPlay()
            case 'immunity':
                return this.sealPlay()
            default:
                return undefined
        }
    })

    /** The press that completes an undoable Action sends at once (contract: Pick conventions). */
    sendsNow: FlowPlay | undefined = $derived.by(() =>
        this.play && sendsOnPress(this, this.play) ? this.play : undefined
    )

    private writPlay(context: AtWillContext): FlowPlay | undefined {
        const discard = this.value('discard')
        if (discard) {
            return {
                build: (maker) =>
                    maker.createPlayerAction(DiscardWrit, { writId: discard, ...DiscardAnyTime })
            }
        }
        return this.mandatePlay(context)
    }

    /** R-4.4.2, R-4.4-H1 Once every short good has its tile. */
    private mandatePlay(context: AtWillContext): FlowPlay | undefined {
        const mandate = this.value('mandate')
        const offer =
            mandate &&
            this.mandateOffers(context).find((row) => AtWillDraft.sameMandate(mandate, row))
        if (!mandate || !offer) {
            return undefined
        }
        const needs = this.needsOf(context, mandate)
        const cover = this.value('cover') ?? []
        if (cover.length !== needs.length) {
            return undefined
        }
        const data = {
            ...mandate,
            ...(cover.length > 0 ? { wildTiles: coverSpends(cover, needs) } : {})
        }
        return playUnless(
            reasonPlayMandateRefused(context.state, context.playerId, data),
            (maker) => maker.createPlayerAction(PlayMandate, data),
            { revealsInfo: offer.revealsInfo }
        )
    }

    private tilePlay(): FlowPlay | undefined {
        const tileId = this.value('tile')
        const good = this.value('good')
        return tileId && good
            ? {
                  build: (maker) => maker.createPlayerAction(SpendRegionTile, { tileId, ...good })
              }
            : undefined
    }

    private vesselPlay(): FlowPlay | undefined {
        const vesselType = this.value('vessel')
        const pawn = this.value('pawn')
        return vesselType && pawn !== undefined
            ? { build: (maker) => maker.createPlayerAction(PlaceVessel, { vesselType, pawn }) }
            : undefined
    }

    private sealPlay(): FlowPlay | undefined {
        const seal = this.value('seal')
        return seal
            ? { build: (maker) => maker.createPlayerAction(ReclaimImmunitySeal, { ...seal }) }
            : undefined
    }

    /** Contract, Pick conventions: pressing a pick again unpicks it. */
    private toggle<TStage extends 'list' | 'discard' | 'tile' | 'vessel'>(
        stage: TStage,
        value: AtWillValues[TStage]
    ) {
        if (this.value(stage) === value) {
            this.clearFrom(stage)
        } else {
            this.set(stage, value)
        }
    }

    private pressMandate(mandate: MandatePick) {
        if (AtWillDraft.sameMandate(this.value('mandate'), mandate)) {
            this.clearFrom('mandate')
        } else {
            this.set('mandate', mandate)
        }
    }

    /** R-4.4.2 Which writ is pressed ends whichever else was picked on the list. */
    private pressDiscard(writId: WritId) {
        this.clearFrom('mandate')
        this.toggle('discard', writId)
    }

    private chips(context: AtWillContext): AtWillPanel['chips'] {
        const open = this.value('list')
        const writs = new Set<WritId>([
            ...this.mandateOffers(context).map(({ writId }) => writId),
            ...this.discardOffers(context)
        ])
        const { vessels } = context.state.getPlayerState(context.playerId)
        const tiles = this.tileOffers(context)
        const vesselOffers = this.vesselOffers(context)
        // Contract, At-will actions: each chip is its piece and its count; the words its name.
        const [firstTile] = tiles
        const [firstVessel] = vesselOffers
        const counts: readonly (readonly [AtWillList, string, number, DraftArt | undefined])[] = [
            ['writs', 'Writs', writs.size, { kind: 'writ-back' }],
            ['tiles', 'Tiles', tiles.length, firstTile && tileArt(context.state, firstTile.tileId)],
            [
                'vessels',
                'Vessels',
                vesselOffers.reduce((sum, { vesselType }) => sum + vessels[vesselType], 0),
                firstVessel && { kind: 'vessel', vessel: firstVessel.vesselType }
            ],
            ['immunity', 'Immunity', this.sealOffers(context).length, { kind: 'seal' }]
        ]
        return counts
            .filter(([, , count]) => count > 0)
            .map(([list, name, count, art]) => ({
                list,
                ...draftChoice(`${name} ${count}`, open === list, () => {
                    this.toggle('list', list)
                }),
                ...(art ? { art, shown: String(count) } : {}),
                ...this.chipLights(list, context)
            }))
    }

    private writRows(context: AtWillContext): readonly WritRow[] {
        const mandates = this.mandateOffers(context)
        const discards = this.discardOffers(context)
        const ids = [...new Set<WritId>([...mandates.map(({ writId }) => writId), ...discards])]
        const picked = this.value('mandate')
        return ids.map((writId) => ({
            writId,
            name: writName(writId),
            choices: [
                ...mandates
                    .filter((offer) => offer.writId === writId)
                    .map((offer) =>
                        draftChoice(
                            mandateChoiceLabel(offer, context.state.supply),
                            AtWillDraft.sameMandate(picked, offer),
                            () => {
                                this.pressMandate({
                                    writId,
                                    ...(offer.alternative
                                        ? { alternative: offer.alternative }
                                        : {}),
                                    ...(offer.rewardGuild
                                        ? { rewardGuild: offer.rewardGuild }
                                        : {}),
                                    ...(offer.vessel ? { vessel: offer.vessel } : {})
                                })
                            }
                        )
                    ),
                ...discards
                    .filter((id) => id === writId)
                    .map(() =>
                        draftChoice('Discard', this.value('discard') === writId, () => {
                            this.pressDiscard(writId)
                        })
                    )
            ]
        }))
    }

    private writsPanel(context: AtWillContext): Partial<AtWillPanel> {
        const needs = this.needsOf(context, this.value('mandate'))
        const { regionTiles } = context.state.getPlayerState(context.playerId)
        return {
            writs: this.writRows(context),
            ...(needs.length > 0 && regionTiles.length !== needs.length
                ? {
                      covers: coverChoices(
                          context.state,
                          regionTiles,
                          this.value('cover') ?? [],
                          needs,
                          (after) => {
                              this.push('cover', after)
                          }
                      )
                  }
                : {})
        }
    }

    private tilesPanel(context: AtWillContext): Partial<AtWillPanel> {
        const offers = this.tileOffers(context)
        const tile = this.value('tile')
        const offer = offers.find(({ tileId }) => tileId === tile)
        const chosen = this.value('good')
        const { haversack } = context.state.supply
        return {
            // R-4.3.3 Each row is its tile, drawn, reading "Spend"; its name stays the row's name.
            tiles: offers.map(({ tileId }) => ({
                tileId,
                ...draftChoice(`Spend ${tileName(tileId)}`, tile === tileId, () => {
                    this.toggle('tile', tileId)
                }),
                art: tileArt(context.state, tileId),
                shown: 'Spend'
            })),
            ...(offer
                ? {
                      goods: [
                          ...offer.goods.map((good) => ({
                              good,
                              ...draftChoice(
                                  `${good} ${haversack[good]}`,
                                  chosen?.good === good && !chosen.sulfurToBarrel,
                                  () => {
                                      this.set('good', { good })
                                  }
                              ),
                              // R-4.3.3 The good is its cube beside the haversack's count.
                              shown: String(haversack[good])
                          })),
                          ...(offer.sulfurToBarrel
                              ? [
                                    {
                                        good: 'sulfur' as const,
                                        ...draftChoice(
                                            'Into the barrel',
                                            chosen?.sulfurToBarrel === true,
                                            () => {
                                                this.set('good', {
                                                    good: 'sulfur',
                                                    sulfurToBarrel: true
                                                })
                                            }
                                        )
                                    }
                                ]
                              : [])
                      ]
                  }
                : {})
        }
    }

    /** R-4.2.2, R-3.14.2 A chip that leads to the map brightens what its list would light. */
    private chipLights(list: AtWillList, context: AtWillContext): Pick<DraftChoice, 'lights'> {
        const { playerId } = context
        if (list === 'vessels') {
            const pawns = this.vesselOffers(context).flatMap((offer) => offer.pawns)
            return { lights: () => [...new Set(pawns)].map((n) => pawnTarget(playerId, n)) }
        }
        if (list === 'immunity') {
            const seals = this.sealOffers(context)
            return {
                lights: () =>
                    seals.map(({ spaceId, role }) => markerTarget(spaceId, playerId, role))
            }
        }
        return {}
    }

    private vesselsPanel(context: AtWillContext): Partial<AtWillPanel> {
        const vessel = this.value('vessel')
        return {
            vessels: this.vesselOffers(context).map(({ vesselType, pawns }) => ({
                vesselType,
                ...draftChoice(vesselType.replaceAll('-', ' '), vessel === vesselType, () => {
                    this.toggle('vessel', vesselType)
                }),
                art: { kind: 'vessel', vessel: vesselType },
                lights: () => pawns.map((n) => pawnTarget(context.playerId, n))
            }))
        }
    }

    panel: AtWillPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        if (!context) {
            return undefined
        }
        const chips = this.chips(context)
        if (chips.length === 0) {
            return undefined
        }
        return {
            chips,
            ...this.openList(context),
            ...this.primaryOf()
        }
    })

    private openList(context: AtWillContext): Partial<AtWillPanel> {
        switch (this.value('list')) {
            case 'writs':
                return this.writsPanel(context)
            case 'tiles':
                return this.tilesPanel(context)
            case 'vessels':
                return this.vesselsPanel(context)
            case 'immunity':
                return { line: 'Pick a marker.' }
            default:
                return {}
        }
    }

    /** R-X.2 Only for a send a press doesn't make: an auto stage, or something it would reveal. */
    private primaryOf(): Pick<AtWillPanel, 'primary'> {
        const { play } = this
        const list = this.value('list')
        if (!play) {
            return {}
        }
        const names: Record<AtWillList, string> = {
            writs: 'Play',
            tiles: 'Spend',
            vessels: 'Place',
            immunity: 'Take back the seal'
        }
        if (!list) {
            return {}
        }
        const label = primaryLabel(names[list], play)
        return {
            primary: {
                label,
                ...(list === 'vessels' ? { named: primaryLabel('Place vessel', play) } : {}),
                enabled: true
            }
        }
    }

    /** R-4.2.2, R-3.14.2 What the open list lights on the map. */
    private picks: readonly FlowPick[] = $derived.by(() => {
        const context = this.contextOf()
        if (!context) {
            return []
        }
        const list = this.value('list')
        if (list === 'vessels') {
            const vessel = this.value('vessel')
            const offer = this.vesselOffers(context).find(({ vesselType }) => vesselType === vessel)
            return (offer?.pawns ?? []).map((n) => ({
                target: pawnTarget(context.playerId, n),
                press: () => {
                    this.set('pawn', n)
                }
            }))
        }
        if (list === 'immunity') {
            return this.sealOffers(context).map(({ spaceId, role }) => ({
                target: markerTarget(spaceId, context.playerId, role),
                press: () => {
                    this.set('seal', { spaceId, role })
                }
            }))
        }
        return []
    })

    get pick(): StagePick | undefined {
        return this.picks.length > 0
            ? { targets: this.picks.map(({ target }) => ({ target })), picked: [] }
            : undefined
    }

    pickOf(target: BoardTarget): FlowPick | undefined {
        return this.picks.find((pick) => pick.target === target)
    }

    private static sameMandate(a: MandatePick | undefined, b: MandatePick): boolean {
        return (
            a?.writId === b.writId &&
            a.alternative === b.alternative &&
            a.rewardGuild === b.rewardGuild &&
            a.vessel === b.vessel
        )
    }
}
