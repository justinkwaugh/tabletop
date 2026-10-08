<script lang="ts">
    import { SailRouteKind, type SailOption } from '@tabletop/kogge'
    import { cityPlacement } from '$lib/board/layout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { laneBetween, pointAlong, type Lane } from '$lib/utils/lanes.js'
    import { sameRoute } from '$lib/utils/payment.js'

    const gameSession = getGameSession()
    const from = $derived(gameSession.me?.city)

    interface ShownLane {
        key: string
        origin: number
        option: SailOption
        chosen: boolean
        lane?: Lane
    }

    const lanes: ShownLane[] = $derived.by(() => {
        const origin = from
        if (origin === undefined || gameSession.updatingVisibleState) return []
        return gameSession.sailOptions.map((option, index) => {
            const destination = option.destination
            return {
                key: `${index}`,
                origin,
                option,
                chosen: sameRoute(option.route, gameSession.sailRoute),
                lane: destination === undefined ? undefined : laneBetween(origin, destination)
            }
        })
    })

    function arrowHead(angle: number) {
        const length = 16
        const spread = 0.45
        return `M0 0 L${-Math.cos(angle - spread) * length} ${-Math.sin(angle - spread) * length} L${-Math.cos(angle + spread) * length} ${-Math.sin(angle + spread) * length} Z`
    }
</script>

<g pointer-events="none">
    {#each lanes as { key, option, chosen, lane, origin } (key)}
        {#if lane}
            {@const secret = option.route.kind === SailRouteKind.SecretPassage}
            {@const label = pointAlong(lane, 0.5)}
            <path
                d={lane.path}
                fill="none"
                stroke="#fff8dc"
                stroke-opacity="0.85"
                stroke-width={chosen ? 10 : 7}
                stroke-linecap="round"
            ></path>
            <path
                d={lane.path}
                fill="none"
                stroke={secret ? '#7b3f8f' : '#a8321f'}
                stroke-width={chosen ? 3.5 : 2.5}
                stroke-dasharray={secret ? '3 6' : '10 6'}
                stroke-linecap="round"
                class="kogge-lane"
            ></path>
            <path
                d={arrowHead(lane.angle)}
                transform="translate({lane.end.x} {lane.end.y})"
                fill={secret ? '#7b3f8f' : '#a8321f'}
            ></path>
            {#if option.cost > 0}
                <g transform="translate({label.x} {label.y})">
                    <circle r="13" fill="#fff8dc" stroke="#a8321f" stroke-width="1.5"></circle>
                    <text
                        y="5"
                        text-anchor="middle"
                        font-family="Libre Baskerville"
                        font-weight="700"
                        font-size="14"
                        fill="#a8321f">{option.cost}</text
                    >
                </g>
            {/if}
        {:else}
            {@const harbour = cityPlacement(origin).harbour}
            <g transform="translate({harbour.x} {harbour.y})">
                <circle r="20" fill="none" stroke="#a8321f" stroke-width="2" stroke-dasharray="4 4"
                ></circle>
            </g>
        {/if}
    {/each}
</g>

<style>
    .kogge-lane {
        animation: kogge-lane-flow 1.2s linear infinite;
    }

    @keyframes kogge-lane-flow {
        to {
            stroke-dashoffset: -32;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .kogge-lane {
            animation: none;
        }
    }
</style>
