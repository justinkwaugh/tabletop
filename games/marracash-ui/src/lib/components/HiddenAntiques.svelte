<script lang="ts">
    let { count }: { count: number } = $props()

    const CardWidth = 26
    const CardHeight = 36
    const Spread = 9
    const FanDegrees = 8
    const Back = '#8e2a22'
    const Gold = '#e0b54f'
    const Star =
        'M 0 -7 L 2 -2.6 L 6.5 -4.4 L 3.6 -0.4 L 6.5 3.6 L 2 2.2 L 0 6.6 L -2 2.2 L -6.5 3.6 L -3.6 -0.4 L -6.5 -4.4 L -2 -2.6 Z'

    let width = $derived(CardWidth + Spread * (count - 1) + 10)
    let middle = $derived((count - 1) / 2)
</script>

<svg {width} height={CardHeight + 10} viewBox="0 0 {width} {CardHeight + 10}" aria-hidden="true">
    {#each Array.from({ length: count }, (_, index) => index) as index (index)}
        <g
            transform="translate({5 + CardWidth / 2 + index * Spread} {CardHeight / 2 +
                6}) rotate({(index - middle) * FanDegrees})"
        >
            <rect
                x={-CardWidth / 2}
                y={-CardHeight / 2}
                width={CardWidth}
                height={CardHeight}
                rx="3"
                fill={Back}
                stroke="#3b120e"
                stroke-width="1"
            ></rect>
            <rect
                x={-CardWidth / 2 + 2.5}
                y={-CardHeight / 2 + 2.5}
                width={CardWidth - 5}
                height={CardHeight - 5}
                rx="2"
                fill="none"
                stroke={Gold}
                stroke-width="0.9"
            ></rect>
            <path d={Star} fill={Gold}></path>
        </g>
    {/each}
</svg>
