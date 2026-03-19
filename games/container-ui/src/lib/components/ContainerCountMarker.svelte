<script lang="ts">
    import Container from '$lib/components/Container.svelte'

    let {
        x,
        y,
        height,
        color,
        count,
        countFontSize = 18,
        countOffsetY = 19
    }: {
        x: number
        y: number
        height: number
        color: string
        count: number
        countFontSize?: number
        countOffsetY?: number
    } = $props()

    const width = $derived(height * (23.83 / 65.28))
</script>

{#if count > 0}
    <g>
        <Container {x} {y} {height} {color} />
        <text
            x={x + width / 2}
            y={y + height + countOffsetY}
            fill="#333"
            font-size={countFontSize}
            font-weight="700"
            text-anchor="middle"
        >
            {count}
        </text>
    </g>
{/if}
