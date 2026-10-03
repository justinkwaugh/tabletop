<script lang="ts">
    import { mixColor } from '$lib/utils/colorMix.js'

    let { color }: { color: string } = $props()

    const STONE = '#fffaf0'
    const SHADOW = '#2a1a0a'
    const COLUMNS = [-11.5, -6.9, -2.3, 2.3, 6.9, 11.5]

    const stone = (amount: number) => mixColor(color, STONE, amount)
    const shadow = $derived(mixColor(color, SHADOW, 0.11))
</script>

<ellipse cx="1" cy="11.5" rx="20" ry="4" fill={shadow}></ellipse>
<rect x="-17" y="7.5" width="34" height="3" rx="0.4" fill={stone(0.42)}></rect>
<rect x="-15.5" y="5" width="31" height="2.8" rx="0.4" fill={stone(0.52)}></rect>
{#each COLUMNS as x (x)}
    <rect x={x - 1.4} y="-5.6" width="2.8" height="10.8" fill={stone(0.62)}></rect>
    <rect x={x + 0.4} y="-5.6" width="1" height="10.8" fill={stone(0.45)}></rect>
{/each}
<rect x="-14.5" y="-9" width="29" height="3.6" fill={stone(0.58)}></rect>
<path d="M -16 -9 L 0 -17.5 L 16 -9 Z" fill={stone(0.3)}></path>
<path d="M -11.5 -10.2 L 0 -15.8 L 11.5 -10.2 Z" fill={stone(0.5)}></path>
