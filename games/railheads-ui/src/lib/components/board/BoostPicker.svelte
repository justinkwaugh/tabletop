<script lang="ts">
    import { IndustryBoost } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HEX_RADIUS, hexCenter, hexPoints } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const WIDTH = 176
    const target = $derived(gameSession.boostTarget)
    const center = $derived(target ? hexCenter(target.coords) : undefined)
    const level = $derived(target?.industry ? gameSession.shownState.industry(target.industry).level : 0)
    const choices = $derived([
        { boost: IndustryBoost.Revenue, label: `Industry +1, revenue +${level + 1}` },
        { boost: IndustryBoost.Development, label: 'Industry +2, revenue +0' }
    ])
</script>

{#if center}
    <polygon points={hexPoints(center, HEX_RADIUS - 5)} class="picked" />
    <g transform="translate({center.x + HEX_RADIUS + 6} {center.y - 30})">
        <rect width={WIDTH} height="64" rx="8" class="card" />
        {#each choices as choice, index (choice.boost)}
            <g
                class="choice"
                role="button"
                tabindex="0"
                transform="translate(6 {6 + index * 28})"
                onclick={() => gameSession.chooseBoost(choice.boost)}
                onkeydown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        gameSession.chooseBoost(choice.boost)
                    }
                }}
            >
                <rect width={WIDTH - 12} height="24" rx="12" />
                <text x={(WIDTH - 12) / 2} y="16">{choice.label}</text>
            </g>
        {/each}
    </g>
{/if}

<style>
    .picked {
        fill: none;
        stroke: #7b1630;
        stroke-width: 4;
    }

    .card {
        fill: #f6f2da;
        stroke: #33401a;
        stroke-width: 2;
    }

    .choice {
        cursor: pointer;
        outline: none;
    }

    .choice rect {
        fill: #33401a;
    }

    .choice:hover rect,
    .choice:focus-visible rect {
        fill: #4b5c26;
    }

    .choice text {
        fill: #f4f0d8;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
        text-anchor: middle;
    }
</style>
