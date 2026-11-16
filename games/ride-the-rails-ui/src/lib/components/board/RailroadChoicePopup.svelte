<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import type { ChipPill, MarkTone, RailroadChoice } from '$lib/utils/pickMarks.js'
    import { isPhoneWidth, popupSide } from '$lib/utils/phoneLayout.svelte.js'
    import RailroadPieceIcon from './RailroadPieceIcon.svelte'

    let {
        choice,
        reference,
        onChoose
    }: {
        choice: RailroadChoice
        reference: string
        onChoose: (railroadId: RailroadId) => void
    } = $props()

    // The map's cube, a little larger on a phone, where the button is a 54 px tap target.
    const iconSize = $derived(isPhoneWidth() ? 29 : 25)

    const PILL_FILL: Readonly<Record<MarkTone, string>> = {
        coin: 'var(--rtr-coin)',
        five: 'var(--rtr-five)',
        gold: 'var(--rtr-gold)',
        cost: 'var(--rtr-cost)'
    }

    function pillInk(pill: ChipPill): string {
        return pill.tone === 'coin' ? 'var(--rtr-coin-ink)' : 'var(--rtr-white)'
    }

    // The mountain mark's peak, the board's mountain mark in small.
    const PEAK = 'M-9 0 L-3 -8 L1 -3 L4 -6 L9 0 Z'
</script>

<!-- Contract, Build and Ride (U-2): the popup beside the picked hex, one cube button per railroad
     and no words; a pill shows what a placement earns and a peak that the hex is a mountain. Each
     button's accessible name says the whole choice. -->
<Floater {reference} placement={popupSide('right')} offset={8} trigger="manual">
    <div
        class="flex gap-1.5 rounded-lg border border-rtr-card-edge bg-rtr-panel p-1.5"
        role="group"
        aria-label={choice.title}
        data-railroad-choice
    >
        {#each choice.chips as chip (chip.railroadId)}
            <button
                type="button"
                class="relative flex size-11.5 items-center justify-center rounded-md border border-rtr-line bg-rtr-white hover:enabled:border-rtr-accent focus-visible:outline-2 focus-visible:outline-rtr-accent max-sm:size-13.5"
                aria-label={chip.label}
                onclick={() => onChoose(chip.railroadId)}
            >
                <RailroadPieceIcon railroadId={chip.railroadId} size={iconSize} />
                {#if chip.pills.length > 0}
                    <span
                        class="absolute -top-1.75 -right-2 flex gap-0.5"
                        aria-hidden="true"
                        data-chip-pills
                    >
                        {#each chip.pills as pill (pill.text)}
                            <span
                                class="rtr-serif rounded-[9px] border border-rtr-ink px-1.25 text-[11px] leading-4"
                                style:background-color={PILL_FILL[pill.tone]}
                                style:color={pillInk(pill)}>{pill.text}</span
                            >
                        {/each}
                    </span>
                {/if}
                {#if chip.mountain}
                    <span
                        class="absolute -right-1.75 -bottom-1.5 flex h-3.75 w-5 items-center justify-center rounded border border-rtr-hex-edge bg-rtr-mountain"
                        aria-hidden="true"
                        data-chip-mountain
                    >
                        <svg width="13" height="9" viewBox="-9.5 -8.5 19 9">
                            <path d={PEAK} fill="var(--rtr-mountain-ink)"></path>
                        </svg>
                    </span>
                {/if}
            </button>
        {/each}
    </div>
</Floater>
