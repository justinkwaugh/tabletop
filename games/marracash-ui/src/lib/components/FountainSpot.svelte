<script lang="ts">
    import { getFountain, MarketColor, type FountainState } from '@tabletop/marracash'
    import Pawn from '$lib/components/Pawn.svelte'
    import { cellCenter, clusterPositions } from '$lib/utils/boardGeometry.js'

    const MaxPawnsShown = 9

    let {
        fountain,
        selectable,
        selected,
        onselect
    }: {
        fountain: FountainState
        selectable: boolean
        selected: boolean
        onselect: () => void
    } = $props()

    let definition = $derived(getFountain(fountain.fountainId))
    let center = $derived(cellCenter(definition.coords))
    let crowded = $derived(fountain.visitors.length > MaxPawnsShown)
    let pawns = $derived(
        clusterPositions(fountain.visitors.length, center, 21).map((position, index) => ({
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
        return clusterPositions(present.length, center, 29).map((position, index) => ({
            ...position,
            ...present[index]
        }))
    })
</script>

{#snippet body()}
    {#if selectable || selected}
        <circle
            cx={center.x}
            cy={center.y}
            r="39"
            fill="none"
            stroke={selected ? '#1f1f1f' : '#ffffff'}
            stroke-width="4"
            stroke-dasharray={selected ? undefined : '8 5'}
        />
    {/if}
    <circle
        cx={center.x}
        cy={center.y}
        r="34"
        fill="#9fd3e6"
        stroke={definition.entrance ? '#c99a2e' : '#5b8fa3'}
        stroke-width={definition.entrance ? 6 : 3}
    />
    <circle cx={center.x} cy={center.y} r="26" fill="#cfeaf3" opacity="0.7" />
    <text
        x={center.x - 30}
        y={center.y - 22}
        font-size="12"
        font-weight="700"
        fill="#2d5566">{fountain.fountainId}</text
    >
    {#if crowded}
        {#each tally as entry (entry.color)}
            <Pawn color={entry.color} x={entry.x - 6} y={entry.y} size={15} />
            <text
                x={entry.x + 3}
                y={entry.y + 5}
                font-size="12"
                font-weight="700"
                fill="#1f3c47">{entry.count}</text
            >
        {/each}
    {:else}
        {#each pawns as pawn, index (index)}
            <Pawn color={pawn.color} x={pawn.x} y={pawn.y} size={18} />
        {/each}
    {/if}
{/snippet}

{#if selectable}
    <g
        role="button"
        tabindex="0"
        aria-label={`Fountain ${fountain.fountainId}`}
        class="cursor-pointer"
        onclick={() => onselect()}
        onkeydown={(event) => event.key === 'Enter' && onselect()}
    >
        {@render body()}
    </g>
{:else}
    <g>{@render body()}</g>
{/if}
