<svelte:options namespace="svg" />

<script lang="ts">
    import {
        BridgeSymbol,
        CoalSymbol,
        HornsSymbol,
        LockSymbol,
        OilSymbol,
        OreSymbol,
        PortSymbol,
        SkylineSymbol,
        type TileSymbolName
    } from './tileSymbols.js'
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

<!-- Annotations around a symbol may set a text halo stroke, which its shapes must not take. -->
{#if symbol === 'port'}
    <circle r={PortSymbol.radius} fill={paper} stroke="none"></circle>
    <g fill="none" stroke={ink} stroke-width={PortSymbol.strokeWidth} stroke-linecap="round">
        <circle cy={PortSymbol.ring.cy} r={PortSymbol.ring.r}></circle>
        <path d={PortSymbol.path}></path>
    </g>
{:else if symbol === 'horns'}
    <circle r={HornsSymbol.radius} fill={paper} stroke="none"></circle>
    {#each HornsSymbol.paths as path (path)}<path fill={ink} stroke="none" d={path}></path>{/each}
{:else if symbol === 'lock'}
    <circle r={LockSymbol.radius} fill={paper} stroke="none"></circle>
    <path fill="none" stroke={ink} stroke-width={LockSymbol.strokeWidth} d={LockSymbol.shackle}
    ></path>
    <path fill={ink} fill-rule="evenodd" stroke="none" d={LockSymbol.body}></path>
{:else if symbol === 'skyline'}
    <circle r={SkylineSymbol.radius} fill={paper} stroke="none"></circle>
    <g fill="none" stroke={ink} stroke-width={SkylineSymbol.strokeWidth} stroke-linejoin="round">
        <path d={SkylineSymbol.blocks}></path>
        <path stroke-linecap="round" d={SkylineSymbol.ground}></path>
    </g>
{:else if symbol === 'coal'}
    <circle r={CoalSymbol.radius} fill={paper} stroke="none"></circle>
    <path fill={ink} stroke="none" d={CoalSymbol.path}></path>
{:else if symbol === 'oil'}
    <circle r={OilSymbol.radius} fill={paper} stroke="none"></circle>
    <path fill={ink} stroke="none" d={OilSymbol.path}></path>
{:else if symbol === 'ore'}
    <circle r={OreSymbol.radius} fill={paper} stroke="none"></circle>
    <g fill="none" stroke={ink} stroke-width={OreSymbol.strokeWidth} stroke-linecap="round">
        <path d={OreSymbol.head}></path>
        <path d={OreSymbol.handle}></path>
    </g>
{:else if symbol === 'bridge'}
    <circle r={BridgeSymbol.radius} fill={paper} stroke="none"></circle>
    <g fill="none" stroke={ink} stroke-width={BridgeSymbol.strokeWidth} stroke-linecap="round">
        <path d={BridgeSymbol.deck}></path>
        <path d={BridgeSymbol.arch}></path>
    </g>
{/if}
