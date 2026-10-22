<script lang="ts">
    import { ACTIVE_COLORS, type PieceColor } from '@tabletop/lyngk'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PIECE_STYLES } from '$lib/board/pieceStyle.js'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()

    // The five claim pieces beside the board: each player's claims on their side, the
    // neutral colors between them.
    const [first, second] = $derived(session.gameState.players)
    const neutral = $derived(session.gameState.unclaimedColors())

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    function label(color: PieceColor): string {
        return `claim ${PIECE_STYLES[color].name}`
    }
</script>

{#snippet claims(playerId: string, colors: PieceColor[])}
    <div class="side">
        <span
            class="name"
            style:background={session.colors.getPlayerBgColorValue(playerId)}
            style:color={session.colors.getPlayerTextColorValue(playerId)}>{nameOf(playerId)}</span
        >
        <span class="claims">
            {#each colors as color (color)}
                <PieceIcon stack={[color]} size={36} />
            {/each}
        </span>
    </div>
{/snippet}

<div class="strip">
    {@render claims(first.playerId, first.claimed)}
    <div class="neutral" aria-label="Neutral colors">
        {#each ACTIVE_COLORS as color (color)}
            {#if neutral.includes(color)}
                {@const claimable = session.claimable.includes(color)}
                <button
                    type="button"
                    class="token"
                    class:claimable
                    disabled={!claimable}
                    aria-label={label(color)}
                    title={claimable
                        ? `Claim ${PIECE_STYLES[color].name}`
                        : PIECE_STYLES[color].name}
                    onclick={() => session.claim(color)}
                >
                    <PieceIcon stack={[color]} size={36} />
                </button>
            {/if}
        {/each}
    </div>
    {@render claims(second.playerId, second.claimed)}
</div>

<style>
    .strip {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 8px;
        height: 58px;
        padding: 0 12px;
    }

    .side {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .side:last-child {
        flex-direction: row-reverse;
    }

    .claims {
        display: flex;
        gap: 4px;
    }

    /* On a phone each player's name sits over their claimed colors, so the strip keeps its
       height and the neutral colors keep their size. */
    @media (max-width: 639px) {
        .strip {
            padding: 0 8px;
            gap: 6px;
        }

        .side {
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
        }

        .side:last-child {
            flex-direction: column;
            align-items: flex-end;
        }

        .side .name {
            max-width: 100%;
            font-size: 13px;
        }

        .claims {
            min-height: 20px;
        }

        .side :global(svg) {
            width: 26px;
            height: auto;
        }

        .neutral {
            gap: 2px;
            padding: 3px 6px;
        }

        .token :global(svg) {
            width: 30px;
            height: auto;
        }
    }

    .name {
        max-width: 9em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 1px 8px;
        border-radius: 999px;
        font-size: 15px;
        font-weight: 600;
    }

    .neutral {
        display: flex;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        background: var(--lyngk-tray);
    }

    .token {
        display: inline-flex;
        padding: 3px;
        border-radius: 999px;
        outline: 2.5px solid transparent;
        transition: outline-color 0.2s;
    }

    .token:disabled {
        cursor: default;
    }

    .token.claimable {
        outline-color: var(--lyngk-mark);
        cursor: pointer;
    }

    .token.claimable:hover {
        outline-width: 3.5px;
    }
</style>
