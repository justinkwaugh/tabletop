<script lang="ts">
    import { INDUSTRIES } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { DEVELOPMENT_RECT } from '$lib/utils/boardLayout.js'
    import { INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'
    import IndustryMark from './IndustryMark.svelte'

    const gameSession = getGameSession()

    const ROW = 44
    const TRACK_LEFT = 44
    const TRACK_WIDTH = DEVELOPMENT_RECT.width - TRACK_LEFT - 10

    const state = $derived(gameSession.shownState)
    const length = $derived(state.edition.definition.developmentTrackLength)
    const rows = $derived(
        INDUSTRIES.map((industry, index) => {
            const level = state.industry(industry).level
            return {
                industry,
                level,
                y: 28 + index * ROW,
                available: state.industry(industry).available,
                held: state.tokensHeld(industry),
                reached: state.industrySitesReached(industry),
                sites: state.edition.industrySiteCount(industry)
            }
        })
    )
</script>

<g transform="translate({DEVELOPMENT_RECT.x} {DEVELOPMENT_RECT.y})">
    <rect width={DEVELOPMENT_RECT.width} height={DEVELOPMENT_RECT.height} rx="8" class="sheet" />
    <text x={DEVELOPMENT_RECT.width / 2} y="17" class="title">Industry Development</text>
    {#each rows as row (row.industry)}
        <g transform="translate(0 {row.y})">
            <g transform="translate(22 18)">
                <rect x="-14" y="-14" width="28" height="28" rx="4" fill="#ece6b8" stroke={INDUSTRY_STYLE[row.industry].ring} stroke-width="3" />
                <IndustryMark industry={row.industry} scale={0.8} />
            </g>
            <text x={TRACK_LEFT} y="10" class="small">Level {row.level} · {row.available} for sale</text>
            <rect x={TRACK_LEFT} y="15" width={TRACK_WIDTH} height="8" rx="4" class="track" />
            <rect
                x={TRACK_LEFT}
                y="15"
                width={Math.max(8, (TRACK_WIDTH * row.level) / length)}
                height="8"
                rx="4"
                fill={INDUSTRY_STYLE[row.industry].ring}
            />
            <text x={TRACK_LEFT} y="37" class="small">{row.reached} of {row.sites} sites reached</text>
        </g>
    {/each}
</g>

<style>
    .sheet {
        fill: #f6f2da;
        stroke: #4a5a24;
        stroke-width: 2;
    }

    .title {
        fill: #26300f;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        text-anchor: middle;
    }

    .track {
        fill: #d9d4a8;
        stroke: #8f8a5c;
        stroke-width: 1;
    }

    .small {
        fill: #26300f;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 11.5px;
    }

    text {
        pointer-events: none;
    }
</style>
