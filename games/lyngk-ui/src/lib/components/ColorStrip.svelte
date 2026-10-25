<script lang="ts">
    import { flip } from 'svelte/animate'
    import type { PieceColor } from '@tabletop/lyngk'
    import { claimFlight } from '$lib/animators/claimFlight.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PIECE_STYLES } from '$lib/board/pieceStyle.js'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()

    // The five claim pieces beside the board: each player's claims on their side, the
    // neutral colors between them.
    const [first, second] = $derived(session.gameState.players)
    const neutral = $derived(session.gameState.unclaimedColors())
    // A claimed color flies from the neutral pieces to its player's side, and back when taken back.
    const { send, receive } = claimFlight()

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
                <span
                    class="claim"
                    in:receive={{ key: color }}
                    out:send={{ key: color }}
                    animate:flip={{ duration: 250 }}
                >
                    <PieceIcon stack={[color]} size={36} />
                </span>
            {/each}
        </span>
    </div>
{/snippet}

<div class="strip">
    {@render claims(first.playerId, first.claimed)}
    <div class="neutral" aria-label="Neutral colors">
        {#each neutral as color (color)}
            {@const claimable = session.claimable.includes(color)}
            <button
                type="button"
                class="token"
                class:claimable
                disabled={!claimable}
                aria-label={label(color)}
                title={claimable ? `Claim ${PIECE_STYLES[color].name}` : PIECE_STYLES[color].name}
                onclick={() => session.claim(color)}
                in:receive={{ key: color }}
                out:send={{ key: color }}
                animate:flip={{ duration: 250 }}
            >
                <PieceIcon stack={[color]} size={36} ring={claimable} />
            </button>
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

    /* The second player's side mirrors the first: name outermost, each new claim beyond the
       last, so nothing shifts when one lands. */
    .side:last-child,
    .side:last-child .claims {
        flex-direction: row-reverse;
    }

    .claims {
        display: flex;
        gap: 4px;
    }

    .claim {
        display: inline-flex;
    }

    /* On a phone the strip stays one row, as short as the neutral colors allow, to leave height
       for the board. The five colors always fit; a long name gives way. */
    @media (max-width: 639px) {
        .strip {
            height: 38px;
            margin-top: 6px;
            padding: 0 6px;
            gap: 6px;
        }

        .side {
            gap: 4px;
        }

        .side .name {
            min-width: 0;
            padding: 1px 6px;
            font-size: 13px;
        }

        .claims {
            flex-shrink: 0;
            gap: 2px;
        }

        .side :global(svg) {
            width: 26px;
            height: auto;
        }

        .strip .neutral {
            gap: 3px;
            padding: 0 6px;
        }

        /* The pieces as wide as before, 30px, with room for the ring around each. */
        .token :global(svg) {
            width: 38.3px;
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

    /* Each token keeps room for its ring, so the rings never meet. */
    .neutral {
        display: flex;
        gap: 4px;
        padding: 0 12px;
        border-radius: 999px;
        background: var(--lyngk-card);
        box-shadow: 0 1px 4px rgb(60 45 25 / 0.2);
    }

    .token {
        display: inline-flex;
    }

    .token:disabled {
        cursor: default;
    }

    .token.claimable {
        cursor: pointer;
    }

    .token.claimable:hover {
        --ring-width: 3.5px;
        --ring-width-under: 5.5px;
    }
</style>
