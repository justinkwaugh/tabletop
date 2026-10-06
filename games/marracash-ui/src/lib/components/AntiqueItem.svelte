<script lang="ts">
    import { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { color }: { color: MarketColor } = $props()
    const gameSession = getGameSession()

    const LanternHoles = [
        { x: 16, y: 19.5 },
        { x: 20, y: 19.5 },
        { x: 24, y: 19.5 },
        { x: 18, y: 24.5 },
        { x: 22, y: 24.5 }
    ]

    let palette = $derived(gameSession.marketPalettes[color])
    let ink = $derived({ fill: palette.fill, line: palette.stroke, detail: palette.stroke })
</script>

<g stroke={ink.line} stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
    {#if color === MarketColor.Red}
        <circle cx="20" cy="3.5" r="2" fill="none"></circle>
        <path d="M13 12 Q20 3.5 27 12 Z" fill={ink.fill}></path>
        <rect x="11.5" y="12" width="17" height="3" rx="1" fill={ink.fill}></rect>
        <path d="M12 15 H28 L30 26 Q20 33 10 26 Z" fill={ink.fill}></path>
        {#each LanternHoles as hole (`${hole.x},${hole.y}`)}
            <circle cx={hole.x} cy={hole.y} r="1.3" fill={ink.detail} stroke="none"></circle>
        {/each}
        <path d="M17.5 30.5 L22.5 30.5 L20 37 Z" fill={ink.fill}></path>
    {:else if color === MarketColor.Blue}
        <path d="M11.5 21 Q3.5 24 11 31" fill="none" stroke-width="2.4"></path>
        <path d="M28 24 Q33 21 36.5 13.5 L38 14.5 Q35.5 24 29 29.5 Z" fill={ink.fill}></path>
        <ellipse cx="20" cy="26" rx="10" ry="7.5" fill={ink.fill}></ellipse>
        <path d="M12 26 Q20 29.5 28 26" fill="none" stroke={ink.detail}></path>
        <path d="M14 19.5 Q20 11 26 19.5 Z" fill={ink.fill}></path>
        <circle cx="20" cy="12" r="1.7" fill={ink.fill}></circle>
        <rect x="14" y="32.5" width="12" height="3" rx="1" fill={ink.fill}></rect>
    {:else if color === MarketColor.Green}
        <circle cx="20" cy="3.8" r="2.3" fill={ink.fill}></circle>
        <rect x="17.5" y="5.5" width="5" height="8" rx="1.5" fill={ink.fill}></rect>
        <rect x="12.5" y="13" width="15" height="3" rx="1.5" fill={ink.fill}></rect>
        <path
            d="M16 16 L24 16 Q25.5 27 30 32.5 Q33.5 37.5 28 37.5 Q21.5 36.5 18 28 Q16 22 16 16 Z"
            fill={ink.fill}
        ></path>
        <circle cx="20" cy="21" r="1.4" fill={ink.detail} stroke="none"></circle>
        <circle cx="22" cy="27" r="1.4" fill={ink.detail} stroke="none"></circle>
    {:else if color === MarketColor.Purple}
        <path
            d="M20 0.8 Q27 5 24 10.5 Q22.5 12.5 20 12.5 Q17.5 12.5 16 10.5 Q13 5 20 0.8 Z"
            fill={ink.fill}
        ></path>
        <path d="M20 2.5 L20 11 M16.5 7.5 Q20 9 23.5 7.5" fill="none" stroke={ink.detail}></path>
        <rect x="15.5" y="12.5" width="9" height="2.8" rx="1.2" fill={ink.fill}></rect>
        <rect x="18" y="15.3" width="4" height="2.5" fill={ink.fill}></rect>
        <path
            d="M20 17.8 Q31 21.5 30 29.5 Q29 37.5 20 37.5 Q11 37.5 10 29.5 Q9 21.5 20 17.8 Z"
            fill={ink.fill}
        ></path>
        <path d="M20 20 L20 35.5 M12.5 27.5 Q20 30.5 27.5 27.5" fill="none" stroke={ink.detail}
        ></path>
    {:else}
        <path
            d="M7 26 a13 10 0 1 0 26 0 a13 10 0 1 0 -26 0 Z M10.5 27.5 a9.5 6.5 0 1 0 19 0 a9.5 6.5 0 1 0 -19 0 Z"
            fill={ink.fill}
            fill-rule="evenodd"
        ></path>
        <path d="M12.5 13 L15.5 6.5 L24.5 6.5 L27.5 13 L24.5 19.5 L15.5 19.5 Z" fill={ink.fill}
        ></path>
        <ellipse cx="20" cy="13" rx="4.2" ry="3.8" fill={ink.detail}></ellipse>
        <path d="M18.3 11.5 L20 10.5 L21.7 11.5" fill="none" stroke="#ffffff" stroke-width="1"
        ></path>
    {/if}
</g>
