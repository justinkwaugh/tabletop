<script lang="ts">
    import type { Color } from '@tabletop/common'
    import {
        isPotentialKind,
        PieceKind,
        type HydratedGipfPotentialsPlayerState
    } from '@tabletop/gipf-potentials'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { DiscKind } from '$lib/board/pieceShape.js'
    import PieceIcon from './PieceIcon.svelte'

    // A player's potentials in hand, each kind as its potential with how many are left, dimmed
    // once none are. With `choose`, the pieces you could push next: a GIPF-piece while you may
    // bring one in, each kind loaded on a piece, and a plain piece, the chosen one ringed.
    let {
        player,
        color,
        size = 26,
        choices = [],
        chosen,
        choose
    }: {
        player: HydratedGipfPotentialsPlayerState
        color: Color
        size?: number
        choices?: PieceKind[]
        chosen?: PieceKind
        choose?: (kind: PieceKind) => void
    } = $props()

    const session = getGameSession()

    const NAMES: Record<PieceKind, string> = {
        [PieceKind.Basic]: 'plain piece',
        [PieceKind.Gipf]: 'GIPF-piece',
        [PieceKind.Tamsk]: 'TAMSK',
        [PieceKind.Zertz]: 'ZÈRTZ',
        [PieceKind.Dvonn]: 'DVONN',
        [PieceKind.Yinsh]: 'YINSH',
        [PieceKind.Punct]: 'PÜNCT'
    }

    const kinds: PieceKind[] = $derived(
        choose === undefined
            ? session.kindsInPlay
            : [
                  ...(choices.includes(PieceKind.Gipf) ? [PieceKind.Gipf] : []),
                  ...session.kindsInPlay,
                  PieceKind.Basic
              ]
    )

    function discsOf(kind: PieceKind): DiscKind[] {
        if (kind === PieceKind.Gipf) return [PieceKind.Basic, PieceKind.Basic]
        if (!isPotentialKind(kind)) return [PieceKind.Basic]
        return choose === undefined ? [kind] : [PieceKind.Basic, kind]
    }

    function countOf(kind: PieceKind): number | undefined {
        if (isPotentialKind(kind)) return session.inHand(player.playerId, kind)
        return kind === PieceKind.Basic ? session.reserveLeft(player.playerId) : undefined
    }
</script>

<div class="kinds">
    {#each kinds as kind (kind)}
        {@const count = countOf(kind)}
        {@const can = choices.includes(kind)}
        <button
            type="button"
            class="kind"
            class:can
            class:chosen={can && chosen === kind}
            class:empty={count === 0}
            disabled={!can || choose === undefined}
            title={count === undefined ? NAMES[kind] : `${NAMES[kind]}: ${count}`}
            aria-label={choose === undefined
                ? `${count} ${NAMES[kind]}`
                : isPotentialKind(kind)
                  ? `push a piece loaded with ${NAMES[kind]}`
                  : `push a ${NAMES[kind]}`}
            onclick={() => choose?.(kind)}
        >
            <PieceIcon {color} discs={discsOf(kind)} {size} />
            {#if count !== undefined}
                <span class="count">{count}</span>
            {/if}
        </button>
    {/each}
</div>

<style>
    .kinds {
        display: flex;
        gap: 2px;
        align-items: center;
    }

    .kind {
        display: inline-flex;
        align-items: center;
        gap: 1px;
        padding: 1px 5px 1px 3px;
        border-radius: 999px;
        border: 2px solid transparent;
        color: inherit;
        cursor: default;
    }

    .kind.can {
        cursor: pointer;
    }

    .kind.can:hover {
        background: rgb(255 255 255 / 0.08);
    }

    .kind.chosen {
        border-color: var(--gp-mark);
        background: rgb(94 240 255 / 0.22);
    }

    .kind.empty {
        opacity: 0.4;
    }

    .count {
        min-width: 1.2ch;
        font-size: 15px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }
</style>
