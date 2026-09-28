<svelte:options namespace="svg" />

<script lang="ts">
    import { PortSymbol, type TileSymbolName } from './tileSymbols.js'
    let {
        symbol,
        ink,
        paper
    }: {
        symbol: TileSymbolName
        ink: string
        paper: string
    } = $props()
</script>

{#if symbol === 'port'}
    <circle r={PortSymbol.radius} fill={paper}></circle>
    <g fill="none" stroke={ink} stroke-width={PortSymbol.strokeWidth} stroke-linecap="round">
        <circle cy={PortSymbol.ring.cy} r={PortSymbol.ring.r}></circle>
        <path d={PortSymbol.path}></path>
    </g>
{/if}
