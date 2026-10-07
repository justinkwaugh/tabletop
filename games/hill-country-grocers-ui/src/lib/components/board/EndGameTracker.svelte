<script lang="ts">
    import { companyDefinition } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { END_GAME_RECT } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import { endConditions } from '$lib/utils/endGame.js'

    const gameSession = getGameSession()

    const conditions = $derived(endConditions(gameSession.gameState))
</script>

<g transform="translate({END_GAME_RECT.x} {END_GAME_RECT.y})">
    <rect width={END_GAME_RECT.width} height={END_GAME_RECT.height} rx="10" class="panel" />
    <text x="14" y="24" class="title">Game ends immediately when:</text>
    {#each conditions as condition, index (condition.label)}
        {@const y = 54 + index * 56}
        {#if index > 0}
            <text x="14" y={y - 20} class="or">or</text>
        {/if}
        <text x="14" y={y} class="label">{condition.label}</text>
        {#each Array.from({ length: condition.needed }, (_, pip) => pip) as pip (pip)}
            {@const reachedId = condition.reached[pip]}
            <circle
                cx={290 + pip * 30}
                cy={y + 3}
                r="12"
                class="pip"
                fill={reachedId ? COMPANY_STYLE[reachedId].fill : 'none'}
            />
        {/each}
        <text x="352" y={y + 8} class="detail"
            >{condition.reached.length}/{condition.needed}</text
        >
        {#if condition.reached.length > 0}
            <text x="14" y={y + 17} class="detail"
                >{condition.reached.map((id) => companyDefinition(id).shortName).join(', ')}</text
            >
        {:else if condition.closest}
            <text x="14" y={y + 17} class="detail"
                >Closest: {companyDefinition(condition.closest.companyId).shortName}, {condition.closest
                    .remaining}</text
            >
        {/if}
    {/each}
    <text x="14" y={54 + conditions.length * 56} class="label">Then Final Dividend</text>
</g>

<style>
    .panel {
        fill: #fdf8ec;
        stroke: #7a1d22;
        stroke-width: 2;
    }

    .title {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 18px;
        font-weight: 700;
        fill: #7a1d22;
    }

    .or {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-style: italic;
        fill: #7a1d22;
    }

    .label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        fill: #2b1a10;
    }

    .detail {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        fill: #5a3a28;
    }

    .pip {
        stroke: #7a1d22;
        stroke-width: 2;
    }
</style>
