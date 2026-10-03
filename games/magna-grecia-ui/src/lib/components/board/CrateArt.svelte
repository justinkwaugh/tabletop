<script lang="ts" module>
    export type CrateState = 'full' | 'empty' | 'sold'
</script>

<script lang="ts">
    import { mixColor } from '$lib/utils/colorMix.js'

    let { color, state }: { color: string; state: CrateState } = $props()

    const INK = '#1a1208'
    const WOOD = '#9a6b3c'
    const WOOD_GRAIN = '#6e4a26'
    const ROPE = '#e6d3a3'
    const SOLD_WASH = '#bdb8b0'
    const GRAPE = '#6e3f93'
    const GRAPES = [
        [0, 0],
        [-2.2, -1.6],
        [2.2, -1.6],
        [-1.1, -3.4],
        [1.1, -3.4],
        [0, -5.1],
        [-3.2, -3.6],
        [3.2, -3.6]
    ]
    const FRUIT = [
        { x: 5.6, y: -3.6, r: 3.4, fill: '#f0a35a' },
        { x: 0.2, y: -7.2, r: 3.5, fill: '#6f9a3a' },
        { x: -1.5, y: -2.4, r: 2.6, fill: '#e07b2a' }
    ]
    const SLATS = [
        { y: 0, height: 4.2 },
        { y: 5, height: 4.2 },
        { y: 10, height: 4 }
    ]
    const X_PATH = 'M -4.95 -0.18 L 4.95 9.18 M 4.95 -0.18 L -4.95 9.18'

    const sold = $derived(state === 'sold')
    const tone = (hex: string) => (sold ? mixColor(hex, SOLD_WASH, 0.45) : hex)
    const ink = $derived(tone(INK))
    const slat = $derived(tone(color))
    const back = $derived(tone(mixColor(color, '#000000', 0.45)))
    const inside = $derived(mixColor(color, '#000000', 0.4))
    const rim = $derived(mixColor(color, '#ffffff', 0.3))
    const lidSeam = $derived(tone(mixColor(color, '#000000', 0.3)))
</script>

<g transform={sold ? 'translate(0 1) scale(0.9)' : undefined}>
    {#if sold}
        <path
            d="M -11 -1 L -8.5 -5 H 8.5 L 11 -1 Z"
            fill={slat}
            stroke={ink}
            stroke-width="1"
            stroke-linejoin="round"
        ></path>
        <path d="M -9.8 -3 H 9.8" stroke={lidSeam} stroke-width="0.8"></path>
    {:else}
        <path
            d="M -11 -1 L -8.5 -5 H 8.5 L 11 -1 Z"
            fill={inside}
            stroke={INK}
            stroke-width="1"
            stroke-linejoin="round"
        ></path>
        <path d="M -8.5 -5 H 8.5" stroke={rim} stroke-width="1.4"></path>
    {/if}
    {#if state === 'full'}
        {#each GRAPES as [dx, dy], index (index)}
            <circle
                cx={-5.5 + dx}
                cy={-2 + dy}
                r="1.75"
                fill={GRAPE}
                stroke={INK}
                stroke-width="0.55"
            ></circle>
        {/each}
        {#each FRUIT as fruit, index (index)}
            <circle
                cx={fruit.x}
                cy={fruit.y}
                r={fruit.r}
                fill={fruit.fill}
                stroke={INK}
                stroke-width="0.7"
            ></circle>
            <circle
                cx={fruit.x - fruit.r * 0.35}
                cy={fruit.y - fruit.r * 0.35}
                r={fruit.r * 0.3}
                fill="rgba(255, 255, 255, 0.4)"
            ></circle>
        {/each}
    {/if}
    <rect x="-11" y="-1" width="22" height="15" rx="1" fill={back} stroke={ink} stroke-width="1.2"
    ></rect>
    {#each SLATS as { y, height } (y)}
        <rect x="-11" {y} width="22" {height} fill={slat} stroke={ink} stroke-width="0.9"></rect>
    {/each}
    <path d="M -10 1 H 10" stroke="rgba(255, 255, 255, 0.45)" stroke-width="0.9"></path>
    <rect x="-11" y="-1" width="3" height="15" fill={tone(WOOD)} stroke={ink} stroke-width="0.9"
    ></rect>
    <rect x="8" y="-1" width="3" height="15" fill={tone(WOOD)} stroke={ink} stroke-width="0.9"
    ></rect>
    <path d="M -9.5 0.5 V 12.5 M 9.5 0.5 V 12.5" stroke={tone(WOOD_GRAIN)} stroke-width="0.5"
    ></path>
    {#if sold}
        <path d="M -3 -5 L -4 14 M 3 -5 L 4 14" stroke={tone(ROPE)} stroke-width="1.6"></path>
        <path
            d="M -3 -5 L -4 14 M 3 -5 L 4 14"
            stroke={ink}
            stroke-width="0.4"
            stroke-dasharray="1 1"
        ></path>
    {/if}
</g>
{#if sold}
    <path d={X_PATH} stroke={INK} stroke-width="3.9" stroke-linecap="round"></path>
    <path d={X_PATH} stroke={color} stroke-width="2.3" stroke-linecap="round"></path>
{/if}
