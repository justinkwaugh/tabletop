<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        playerId,
        initials,
        x,
        y,
        radius
    }: { playerId: string; initials: string | undefined; x: number; y: number; radius: number } =
        $props()

    const gameSession = getGameSession()
</script>

<!-- Art plan, Seat marker: the seat's colour; its initials only from the zoom that can read them. -->
<g aria-hidden="true">
    <circle
        cx={x}
        cy={y}
        r={radius}
        fill={gameSession.colors.getPlayerUiColor(playerId)}
        stroke="var(--rtr-ink)"
        stroke-width={radius / 8}
    ></circle>
    {#if initials}
        <text
            {x}
            y={y + radius * 0.36}
            text-anchor="middle"
            font-size={radius * Math.min(1, 1.8 / initials.length)}
            font-weight="800"
            fill={gameSession.colors.getPlayerTextColorValue(playerId)}>{initials}</text
        >
    {/if}
</g>
