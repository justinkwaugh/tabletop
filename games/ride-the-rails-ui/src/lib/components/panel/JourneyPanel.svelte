<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { linksAndFareText, seatGains, totalLinks } from '$lib/model/actionArea.js'
    import { routeSummary, routeText } from '$lib/utils/describeAction.js'
    import SeatChip from './SeatChip.svelte'

    const gameSession = getGameSession()

    // While a sent journey plays, the panel keeps showing it rather than asking for a new start.
    const sent = $derived(gameSession.updatingVisibleState ? gameSession.sentJourney : undefined)
    const draft = $derived(gameSession.journeyDraft ?? sent?.draft)
    const preview = $derived(gameSession.journeyPreview ?? sent?.preview)

    // R-3.3.3, R-3.3.4, R-3.3.5: the route, its links and fare, and what each seat would gain, the
    // rider among them.
    const route = $derived(
        preview ? routeSummary(preview.cityIds) : draft ? routeText([draft.startCityId]) : undefined
    )
    const facts = $derived(
        preview ? linksAndFareText(totalLinks(preview.linksPerRailroad), preview.fare) : undefined
    )
    const gains = $derived(
        preview ? seatGains(preview.payments, gameSession.gameState.turnManager.turnOrder) : []
    )

    // Phone layout: the per-seat chips fold behind a toggle.
    let seatsOpen = $state(false)
</script>

{#if !draft}
    <h2 class="text-base font-bold">Choose a passenger</h2>
{:else}
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="flex min-w-0 flex-col gap-1.5">
            <div class="flex flex-wrap items-baseline gap-x-3">
                <h2 class="text-base font-bold">{route}</h2>
                {#if facts && preview}
                    <span class="text-sm text-rtr-ink-muted">
                        {facts}
                    </span>
                    <button
                        type="button"
                        class="text-sm text-rtr-ink-muted underline sm:hidden"
                        aria-expanded={seatsOpen}
                        onclick={() => (seatsOpen = !seatsOpen)}
                        >{seatsOpen ? '▴' : '▾'} seats</button
                    >
                {/if}
            </div>
            {#if gains.length > 0}
                <div class="flex flex-wrap gap-1.5" class:max-sm:hidden={!seatsOpen}>
                    {#each gains as gain (gain.playerId)}
                        <SeatChip playerId={gain.playerId} text="${gain.amount}" />
                    {/each}
                </div>
            {/if}
        </div>
        <div class="flex flex-wrap gap-2">
            <button
                type="button"
                class="rounded-full border-2 border-rtr-pill bg-rtr-pill px-3.5 py-1 text-sm font-semibold text-rtr-pill-ink hover:enabled:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent disabled:opacity-50"
                disabled={!gameSession.canRideJourney}
                onclick={() => gameSession.rideJourney()}>Ride</button
            >
        </div>
    </div>
{/if}
