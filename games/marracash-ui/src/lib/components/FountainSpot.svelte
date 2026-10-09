<script lang="ts">
    import { getFountain, MarketColor, type FountainState } from '@tabletop/marracash'
    import Pawn from '$lib/components/Pawn.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PawnHeight, PawnUnitSize, PawnWidth } from '$lib/utils/pawnShape.js'
    import { CellSize, cellCenter, clusterPositions } from '$lib/utils/boardGeometry.js'
    import {
        FountainPawnSize,
        fountainPawnPositions,
        MaxPawnsShown
    } from '$lib/utils/fountainPawns.js'
    import { CandidateHaloFilterId } from '$lib/utils/boardGeometry.js'
    import { PulsePeakSeconds, PulseSeconds } from '$lib/utils/routePreview.js'
    import {
        eightPointedStar,
        EntranceRadii,
        FountainRadii,
        FountainRimShadeId,
        FountainRippleRadii,
        fountainOutline,
        FountainShadowOffset,
        FountainWaterShadeId,
        octagon
    } from '$lib/utils/fountainShape.js'

    const TallySpacing = { x: 22, y: 24 }
    const TallyPawnOffset = -6
    const TallyCountOffset = { x: 3, y: 5 }
    const TallyPawnSize = 15
    const TallyPawnScale = TallyPawnSize / PawnUnitSize
    const TallyDigitWidth = 7
    const TallyPanelMargin = 5

    let {
        fountain,
        selectable,
        highlighted = selectable,
        selected,
        destination = false,
        label = `Fountain ${fountain.fountainId}`,
        onselect,
        onpreview,
        halo = true,
        layer = 'whole'
    }: {
        fountain: FountainState
        selectable: boolean
        highlighted?: boolean
        selected: boolean
        destination?: boolean
        label?: string
        onselect: () => void
        onpreview?: (previewing: boolean) => void
        halo?: boolean
        layer?: 'whole' | 'basin' | 'visitors'
    } = $props()

    let definition = $derived(getFountain(fountain.fountainId))
    let center = $derived(cellCenter(definition.coords))
    let outline = $derived(definition.entrance ? eightPointedStar : octagon)
    let radii = $derived(definition.entrance ? EntranceRadii : FountainRadii)
    const gameSession = getGameSession()

    let crowded = $derived(fountain.visitors.length > MaxPawnsShown)
    let pawns = $derived(
        fountainPawnPositions(fountain.visitors.length, center).map((position, index) => ({
            ...position,
            color: fountain.visitors[index]
        }))
    )
    let tally = $derived.by(() => {
        const present = Object.values(MarketColor)
            .map((color) => ({
                color,
                count: fountain.visitors.filter((visitor) => visitor === color).length
            }))
            .filter((entry) => entry.count > 0)
        return clusterPositions(present.length, center, TallySpacing).map((position, index) => ({
            ...position,
            ...present[index]
        }))
    })
    let tallyPanel = $derived.by(() => {
        const pawnHalfWidth = (PawnWidth / 2) * TallyPawnScale
        const pawnHalfHeight = (PawnHeight / 2) * TallyPawnScale
        const left = Math.min(...tally.map((entry) => entry.x + TallyPawnOffset - pawnHalfWidth))
        const right = Math.max(
            ...tally.map(
                (entry) =>
                    entry.x + TallyCountOffset.x + String(entry.count).length * TallyDigitWidth
            )
        )
        const top = Math.min(...tally.map((entry) => entry.y - pawnHalfHeight))
        const bottom = Math.max(...tally.map((entry) => entry.y + pawnHalfHeight))
        return {
            x: left - TallyPanelMargin,
            y: top - TallyPanelMargin,
            width: right - left + 2 * TallyPanelMargin,
            height: bottom - top + 2 * TallyPanelMargin
        }
    })
</script>

