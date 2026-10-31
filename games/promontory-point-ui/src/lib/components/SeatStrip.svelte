<script lang="ts">
    import { seatViews } from '$lib/model/seatView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    // Contract, "Full screen": the strip also shows inside full screen at every width.
    let { everyWidth = false }: { everyWidth?: boolean } = $props()

    // Contract, "Seat card": the same derivation as the seat cards, so the two never differ.
    const seats = $derived(seatViews(gameSession.gameState, gameSession.myPlayer?.id))
</script>

<!-- Contract, "Phone layout": one chip per seat in seat order; a press opens that seat card. -->
<div
    class="strip flex h-[50px] shrink-0 gap-1.5 px-2 py-[3px] {everyWidth ? '' : 'sm:hidden'}"
    data-seat-strip
>
    {#each seats as view (view.playerId)}
        {@const name = gameSession.getPlayerName(view.playerId)}
        <button
            type="button"
            class="chip"
            class:active={view.active}
            class:waiting={view.waitingTurn}
            aria-label="{name}, ${view.money}; open {name}'s seat"
            aria-expanded={gameSession.openSeat.playerId === view.playerId}
            data-seat-chip={view.playerId}
            data-active={view.active}
            data-waiting-turn={view.waitingTurn}
            onclick={() => gameSession.openSeat.toggle(view.playerId)}
        >
            <span
                class="swatch"
                style:background={gameSession.colors.getPlayerUiColor(view.playerId)}
            ></span>
            <span class="min-w-0 text-left">
                <!-- R-1.3-H1: money is public. -->
                <b class="money">${view.money}</b>
                <small class="name">{name}</small>
            </span>
        </button>
    {/each}
</div>

<style>
    .strip {
        background: var(--pp-column);
        border-top: 1px solid var(--pp-halo);
    }

    .chip {
        flex: 1 1 0;
        min-width: 0;
        min-height: 44px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 6px;
        border-radius: 6px;
        background: var(--pp-paper);
        color: var(--pp-ink);
    }

    /* R-X.1: the seat the state asks to decide. */
    .chip.active {
        box-shadow:
            0 0 0 2px var(--pp-halo),
            0 0 0 4px var(--pp-accent);
    }

    /* R-4.3-H4: the seat whose turn waits while a debtor decides. */
    .chip.waiting {
        outline: 2px dashed var(--pp-decided);
        outline-offset: 1px;
    }

    .swatch {
        flex: none;
        width: 12px;
        height: 26px;
        border-radius: 3px;
        border: 1px solid var(--pp-halo);
    }

    .money {
        display: block;
        font-family: Oswald, sans-serif;
        font-size: 15px;
        font-weight: 500;
        line-height: 1.1;
    }

    .name {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 10px;
        line-height: 1.1;
        color: var(--pp-ink-sub);
    }
</style>
