<script lang="ts">
    import type { CityCapacity, HexId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexDetailFacts } from '$lib/utils/boardPieces.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import LocomotiveIcon from './LocomotiveIcon.svelte'

    let { hexId }: { hexId: HexId } = $props()

    const gameSession = getGameSession()

    const facts = $derived(hexDetailFacts(gameSession.gameState, hexId))

    let card: HTMLElement | undefined = $state()

    // R-4.1.4
    function holds(capacity: CityCapacity): string {
        return capacity === 'unlimited'
            ? 'Any number of locomotives'
            : `${capacity} locomotive${capacity === 1 ? '' : 's'}`
    }

    function close() {
        gameSession.closeHexDetail()
    }

    // Contract, Look: hex detail ends on Escape or the next press anywhere; a press on a hex is the
    // session's to handle, since another unlit hex moves the detail there.
    function onWindowKey(event: KeyboardEvent) {
        if (event.key === 'Escape') close()
    }

    function onWindowClick(event: MouseEvent) {
        const target = event.target
        if (!(target instanceof Node) || card?.contains(target)) return
        if (target instanceof Element && target.closest('[data-hex-id]')) return
        close()
    }
</script>

<svelte:window onkeydown={onWindowKey} onclick={onWindowClick} />

<section
    bind:this={card}
    class="w-60 rounded-lg border border-rtr-line bg-rtr-panel-raised p-2.5 text-sm text-rtr-ink shadow-lg"
    aria-label="{facts.title}: hex detail"
>
    <header class="flex items-start justify-between gap-2">
        <h3 class="rtr-display text-base leading-tight">{facts.title}</h3>
        <button
            type="button"
            class="-mt-0.5 rounded px-1 text-lg leading-none text-rtr-ink-muted hover:text-rtr-ink"
            aria-label="Close"
            onclick={close}>×</button
        >
    </header>
    <dl class="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt class="text-rtr-ink-muted">Holds</dt>
        <dd>{holds(facts.capacity)}</dd>
        <dt class="text-rtr-ink-muted">Track</dt>
        <dd class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {#each facts.locomotives as railroadId (railroadId)}
                <span class="inline-flex items-center gap-1">
                    <LocomotiveIcon {railroadId} width={20} />{railroadStyle(railroadId).name}
                </span>
            {:else}
                None
            {/each}
        </dd>
        {#if facts.startColours.length > 0}
            <dt class="text-rtr-ink-muted">Starts</dt>
            <dd class="flex flex-wrap items-center gap-x-2">
                {#each facts.startColours as railroadId (railroadId)}
                    <span class="inline-flex items-center gap-1">
                        <span
                            class="inline-block size-2.5 rounded-full border border-rtr-halo"
                            style:background-color={railroadStyle(railroadId).fill}
                        ></span>{railroadStyle(railroadId).name}
                    </span>
                {/each}
            </dd>
        {/if}
        {#if facts.bonus}
            <dt class="text-rtr-ink-muted">Bonus</dt>
            <dd>{facts.bonus.label}</dd>
        {/if}
        {#if facts.transcontinentalEnd}
            <dt class="text-rtr-ink-muted">Transcontinental</dt>
            <dd>{facts.transcontinentalEnd}</dd>
        {/if}
        {#if facts.passenger !== undefined}
            <dt class="text-rtr-ink-muted">Passenger</dt>
            <dd>{facts.passenger ? 'Waiting' : 'None'}</dd>
        {/if}
    </dl>
</section>
