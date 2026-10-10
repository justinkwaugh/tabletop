<script lang="ts">
    import { CompanyId } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ROUND_HEADER_RECT } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import { endConditions } from '$lib/utils/endGame.js'
    import Store from '../icons/Store.svelte'

    const gameSession = getGameSession()

    const MARKER_X = 812
    const FIRST_ROW_Y = 41
    const ROW_STEP = 25

    const conditions = $derived(endConditions(gameSession.gameState))
    const summary = $derived(
        `Game ends immediately when ${conditions
            .map((condition) => `${condition.label} (${condition.reached.length}/${condition.needed})`)
            .join(' or ')}, then a final dividend is paid.`
    )
</script>

<g transform="translate({ROUND_HEADER_RECT.x + MARKER_X} {ROUND_HEADER_RECT.y})" role="img" aria-label={summary}>
    <title>{summary}</title>
    <line x1="-14" y1="18" x2="-14" y2="76" class="divider" />
    <text x="0" y="22" class="caption">Game End</text>
    {#each conditions as condition, index (condition.label)}
        <g transform="translate(0 {FIRST_ROW_Y + index * ROW_STEP})">
            {#if index === 0}
                <g transform="translate(0 -11)">
                    <rect width="32" height="22" rx="3" class="share-icon" />
                    <text x="16" y="14.8" class="share-text">SHR</text>
                </g>
            {:else}
                <Store
                    x={16}
                    y={0}
                    size={21}
                    fill={COMPANY_STYLE[CompanyId.Verbena].fill}
                    tint={COMPANY_STYLE[CompanyId.Verbena].tint}
                />
            {/if}
            {#each Array.from({ length: condition.needed }, (_, pip) => pip) as pip (pip)}
                {@const reachedId = condition.reached[pip]}
                <circle
                    cx={46 + pip * 19}
                    cy="0"
                    r="8"
                    class="pip"
                    fill={reachedId ? COMPANY_STYLE[reachedId].fill : 'rgba(253, 248, 236, 0.9)'}
                />
            {/each}
        </g>
    {/each}
    <text x="78" y={FIRST_ROW_Y + 5} class="or">or</text>
</g>

<style>
    .divider {
        stroke: #b59a68;
        stroke-width: 2;
    }

    .caption {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        fill: #7a1d22;
    }

    .share-text {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 11px;
        font-weight: 700;
        fill: #fdf8ec;
        text-anchor: middle;
    }

    .share-icon {
        fill: #7a1d22;
        stroke: rgba(29, 20, 11, 0.7);
        stroke-width: 1;
        stroke: #1d140b;
        stroke-width: 1;
    }

    .pip {
        stroke: #7a1d22;
        stroke-width: 2;
    }

    .or {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        font-style: italic;
        fill: #7a1d22;
    }
</style>
