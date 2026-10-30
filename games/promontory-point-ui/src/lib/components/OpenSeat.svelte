<script lang="ts">
    import SeatCard from '$lib/components/SeatCard.svelte'
    import { moneyLinesOfTurn, seatView } from '$lib/model/seatView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { aggregateTurns } from '$lib/utils/actionAggregator.js'

    const gameSession = getGameSession()
    const openSeat = gameSession.openSeat

    const playerId = $derived(
        openSeat.playerId !== undefined &&
            gameSession.gameState.players.some((player) => player.playerId === openSeat.playerId)
            ? openSeat.playerId
            : undefined
    )

    // The same derivation as the seat card, from the displayed state (History View included).
    const view = $derived(
        playerId === undefined
            ? undefined
            : seatView(gameSession.gameState, playerId, gameSession.myPlayer?.id)
    )

    const moneyLines = $derived.by(() => {
        if (playerId === undefined) {
            return []
        }
        const turn = aggregateTurns(
            gameSession.actions,
            gameSession.gameState,
            gameSession.myPlayer?.id
        ).at(-1)
        return moneyLinesOfTurn(turn?.actions ?? [], playerId)
    })

    // The enlarged view takes Escape first (it stops the key in the capture phase), so one press
    // closes one layer.
    function closeOnEscape(event: KeyboardEvent) {
        if (event.key === 'Escape' && openSeat.playerId !== undefined) {
            event.preventDefault()
            openSeat.close()
        }
    }
</script>

<svelte:window onkeydown={closeOnEscape} />

<!-- Contract, "Open seat": the seat at a readable size over the table. -->
{#if view !== undefined}
    <div
        class="backdrop fixed inset-0 z-40 bg-pp-veil"
        role="presentation"
        data-open-seat-backdrop
        onclick={() => openSeat.close()}
    ></div>
    <div
        class="sheet fixed z-40"
        role="dialog"
        aria-modal="true"
        aria-label="{gameSession.getPlayerName(view.playerId)}'s seat"
        data-open-seat={view.playerId}
    >
        <SeatCard {view} large {moneyLines} />
        <div class="mt-2 flex justify-end">
            <button
                type="button"
                class="rounded bg-pp-paper px-3 py-1 text-sm text-pp-ink"
                onclick={() => openSeat.close()}>Close</button
            >
        </div>
    </div>
{/if}

<style>
    .sheet {
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(
            520px,
            calc(100vw - 32px - env(safe-area-inset-left) - env(safe-area-inset-right))
        );
        max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
        overflow-y: auto;
    }
</style>
