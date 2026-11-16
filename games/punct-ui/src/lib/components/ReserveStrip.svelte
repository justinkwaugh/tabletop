<script lang="ts">
    import { MediaQuery } from 'svelte/reactivity'
    import { PIECE_KINDS } from '@tabletop/punct'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'

    // Your pieces in reserve, under the action panel: on your turn, the kind you bring in next is
    // chosen here. On a phone the four in the middle make one row and the kinds at either end drop
    // to a second, out at the sides, where they stand over the board's empty top corners rather
    // than pushing the board down.
    const session = getGameSession()
    const phone = new MediaQuery('max-width: 639px')

    const player = $derived(
        session.myPlayer ? session.gameState.getPlayerState(session.myPlayer.id) : undefined
    )
    const scale = $derived(phone.current ? 0.4 : 0.5)
</script>

<div class="strip" class:split={player !== undefined} class:rotated={session.rotatedBoard}>
    {#if player}
        {#each PIECE_KINDS as kind, index (kind)}
            {@const count = session.inReserve(player.playerId, kind)}
            {@const choosable = session.placeKinds.includes(kind)}
            <button
                type="button"
                class="kind"
                class:first={index === 0}
                class:last={index === PIECE_KINDS.length - 1}
                class:empty={count === 0}
                disabled={!choosable}
                aria-pressed={session.chosenKind === kind}
                aria-label="{count} {kind}"
                onclick={() => session.chooseKind(kind)}
            >
                <PieceIcon
                    color={player.color}
                    {kind}
                    {scale}
                    ring={choosable && session.chosenKind === kind}
                />
                <span class="count">{count}</span>
            </button>
        {/each}
    {/if}
</div>

<style>
    .strip {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
        min-height: 40px;
        padding: 2px 4px 4px;
        color: var(--punct-ink);
    }

    .kind {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 2px 3px;
        border-radius: 8px;
    }

    .kind:disabled {
        cursor: default;
    }

    /* The piece and its count fade, not the button: on a phone the ends' pad stays solid. */
    .kind.empty > :global(*) {
        opacity: 0.35;
    }

    .count {
        min-width: 1ch;
        font-size: 16px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    @media (max-width: 639px) {
        .strip {
            gap: 0;
        }

        .kind {
            padding: 0 1px;
        }

        .count {
            font-size: 15px;
        }

        /* The middle four across the top; the ends below them at the sides, the second row
           overlapping the board below by its own height. Only the pieces take taps there, and
           they stand on a pad of the table's colour, so a board zoomed in under them stays
           behind. */
        .strip.split {
            position: relative;
            z-index: 5;
            display: grid;
            grid-template-columns: minmax(0, 1fr) repeat(4, auto) minmax(0, 1fr);
            grid-template-rows: auto var(--second-row);
            margin-bottom: calc(-1 * var(--second-row));
            padding: 0 6px;
            pointer-events: none;
            --second-row: 40px;
        }

        /* Laid a quarter round, the board's top is a long flat edge with shallower corners. */
        .strip.split.rotated {
            margin-bottom: calc(12px - var(--second-row));
        }

        .split .kind {
            grid-row: 1;
            justify-self: center;
            pointer-events: auto;
        }

        .split .kind:nth-child(2) {
            grid-column: 2;
        }

        .split .kind:nth-child(3) {
            grid-column: 3;
        }

        .split .kind:nth-child(4) {
            grid-column: 4;
        }

        .split .kind:nth-child(5) {
            grid-column: 5;
        }

        .split .kind.first,
        .split .kind.last {
            grid-row: 2;
            padding: 0 4px;
            border-radius: 10px;
            background: var(--punct-table);
        }

        .split .kind.first {
            grid-column: 1;
            justify-self: start;
        }

        .split .kind.last {
            grid-column: 6;
            justify-self: end;
        }
    }
</style>
