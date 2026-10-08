<script lang="ts">
    import { CITY_COUNT, GUILD_MASTER_LAPS } from '@tabletop/kogge'
    import { TITLE_AREA } from '$lib/board/layout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const distance = $derived(gameSession.gameState.guildMaster.distance)
    const steps = CITY_COUNT * GUILD_MASTER_LAPS
    const round = $derived(gameSession.gameState.rounds.series.length)
    const width = TITLE_AREA.width
    const height = TITLE_AREA.height
</script>

<g transform="translate({TITLE_AREA.x} {TITLE_AREA.y})">
    <path
        d="M14 0 H{width - 14} Q{width} 0 {width} 14 V{height - 14} Q{width} {height} {width -
            14} {height} H14 Q0 {height} 0 {height - 14} V14 Q0 0 14 0 Z"
        fill="#f4ead0"
        fill-opacity="0.94"
        stroke="#3f2a16"
        stroke-width="2"
        filter="url(#kogge-card-shadow)"
    ></path>
    <text
        x={width / 2}
        y="46"
        text-anchor="middle"
        font-family="IM Fell English"
        font-style="italic"
        font-size="48"
        fill="#a3342a"
        stroke="#4a1410"
        stroke-width="0.7">Kogge</text
    >
    <text
        x={width / 2}
        y="76"
        text-anchor="middle"
        font-family="IM Fell English"
        font-style="italic"
        font-size="14"
        fill="#3f2a16">Handel auf unruhiger See</text
    >
    <path d="M20 86 H{width - 20}" stroke="#8a6a3c" stroke-width="0.9"></path>
    <text x="18" y="104" font-family="IM Fell English SC" font-size="13" fill="#3f2a16"
        >Guild master's rounds</text
    >
    <text
        x={width - 16}
        y="104"
        text-anchor="end"
        font-family="Libre Baskerville"
        font-style="italic"
        font-size="11"
        fill="#5b4027">Round {round}</text
    >
    {#each Array.from({ length: steps }, (_, index) => index) as step (step)}
        {@const lap = Math.floor(step / CITY_COUNT)}
        <circle
            cx={26 + (step % CITY_COUNT) * 23.5}
            cy={120 + lap * 22}
            r="8"
            fill={step < distance ? '#2b211b' : '#e6d6ad'}
            stroke="#5b4027"
            stroke-width="1"
        ></circle>
    {/each}
</g>