{#snippet basin()}
    {#if halo && destination}
        <path
            class="destination-pulse"
            style:--pulse-seconds="{PulseSeconds}s"
            style:--pulse-delay="{PulsePeakSeconds - PulseSeconds / 2}s"
            d={fountainOutline(center, definition.entrance)}
            fill="none"
            stroke="#ffffff"
            stroke-width="12"
            stroke-linejoin="round"
            filter="url(#{CandidateHaloFilterId})"
        ></path>
    {/if}
    {#if halo && highlighted && !selected}
        <path
            d={fountainOutline(center, definition.entrance)}
            fill="none"
            stroke="#ffffff"
            stroke-width="8"
            stroke-linejoin="round"
            filter="url(#{CandidateHaloFilterId})"
        ></path>
    {/if}
    {@const outer = fountainOutline(center, definition.entrance)}
    <path
        d={outer}
        transform="translate({FountainShadowOffset.x} {FountainShadowOffset.y})"
        fill="#3a2a14"
        opacity="0.3"
    ></path>
    {#if definition.entrance}
        <path d={outer} fill="#c99a2e" stroke="#8a6a1c" stroke-width="1"></path>
    {/if}
    <path
        d={outline(center, radii.rim)}
        fill="url(#{FountainRimShadeId})"
        stroke="#a8817a"
        stroke-width="1.2"
    ></path>
    <path
        d={outline(center, radii.water)}
        fill="url(#{FountainWaterShadeId})"
        stroke="#8f6c66"
        stroke-width="1"
    ></path>
    {#each FountainRippleRadii as radius (radius)}
        <circle
            cx={center.x}
            cy={center.y}
            r={radius}
            fill="none"
            stroke="#ffffff"
            stroke-opacity="0.16"
            stroke-width="1.4"
            stroke-dasharray="11 7"
        ></circle>
    {/each}
    <path
        d={outline(center, radii.water)}
        fill="none"
        stroke="#5a3a34"
        stroke-opacity="0.35"
        stroke-width="2.5"
    ></path>
    {#if selected}
        <path
            d={outline(center, radii.ring)}
            fill="none"
            stroke="#1f1f1f"
            stroke-width="4"
            stroke-linejoin="round"
        ></path>
    {/if}
{/snippet}

{#snippet visitors()}
    {#if crowded}
        <rect
            x={tallyPanel.x}
            y={tallyPanel.y}
            width={tallyPanel.width}
            height={tallyPanel.height}
            rx="6"
            fill="#ffffff"
            fill-opacity="0.7"
        ></rect>
        {#each tally as entry (entry.color)}
            <Pawn
                color={entry.color}
                x={entry.x + TallyPawnOffset}
                y={entry.y}
                size={TallyPawnSize}
            />
            <text
                x={entry.x + TallyCountOffset.x}
                y={entry.y + TallyCountOffset.y}
                font-size="12"
                font-weight="700"
                fill={gameSession.marketPalettes[entry.color].stroke}>{entry.count}</text
            >
        {/each}
    {:else}
        {#each pawns as pawn, index (index)}
            <Pawn color={pawn.color} x={pawn.x} y={pawn.y} size={FountainPawnSize} />
        {/each}
    {/if}
{/snippet}

{#snippet body()}
    {#if layer !== 'visitors'}
        {@render basin()}
    {/if}
    {#if layer !== 'basin'}
        {@render visitors()}
    {/if}
{/snippet}

<!-- One element whether or not the fountain can be chosen, so becoming choosable only changes
 its attributes and never repaints the basin. -->
{#if layer === 'visitors'}
    <g class="pointer-events-none" aria-hidden="true">{@render visitors()}</g>
{:else}
    <!-- tabindex is set only when the role is button; the checker cannot follow the condition -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <g
        role={selectable ? 'button' : undefined}
        tabindex={selectable ? 0 : undefined}
        aria-label={selectable ? label : undefined}
        class:cursor-pointer={selectable}
        onpointerenter={selectable ? () => onpreview?.(true) : undefined}
        onpointerleave={selectable ? () => onpreview?.(false) : undefined}
        onfocus={selectable ? () => onpreview?.(true) : undefined}
        onblur={selectable ? () => onpreview?.(false) : undefined}
        onclick={selectable ? () => onselect() : undefined}
        onkeydown={selectable ? (event) => event.key === 'Enter' && onselect() : undefined}
    >
        <rect
            x={center.x - CellSize / 2}
            y={center.y - CellSize / 2}
            width={CellSize}
            height={CellSize}
            fill="transparent"
            pointer-events={selectable ? undefined : 'none'}
        ></rect>
        {@render body()}
    </g>
{/if}

<style>
    .destination-pulse {
        animation: destination-pulse var(--pulse-seconds) ease-in-out var(--pulse-delay) infinite;
    }

    /* Peaks halfway through, so the delay lines the peak up with a dash's arrival. */
    @keyframes destination-pulse {
        0%,
        100% {
            opacity: 0.35;
        }
        50% {
            opacity: 1;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .destination-pulse {
            animation: none;
        }
    }
</style>
