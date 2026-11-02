<script lang="ts">
    import { PIECE_KINDS } from '@tabletop/punct'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'

    // Your pieces in reserve, under the action panel at one height: on your turn, the kind you
    // bring in next is chosen here.
    const session = getGameSession()

    const player = $derived(
        session.myPlayer ? session.gameState.getPlayerState(session.myPlayer.id) : undefined
    )
</script>

<div class="strip">
    {#if player}
        {#each PIECE_KINDS as kind (kind)}
            {@const count = session.inReserve(player.playerId, kind)}
            {@const choosable = session.placeKinds.includes(kind)}
            <button
                type="button"
                class="kind"
                class:empty={count === 0}
                disabled={!choosable}
                aria-pressed={session.chosenKind === kind}
                aria-label="{count} {kind}"
                onclick={() => session.chooseKind(kind)}
            >
                <PieceIcon
                    color={player.color}
                    {kind}
                    scale={0.24}
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
        gap: 2px;
        min-height: 40px;
        padding: 2px 4px 4px;
        color: var(--punct-ink);
    }

    .kind {
        display: inline-flex;
        align-items: center;
        gap: 1px;
        padding: 2px 3px;
        border-radius: 8px;
    }

    .kind:disabled {
        cursor: default;
    }

    .kind.empty {
        opacity: 0.35;
    }

    .count {
        min-width: 1ch;
        font-size: 14px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    @media (max-width: 639px) {
        .strip {
            gap: 0;
        }

        .kind {
            padding: 2px 1px;
        }
    }
</style>
