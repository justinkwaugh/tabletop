<script lang="ts">
    import { seatOrder } from '$lib/model/seatPanel.js'
    import { seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /**
     * A phone's seat strip, standing in for the Players tab: one chip per seat, read from the one
     * derivation of the seat, so it shows no more of a hand than the panel does: a count. A press
     * opens that seat as a sheet.
     */
    const gameSession = getGameSession()

    let chips = $derived(
        seatOrder(gameSession.gameState).map((playerId) => {
            const view = gameSession.seatPanel(playerId)
            const name = gameSession.getPlayerName(playerId)
            const { backs, sealedBacks, faces, sealedFaces } = view.writs
            return {
                playerId,
                name,
                paint: seatPaint(gameSession.colors, playerId, name),
                score: view.ribbon.score,
                deciding: view.ribbon.deciding,
                cards: view.cards.handCount,
                writs: backs + sealedBacks + faces.length + sealedFaces.length
            }
        })
    )
</script>

<div class="flex h-[44px] shrink-0 gap-0.5 border-t border-feudum-divider" data-seat-strip>
    {#each chips as chip (chip.playerId)}
        <button
            type="button"
            class="chip flex min-w-0 flex-1 flex-col justify-center rounded-md px-1 text-left text-xs leading-tight text-feudum-text"
            class:deciding={chip.deciding}
            style:--seat-paint={chip.paint.fill}
            aria-label="Open {chip.name}'s seat"
            data-seat-chip={chip.playerId}
            data-deciding={chip.deciding ? '' : undefined}
            onclick={() => gameSession.layers.openSeat(chip.playerId)}
        >
            <span class="flex items-center gap-1 overflow-hidden">
                <span class="swatch" data-seat-chip-colour></span>
                <span class="truncate font-semibold" data-seat-chip-name>{chip.name}</span>
            </span>
            <span class="flex gap-1.5 whitespace-nowrap text-feudum-text-muted">
                <span data-seat-chip-score={chip.score}>{chip.score}vp</span>
                <span data-seat-chip-hand={chip.cards}>{chip.cards}c</span>
                <span data-seat-chip-writs={chip.writs}>{chip.writs}w</span>
            </span>
        </button>
    {/each}
</div>

<style>
    .chip {
        background: var(--feudum-surface-raised);
    }

    .swatch {
        flex: none;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--seat-paint);
    }

    .chip.deciding {
        animation: chip-pulse 2.5s infinite;
    }

    @keyframes chip-pulse {
        0%,
        100% {
            box-shadow: inset 0 0 0 2px transparent;
        }
        50% {
            box-shadow: inset 0 0 0 2px var(--feudum-accent);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .chip.deciding {
            animation: none;
            box-shadow: inset 0 0 0 2px var(--feudum-accent);
        }
    }
</style>
