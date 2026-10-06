<script lang="ts">
    import { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { color }: { color: MarketColor } = $props()
    const gameSession = getGameSession()

    const Highlight = '#ffffff'
    const DaggerOffsetX = -3
    const LanternHoles = [
        { x: 16, y: 19 },
        { x: 20, y: 18.5 },
        { x: 24, y: 19 },
        { x: 18, y: 24 },
        { x: 22, y: 24 },
        { x: 20, y: 28.3 }
    ]

    const TeapotDots = [
        { x: 14, y: 30.2 },
        { x: 17, y: 30.9 },
        { x: 20, y: 31.1 },
        { x: 23, y: 30.9 },
        { x: 26, y: 30.2 }
    ]

    let palette = $derived(gameSession.marketPalettes[color])
    let ink = $derived({
        fill: palette.fill,
        line: palette.stroke,
        detail: palette.stroke,
        shade: palette.stroke
    })
</script>

{#snippet shine(d: string, width = 1.5)}
    <path {d} fill="none" stroke={Highlight} stroke-opacity="0.6" stroke-width={width}></path>
{/snippet}

{#snippet shadow(d: string)}
    <path {d} fill={ink.shade} fill-opacity="0.32" stroke="none"></path>
{/snippet}

<g stroke={ink.line} stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">
    {#if color === MarketColor.Red}
        <circle cx="20" cy="3.3" r="1.9" fill="none"></circle>
        <path d="M13 12 Q20 3.8 27 12 Z" fill={ink.fill}></path>
        {@render shadow('M22.5 6.4 Q26 8.5 27 12 L22.8 12 Q23.3 9 22.5 6.4 Z')}
        {@render shine('M15.6 10.4 Q17.5 7.6 20.2 6.6', 1.3)}
        <rect x="11.5" y="12" width="17" height="3" rx="1" fill={ink.fill}></rect>
        <path d="M12 15 H28 L30 26 Q20 33.5 10 26 Z" fill={ink.fill}></path>
        {@render shadow('M24.5 15 H28 L30 26 Q27 28.6 23 30.2 Q26.2 23.5 24.5 15 Z')}
        {@render shine('M13.8 17 Q13.2 21.8 14.4 25.6')}
        <path d="M11.3 21.5 Q20 23.3 28.7 21.5" fill="none" stroke={ink.detail} stroke-width="0.8"
        ></path>
        {#each LanternHoles as hole (`${hole.x},${hole.y}`)}
            <path
                d="M{hole.x} {hole.y - 1.5} L{hole.x + 1.2} {hole.y} L{hole.x} {hole.y +
                    1.5} L{hole.x - 1.2} {hole.y} Z"
                fill={ink.detail}
                stroke="none"
            ></path>
        {/each}
        <path d="M17.5 30.8 L22.5 30.8 L20 37.5 Z" fill={ink.fill}></path>
    {:else if color === MarketColor.Blue}
        <path d="M11.5 21 Q3.5 24 11 31" fill="none" stroke-width="2.4"></path>
        <path d="M28 24 Q33 21 36.5 13.5 L38 14.5 Q35.5 24 29 29.5 Z" fill={ink.fill}></path>
        <ellipse cx="20" cy="26" rx="10" ry="7.5" fill={ink.fill}></ellipse>
        {@render shadow('M23 33 Q29.5 31.2 30 26 Q30.1 21.4 25.8 19.6 Q28.3 26.6 23 33 Z')}
        {@render shine('M13.4 23.6 Q14.8 20.6 18.4 19.6')}
        <path d="M10.6 27 Q20 30.6 29.4 27" fill="none" stroke={ink.detail} stroke-width="0.9"
        ></path>
        {#each TeapotDots as dot (`${dot.x},${dot.y}`)}
            <circle cx={dot.x} cy={dot.y} r="0.7" fill={ink.detail} stroke="none"></circle>
        {/each}
        <path d="M14 19.5 Q20 11 26 19.5 Z" fill={ink.fill}></path>
        {@render shine('M16.4 17.6 Q18 15.2 20 14.6', 1.1)}
        <circle cx="20" cy="12" r="1.7" fill={ink.fill}></circle>
        <rect x="14" y="32.5" width="12" height="3" rx="1" fill={ink.fill}></rect>
    {:else if color === MarketColor.Green}
        <!-- The blade curves right, so the dagger shifts left to balance on the card -->
        <g transform="translate({DaggerOffsetX} 0)">
            <circle cx="20" cy="3.8" r="2.3" fill={ink.fill}></circle>
            <rect x="17.5" y="5.5" width="5" height="8" rx="1.5" fill={ink.fill}></rect>
            <path
                d="M17.5 8 H22.5 M17.5 10.8 H22.5"
                fill="none"
                stroke={ink.detail}
                stroke-width="0.8"
            ></path>
            <rect x="12.5" y="13" width="15" height="3" rx="1.5" fill={ink.fill}></rect>
            <path
                d="M16 16 L24 16 Q25.5 27 30.4 32.4 Q32.9 35.3 32.6 38.2 Q29.6 37.6 27 36.2 Q21.2 33.2 18 28 Q16 22 16 16 Z"
                fill={ink.fill}
            ></path>
            {@render shadow(
                'M21.5 16 L24 16 Q25.5 27 30.4 32.4 Q32.9 35.3 32.6 38.2 Q31.2 34.8 27.6 31 Q22.6 25.6 21.5 16 Z'
            )}
            {@render shine('M17.6 18 Q17.6 24.5 20.6 29.6')}
            <path
                d="M16.4 21 Q20 22 24.4 20.6 M18 27.4 Q22 28.4 26.4 26.4"
                fill="none"
                stroke={ink.detail}
                stroke-width="0.9"
            ></path>
            <circle cx="28.6" cy="33.8" r="1.2" fill={ink.detail} stroke="none"></circle>
        </g>
    {:else if color === MarketColor.Purple}
        <path
            d="M20 0.8 Q27 5 24 10.5 Q22.5 12.5 20 12.5 Q17.5 12.5 16 10.5 Q13 5 20 0.8 Z"
            fill={ink.fill}
        ></path>
        <path
            d="M20 2.5 L20 11 M16.5 7.5 Q20 9 23.5 7.5"
            fill="none"
            stroke={ink.detail}
            stroke-width="0.9"
        ></path>
        {@render shine('M17.4 4.4 Q16.6 6.2 17 8', 1)}
        <rect x="15.5" y="12.5" width="9" height="2.8" rx="1.2" fill={ink.fill}></rect>
        <rect x="18" y="15.3" width="4" height="2.5" fill={ink.fill}></rect>
        <path
            d="M20 17.8 Q31 21.5 30 29.5 Q29 37.5 20 37.5 Q11 37.5 10 29.5 Q9 21.5 20 17.8 Z"
            fill={ink.fill}
        ></path>
        {@render shadow(
            'M24 19.4 Q31 22.6 30 29.5 Q29 37.5 20 37.5 Q27.4 33 26.4 25.4 Q25.8 21.8 24 19.4 Z'
        )}
        {@render shine('M13 26 Q13.4 22.6 16.6 20.8')}
        <path
            d="M20 20 L20 35.5 M12.5 27.5 Q20 30.5 27.5 27.5"
            fill="none"
            stroke={ink.detail}
            stroke-width="0.9"
        ></path>
    {:else}
        <path
            d="M7 26 a13 10 0 1 0 26 0 a13 10 0 1 0 -26 0 Z M10.5 27.5 a9.5 6.5 0 1 0 19 0 a9.5 6.5 0 1 0 -19 0 Z"
            fill={ink.fill}
            fill-rule="evenodd"
        ></path>
        {@render shadow(
            'M26.5 18.2 Q33 21 33 26 Q33 32.6 25 35.6 Q29.4 32.4 29.5 27.5 Q29.4 22.8 26.5 18.2 Z'
        )}
        {@render shine('M9.4 24.4 Q10.4 21 14 19.2')}
        <path d="M12.5 13 L15.5 6.5 L24.5 6.5 L27.5 13 L24.5 19.5 L15.5 19.5 Z" fill={ink.fill}
        ></path>
        {@render shadow('M24.5 6.5 L27.5 13 L24.5 19.5 L22 19.5 L24.4 13 L22.4 6.5 Z')}
        <ellipse cx="20" cy="13" rx="4.2" ry="3.8" fill={ink.detail}></ellipse>
        <path d="M18.3 11.5 L20 10.5 L21.7 11.5" fill="none" stroke="#ffffff" stroke-width="1"
        ></path>
    {/if}
</g>
