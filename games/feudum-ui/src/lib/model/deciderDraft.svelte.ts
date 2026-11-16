import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { Good, TileId } from '@tabletop/feudum'
import type { BoardTarget, ChipNote } from './boardOffer.js'
import type { FlowPlay, PieceArt } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { primaryLabel, type SendPreview } from './confirmingSend.js'
import { StagedDraft } from './stagedDraft.svelte.js'
import { coverAfterPress } from './tileCover.js'
import { tileArt, tileName, type TileArt } from './tileName.js'
import type { TurnPrimary } from './turnDraft.svelte.js'

/**
 * The piece a follow-up's row offers: a held tile, a writ's back, a seal or a vessel. Each stands in
 * for the words, which stay the row's accessible name.
 */
export type DraftArt = TileArt | PieceArt

/** One row of a follow-up's panel. A dimmed row has its line and no `press` (contract: Pick conventions). */
export interface DraftChoice {
    readonly label: string
    /** The piece the row offers, drawn; the label stays the row's accessible name. */
    readonly art?: DraftArt
    /** The text beside the art, which stands for the tile's name. */
    readonly shown?: string
    readonly note?: ChipNote
    readonly picked: boolean
    readonly refusal?: string
    /** Dimmed with no line: other picks hold its room, and a press does nothing until one goes. */
    readonly spent?: boolean
    readonly press?: () => void
    /** What the row brightens on the board while pointed at (contract: Hover). */
    readonly lights?: () => readonly BoardTarget[]
}

export function draftChoice(
    label: string,
    picked: boolean,
    press: () => void,
    refusal?: string,
    note?: ChipNote
): DraftChoice {
    return { label, picked, ...(note ? { note } : {}), ...(refusal ? { refusal } : { press }) }
}

/** R-X.2 A choice whose room other picks hold: it stays, dimmed, until one of them goes. */
export function heldChoice(label: string, picked: boolean): DraftChoice {
    return { label, picked, spent: true }
}

/** Defined once the logic's refusal has passed. */
export function playUnless(
    refused: string | undefined,
    build: FlowPlay['build'],
    preview?: SendPreview
): FlowPlay | undefined {
    return refused ? undefined : { ...preview, build }
}

/**
 * R-4.4-H1 The tile rows: each picked tile, drawn, brings the next good owed. Once every short good
 * has its tile, the others wait, dimmed, with no line: the send appearing says it.
 */
export function coverChoices(
    state: Parameters<typeof tileArt>[0],
    tiles: readonly TileId[],
    picked: readonly TileId[],
    needs: readonly Good[],
    onPress: (after: readonly TileId[]) => void
): readonly DraftChoice[] {
    return tiles.map((tileId) => {
        const after = coverAfterPress(picked, tileId, needs)
        const label = `${tileName(tileId)} tile: ${needs.join(', ')}`
        const isPicked = picked.includes(tileId)
        return {
            ...(after
                ? draftChoice(label, isPicked, () => {
                      onPress(after)
                  })
                : heldChoice(label, isPicked)),
            art: tileArt(state, tileId),
            shown: `for ${needs.join(', ')}`
        }
    })
}

/** A one-good cost as a button shows it, and in full words, its accessible name. */
export interface GoodCost {
    readonly shown: string
    readonly named: string
}

/**
 * R-4.4-H1 What a button names as its one good's cost: the good, or the tile that brings it
 * ("Desert I for iron", named "Desert I tile for iron").
 */
export function oneGoodCost(good: Good, short: boolean, cover: readonly TileId[]): GoodCost {
    if (!short) {
        return { shown: `1 ${good}`, named: `1 ${good}` }
    }
    if (cover.length === 0) {
        return { shown: `a tile for ${good}`, named: `a tile for ${good}` }
    }
    const tile = tileName(cover[0])
    return { shown: `${tile} for ${good}`, named: `${tile} tile for ${good}` }
}

/** A send whose label says a cost shorter keeps the full words as its accessible name. */
export function costPrimary(
    words: (cost: string) => string,
    cost: GoodCost,
    enabled: boolean,
    preview?: SendPreview
): TurnPrimary {
    const label = primaryLabel(words(cost.shown), preview)
    const named = primaryLabel(words(cost.named), preview)
    return { label, ...(named === label ? {} : { named }), enabled }
}

/**
 * A follow-up's draft: it reads only while the session names this seat its decider (R-X.1), and a
 * lone choice reads through as an `auto` stage.
 */
export abstract class DeciderDraft<
    TValues extends Record<string, unknown>,
    TContext = TurnContext
> extends StagedDraft<TValues> {
    private readonly seeing: StagedSelectionState<TValues> = $derived.by(() => {
        const context = this.contextOf()
        return context ? this.withAutos(super.read(), context) : {}
    })

    constructor(
        stageOrder: readonly Extract<keyof TValues, string>[],
        protected readonly contextOf: () => TContext | undefined
    ) {
        super(stageOrder)
    }

    protected override read(): StagedSelectionState<TValues> {
        return this.seeing
    }

    protected withAutos(
        stages: StagedSelectionState<TValues>,
        _context: TContext
    ): StagedSelectionState<TValues> {
        return stages
    }
}
