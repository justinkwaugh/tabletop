<script lang="ts">
    import { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Solid silhouettes in the market colour; details are cut out in the colour behind them
    let { color, cutout }: { color: MarketColor; cutout: string } = $props()
    const gameSession = getGameSession()

    const LanternPiercings = [
        { x: 16, y: 18 },
        { x: 20, y: 17.6 },
        { x: 24, y: 18 },
        { x: 18, y: 25 },
        { x: 22, y: 25 }
    ]

    let fill = $derived(gameSession.marketPalettes[color].fill)
</script>

{#snippet cut(d: string)}
    <path {d} fill="none" stroke={cutout} stroke-width="1.1" stroke-linecap="round"></path>
{/snippet}

<g {fill}>
    {#if color === MarketColor.Red}
        <circle cx="20" cy="3.6" r="1.9" fill="none" stroke={fill} stroke-width="1.6"></circle>
        <path d="M14 12 Q20 5 26 12 Z"></path>
        <path d="M12.5 12 H27.5 V14.5 H12.5 Z"></path>
        <path d="M13 14.5 H27 L29 26 Q20 31.5 11 26 Z"></path>
        <path d="M18 30 L22 30 L20 36.5 Z"></path>
        {@render cut('M11.6 21 Q20 23 28.4 21')}
        {#each LanternPiercings as hole (`${hole.x},${hole.y}`)}
            <path
                d="M{hole.x} {hole.y - 1.4} L{hole.x + 1.1} {hole.y} L{hole.x} {hole.y +
                    1.4} L{hole.x - 1.1} {hole.y} Z"
                fill={cutout}
            ></path>
        {/each}
    {:else if color === MarketColor.Purple}
        <path d="M20 1.5 Q26 5.5 23.5 10.5 Q22 12 20 12 Q18 12 16.5 10.5 Q14 5.5 20 1.5 Z"></path>
        <path d="M16 12 H24 V14.5 H16 Z"></path>
        <path d="M18 14.5 H22 V17.5 H18 Z"></path>
        <path d="M20 17.5 Q30.5 21 29.5 29 Q28.5 37 20 37 Q11.5 37 10.5 29 Q9.5 21 20 17.5 Z"
        ></path>
        {@render cut('M20 20 V35')}
        {@render cut('M12 28 Q20 31 28 28')}
    {:else if color === MarketColor.Green}
        <circle cx="17" cy="3.8" r="2.2" fill="none" stroke={fill} stroke-width="1.6"></circle>
        <path d="M15 6 H19 V13 H15 Z"></path>
        <path d="M10 13 H24 V15.6 H10 Z"></path>
        <path
            d="M13.5 15.6 L20.5 15.6 Q22 26 27 32 Q29.5 35 29.4 37.8 Q26 37 23.5 35.5 Q17.5 31.5 14.8 26 Q13.5 21 13.5 15.6 Z"
        ></path>
        {@render cut('M15.6 18 Q16 25 20.5 30.5')}
    {:else if color === MarketColor.Blue}
        <circle cx="20" cy="12.3" r="1.6" fill="none" stroke={fill} stroke-width="1.6"></circle>
        <path d="M14 19.5 Q20 12 26 19.5 Z"></path>
        <path d="M11.5 21.5 Q4 24 11 30.5" fill="none" stroke={fill} stroke-width="2.4"></path>
        <path d="M28.5 23.5 Q33 21 35.5 14 L37 14.8 Q35 23.5 29.5 28.5 Z"></path>
        <path d="M10 26 A10 7 0 1 0 30 26 A10 7 0 1 0 10 26 Z"></path>
        <path d="M14 32.5 H26 V35 H14 Z"></path>
        {@render cut('M10.6 27 Q20 30.5 29.4 27')}
    {:else}
        <path
            d="M7 25.5 A13 13 0 1 0 33 25.5 A13 13 0 1 0 7 25.5 Z M11.5 26 A8.5 8.5 0 1 0 28.5 26 A8.5 8.5 0 1 0 11.5 26 Z"
            fill-rule="evenodd"
        ></path>
        <path
            d="M16.3 3 H23.7 L29 8.3 V15.7 L23.7 21 H16.3 L11 15.7 V8.3 Z"
            stroke={cutout}
            stroke-width="1.4"
        ></path>
        <path
            d="M20 6.5 L21.4 10.6 L25.5 12 L21.4 13.4 L20 17.5 L18.6 13.4 L14.5 12 L18.6 10.6 Z"
            fill={cutout}
        ></path>
    {/if}
</g>
