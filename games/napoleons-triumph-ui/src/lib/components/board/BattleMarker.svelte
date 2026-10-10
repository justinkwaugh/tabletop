<script lang="ts">
    import { APPROACH_GEOMETRY, LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const bar = $derived(
        gameSession.attack ? APPROACH_GEOMETRY[gameSession.attack.attackApproach] : undefined
    )
    /** Where the retreat being arranged sends its units, as a count for each locale. */
    const retreats = $derived.by(() => {
        const plan = gameSession.retreatDraft
        const from = gameSession.battleLocales[1]
        if (!plan || from === undefined) {
            return []
        }
        const counts = new Map<number, number>()
        for (const locale of Object.values(plan.destinations)) {
            counts.set(locale, (counts.get(locale) ?? 0) + 1)
        }
        const start = LOCALE_GEOMETRY[from].anchor
        return [...counts].map(([locale, count]) => {
            const end = LOCALE_GEOMETRY[locale].anchor
            const length = Math.hypot(end.x - start.x, end.y - start.y)
            return {
                locale,
                count,
                start,
                end,
                angle: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
                length
            }
        })
    })
    const scale = $derived(Math.min(3.4, Math.max(1.2, 0.7 / gameSession.zoom)))
</script>

{#if bar}
    <g transform="translate({bar.centre.x} {bar.centre.y}) scale({scale})" class="pointer-events-none">
        <g transform="rotate({(Math.atan2(-bar.inward.y, -bar.inward.x) * 180) / Math.PI})">
            <path
                d="M-24 -12 H2 V-24 L28 0 L2 24 V12 H-24 Z"
                fill="#7a1418"
                stroke="#f1ecdc"
                stroke-width="2.5"
                stroke-linejoin="round"
            />
        </g>
    </g>
{/if}
{#each retreats as retreat (retreat.locale)}
    <g
        transform="translate({retreat.start.x} {retreat.start.y}) rotate({retreat.angle})"
        class="pointer-events-none"
    >
        <path
            d="M{retreat.length * 0.3} -5 H{retreat.length * 0.8 - 18} V-13 L{retreat.length * 0.8} 0 L{retreat.length * 0.8 - 18} 13 V5 H{retreat.length * 0.3} Z"
            fill="#2b2620"
            opacity="0.8"
        />
    </g>
    <g
        transform="translate({retreat.end.x} {retreat.end.y}) rotate({-gameSession.boardRotation})"
        class="pointer-events-none"
    >
        <circle r="17" fill="#f1ecdc" stroke="#2b2620" stroke-width="2" />
        <text y="6" text-anchor="middle" font-size="18" font-weight="700" fill="#2b2620">{retreat.count}</text>
    </g>
{/each}
