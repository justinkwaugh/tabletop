<script lang="ts">
    import SeatCard from '$lib/components/SeatCard.svelte'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import { scoreView } from '$lib/model/score.js'
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

    // R-6.2: once the game has ended, the seat's final total railroad by railroad (the phone's
    // score has four columns and leaves this breakdown to the open seat).
    const final = $derived(
        playerId === undefined
            ? undefined
            : scoreView(gameSession.gameState)?.rows.find((row) => row.playerId === playerId)
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
        {#if final}
            <table class="final" data-open-seat-final>
                <caption>Final total</caption>
                <tbody>
                    {#each final.holdings as holding (holding.railroadId)}
                        <tr data-final-railroad={holding.railroadId}>
                            <th scope="row">{RAILROAD_TAGS[holding.railroadId]}</th>
                            <td>{holding.text}</td>
                            <td>${holding.value}</td>
                        </tr>
                    {/each}
                    <tr>
                        <th scope="row">Shares</th>
                        <td></td>
                        <td>${final.shareValue}</td>
                    </tr>
                    <tr>
                        <th scope="row">Money</th>
                        <td></td>
                        <td>${final.money}</td>
                    </tr>
                    <tr class="total">
                        <th scope="row">Total</th>
                        <td>{final.winner ? 'wins' : ''}</td>
                        <td>${final.total}</td>
                    </tr>
                </tbody>
            </table>
        {/if}
        <div class="mt-2 flex justify-end">
            <button
                type="button"
                class="min-h-11 rounded bg-pp-paper px-4 text-sm text-pp-ink sm:min-h-0 sm:px-3 sm:py-1"
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

    /* Contract, "Phone layout": the seat card rises as a bottom sheet, up to 85 % of the
       dynamic viewport. */
    @media (width < 40rem) {
        .sheet {
            left: 0;
            right: 0;
            top: auto;
            bottom: 0;
            transform: none;
            width: auto;
            max-height: 85dvh;
            padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
            border-radius: 14px 14px 0 0;
            background: var(--pp-column);
            box-shadow: 0 -4px 18px var(--pp-veil);
        }
    }

    .final {
        width: 100%;
        margin-top: 8px;
        border-collapse: collapse;
        background: var(--pp-paper);
        color: var(--pp-ink);
        border-radius: 6px;
        font-size: 14px;
    }

    .final caption {
        caption-side: top;
        text-align: left;
        padding: 0 0 4px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--pp-muted);
    }

    .final th,
    .final td {
        padding: 4px 10px;
        border-top: 1px solid var(--pp-paper-line);
        text-align: right;
    }

    .final th {
        text-align: left;
        font-weight: 600;
    }

    .final tr.total td:last-child {
        font-family: Oswald, sans-serif;
        font-size: 18px;
    }
</style>
