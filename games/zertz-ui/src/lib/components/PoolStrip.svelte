<script lang="ts">
    import { hasAnyMarble, MARBLE_COLORS, type MarbleColor } from '@tabletop/zertz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MarbleIcon from './MarbleIcon.svelte'

    const session = getGameSession()

    const poolEmpty = $derived(!hasAnyMarble(session.gameState.pool))
    const myCaptures = $derived(
        session.myPlayer
            ? session.gameState.getPlayerState(session.myPlayer.id).captured
            : undefined
    )
    const supply = $derived(poolEmpty && session.canPlace ? myCaptures : session.gameState.pool)

    function selectable(color: MarbleColor): boolean {
        return session.placeableColors.includes(color) && session.placeableColors.length > 1
    }
</script>

<div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 max-sm:gap-x-1">
    <span
        class="text-[13px] uppercase tracking-[0.14em] text-(--zertz-ink-quiet) max-sm:text-[11px] max-sm:tracking-[0.08em]"
    >
        {poolEmpty ? (session.canPlace ? 'Your captures' : 'Pool empty') : 'Pool'}
    </span>
    {#if supply}
        {#each MARBLE_COLORS as color (color)}
            {@const chosen = session.chosenColor === color}
            <button
                type="button"
                class="pool-choice"
                class:chosen
                class:selectable={selectable(color)}
                disabled={!selectable(color)}
                aria-pressed={chosen}
                aria-label="{color} marble, {supply[color]} left"
                onclick={() => session.chooseColor(color)}
            >
                <MarbleIcon {color} size={26} faded={supply[color] === 0} />
                <span class="count">{supply[color]}</span>
            </button>
        {/each}
    {/if}
</div>

<style>
    .pool-choice {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px 4px 6px;
        border-radius: 999px;
        border: 2px solid transparent;
        color: var(--zertz-ink);
        cursor: default;
    }

    .pool-choice.selectable {
        cursor: pointer;
        border-color: rgb(242 193 78 / 0.35);
    }

    .pool-choice.selectable:hover {
        background: rgb(255 255 255 / 0.06);
    }

    .pool-choice.chosen {
        border-color: var(--zertz-place);
        background: rgb(242 193 78 / 0.12);
    }

    @media (max-width: 639px) {
        .pool-choice {
            padding: 3px 7px 3px 4px;
            gap: 4px;
        }
    }

    .count {
        min-width: 1.2em;
        font-variant-numeric: tabular-nums;
        font-size: 17px;
    }
</style>
