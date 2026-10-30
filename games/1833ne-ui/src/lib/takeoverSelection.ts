import {
    getStagedSelectionEntry,
    getStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import { sameOwner, type Owner } from '@tabletop/18xx'
import type { ShareSwap } from '@tabletop/1833ne'

/** A takeover being offered: its target, then the shares swapped rather than paid for. */
export type TakeoverSelectionValues = { target: string; swaps: ShareSwap[] }
export type TakeoverSelection = StagedSelectionState<TakeoverSelectionValues>
export const TakeoverStageOrder = ['target', 'swaps'] as const

/** A train kind chosen to turn in. */
export type TurnInSelectionValues = { kind: string }
export type TurnInSelection = StagedSelectionState<TurnInSelectionValues>
export const TurnInStageOrder = ['kind'] as const

export type Chosen<Value> = { value: Value; source: StagedSelectionSource }

/**
 * The target chosen while it is still offered; otherwise the only target, auto-selected, which
 * Undo passes over as it is not stored.
 */
export function takeoverTarget(
    selection: TakeoverSelection,
    targetIds: readonly string[]
): Chosen<string> | undefined {
    const chosen = getStagedSelectionEntry<TakeoverSelectionValues, 'target'>(selection, 'target')
    if (chosen && targetIds.includes(chosen.value)) return chosen
    return targetIds.length === 1 ? { value: targetIds[0], source: 'auto' } : undefined
}

/** The swaps chosen, or the fewest that let the acquirer pay, auto-selected. */
export function takeoverSwaps(
    selection: TakeoverSelection,
    fewest: readonly ShareSwap[]
): Chosen<ShareSwap[]> {
    return (
        getStagedSelectionEntry<TakeoverSelectionValues, 'swaps'>(selection, 'swaps') ?? {
            value: [...fewest],
            source: 'auto'
        }
    )
}

// Choosing the target already shown records nothing for Undo to pop; a new one clears the swaps.
export function stageTakeoverTarget(
    selection: TakeoverSelection,
    targetId: string,
    shownTargetId: string | undefined
): TakeoverSelection {
    return targetId === shownTargetId
        ? selection
        : setStagedSelectionValue<TakeoverSelectionValues, 'target'>(
              selection,
              TakeoverStageOrder,
              'target',
              targetId,
              'manual'
          )
}

/** The swaps with one holder's count set, leaving out holders who swap none. */
export function withSwaps(swaps: readonly ShareSwap[], holder: Owner, shares: number): ShareSwap[] {
    const others = swaps.filter((swap) => !sameOwner(swap.holder, holder))
    return shares > 0 ? [...others, { holder, shares }] : others
}

export function stageTakeoverSwaps(
    selection: TakeoverSelection,
    swaps: ShareSwap[]
): TakeoverSelection {
    return setStagedSelectionValue<TakeoverSelectionValues, 'swaps'>(
        selection,
        TakeoverStageOrder,
        'swaps',
        swaps,
        'manual'
    )
}

export function chosenTurnInKind(selection: TurnInSelection): string | undefined {
    return getStagedSelectionValue<TurnInSelectionValues, 'kind'>(selection, 'kind')
}

export function stageTurnInKind(selection: TurnInSelection, kind: string): TurnInSelection {
    return setStagedSelectionValue<TurnInSelectionValues, 'kind'>(
        selection,
        TurnInStageOrder,
        'kind',
        kind,
        'manual'
    )
}
