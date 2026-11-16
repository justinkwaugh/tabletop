<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    const gameSession = getGameSession()

    const ROW = 26

    const state = $derived(gameSession.gameState)
    const panel = $derived(boardLayout(state.editionId).tube)
    const underground = $derived(state.edition.definition.underground)
    const rows = $derived(
        state.companies
            .filter((company) => company.id !== underground)
            .map((company) => ({
                companyId: company.id,
                name: state.companyDefinition(company.id).shortName,
                coupled: (state.tubeConnections ?? []).includes(company.id)
            }))
    )
</script>

{#if panel && underground}
    <g
        transform="translate({panel.x} {panel.y})"
        aria-label="Tube Connection: which railways the Underground has coupled with"
    >
        <rect width={panel.width} height={panel.height} rx="8" class="sheet"></rect>
        <text x={panel.width / 2} y="18" class="title">Tube Connection</text>
        {#each rows as row, index (row.companyId)}
            {@const style = COMPANY_STYLE[row.companyId]}
            <g transform="translate(0 {30 + index * ROW})">
                <rect x="12" y="0" width="52" height="18" rx="4" fill={style.fill}></rect>
                <text x="38" y="13" class="name" fill={style.text}>{row.name}</text>
                <circle cx={panel.width - 30} cy="9" r="8" class="tube" class:coupled={row.coupled}
                ></circle>
                <text x={panel.width - 54} y="13" class="state">{row.coupled ? 'coupled' : ''}</text
                >
            </g>
        {/each}
        <text x={panel.width / 2} y={panel.height - 8} class="foot">Bonus payout at coupling</text>
    </g>
{/if}

<style>
    .sheet {
        fill: #f6f2da;
        stroke: #1f3f8a;
        stroke-width: 2;
    }

    .title {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        text-anchor: middle;
    }

    .name {
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
        text-anchor: middle;
    }

    .tube {
        fill: #f6f2da;
        stroke: #1f1f1d;
        stroke-width: 3;
    }

    .tube.coupled {
        fill: #1f1f1d;
    }

    .state {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 10px;
        text-anchor: end;
    }

    .foot {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 10px;
        text-anchor: middle;
    }

    text,
    rect,
    circle {
        pointer-events: none;
    }
</style>
