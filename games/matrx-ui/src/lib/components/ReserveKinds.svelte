<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { PieceKind, POTENTIAL_KINDS, type HydratedMatrxPlayerState } from '@tabletop/matrx'
    import PieceIcon from './PieceIcon.svelte'

    // A player's potentials in reserve: each kind as a single piece with how many pieces of it
    // are left, dimmed when too few remain to make a stack. With `choose`, each kind that can come
    // in is a button, the chosen one ringed.
    let {
        player,
        color,
        size = 26,
        choices = [],
        chosen,
        choose
    }: {
        player: HydratedMatrxPlayerState
        color: Color
        size?: number
        choices?: PieceKind[]
        chosen?: PieceKind
        choose?: (kind: PieceKind) => void
    } = $props()

    const NAMES: Record<PieceKind, string> = {
        [PieceKind.Gipf]: 'GIPF',
        [PieceKind.Tamsk]: 'TAMSK',
        [PieceKind.Zertz]: 'ZÈRTZ',
        [PieceKind.Dvonn]: 'DVONN',
        [PieceKind.Yinsh]: 'YINSH',
        [PieceKind.Punct]: 'PÜNCT'
    }
</script>

<div class="kinds">
    {#each POTENTIAL_KINDS as kind (kind)}
        {@const pieces = player.potentials[kind]}
        {@const can = choices.includes(kind)}
        <button
            type="button"
            class="kind"
            class:can
            class:chosen={can && chosen === kind}
            class:empty={player.stacksOf(kind) === 0}
            disabled={!can || choose === undefined}
            title="{NAMES[kind]}: {pieces} {pieces === 1 ? 'piece' : 'pieces'}"
            aria-label="bring in a {NAMES[kind]} stack"
            onclick={() => choose?.(kind)}
        >
            <PieceIcon {color} {kind} {size} />
            <span class="count">{pieces}</span>
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
        background: rgb(0 0 0 / 0.06);
    }

    .kind.chosen {
        border-color: var(--matrx-target);
        background: rgb(240 176 74 / 0.22);
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
