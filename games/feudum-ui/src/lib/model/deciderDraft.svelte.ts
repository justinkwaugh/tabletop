import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { Good, TileId } from '@tabletop/feudum'
import type { ChipNote } from './boardOffer.js'
import type { FlowPlay } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import type { SendPreview } from './confirmingSend.js'
import { StagedDraft } from './stagedDraft.svelte.js'
import { coverAfterPress } from './tileCover.js'

/** One row of a follow-up's panel. A dimmed row has its line and no `press` (contract: Pick conventions). */
export interface DraftChoice {
    readonly label: string
    readonly note?: ChipNote
    readonly picked: boolean
    readonly refusal?: string
    readonly press?: () => void
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

/** Defined once the logic's refusal has passed. */
export function playUnless(
    refused: string | undefined,
    build: FlowPlay['build'],
    preview?: SendPreview
): FlowPlay | undefined {
    return refused ? undefined : { ...preview, build }
}

/** R-4.4-H1 The tile rows: each picked tile brings the next good owed. */
export function coverChoices(
    tiles: readonly TileId[],
    picked: readonly TileId[],
    needs: readonly Good[],
    onPress: (after: readonly TileId[]) => void
): readonly DraftChoice[] {
    return tiles.map((tileId) => {
        const after = coverAfterPress(picked, tileId, needs)
        return draftChoice(
            `Tile ${tileId}: ${needs.join(', ')}`,
            picked.includes(tileId),
            () => {
                if (after) {
                    onPress(after)
                }
            },
            after ? undefined : 'Every short good has its tile.'
        )
    })
}

/** R-4.4-H1 What a button names as its one good's cost: the good, or the tile that brings it. */
export function oneGoodCost(good: Good, short: boolean, cover: readonly TileId[]): string {
    if (!short) {
        return `1 ${good}`
    }
    return cover.length > 0 ? `tile ${cover[0]} for ${good}` : `a tile for ${good}`
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
