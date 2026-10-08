<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        x1,
        y1,
        x2,
        y2,
        selected,
        phase,
        bunting,
        selectedColor,
        fillsFromFarEnd = false,
        children
    }: {
        x1: number
        y1: number
        x2: number
        y2: number
        selected: boolean
        phase: number
        bunting?: string[]
        selectedColor?: string
        fillsFromFarEnd?: boolean
        children?: Snippet
    } = $props()

    const STAKE_INSET = 26
    const STAKE_HEIGHT = 16
    const SWAY_SECONDS = 3.6
    const PENNANT_SPACING = 14
    const FILL_STAGGER_MS = 45
    const CREAM_PENNANTS = ['#fff3d6', '#f4e3bb', '#fbecd0', '#ecd7a8', '#fff8e6', '#f1dfb4']

    const length = $derived(Math.hypot(x2 - x1, y2 - y1))
    const along = $derived({ x: (x2 - x1) / length, y: (y2 - y1) / length })
    const stakes = $derived([
        { x: x1 + along.x * STAKE_INSET, y: y1 + along.y * STAKE_INSET },
        { x: x2 - along.x * STAKE_INSET, y: y2 - along.y * STAKE_INSET }
    ])
    const tops = $derived(stakes.map((s) => ({ x: s.x, y: s.y - STAKE_HEIGHT })))
    // On a vertical run the upper stake stands farther away, so the twine passes in front of it.
    const vertical = $derived(Math.abs(x2 - x1) < Math.abs(y2 - y1))
    const stakesBehindTwine = $derived(vertical ? stakes.slice(0, 1) : [])
    const stakesInFrontOfTwine = $derived(vertical ? stakes.slice(1) : stakes)
    const span = $derived(Math.hypot(tops[1].x - tops[0].x, tops[1].y - tops[0].y))
    const angle = $derived((Math.atan2(tops[1].y - tops[0].y, tops[1].x - tops[0].x) * 180) / Math.PI)
    const SAG = 5
    const twine = $derived(`M 0 0 Q ${span / 2} ${SAG * 2} ${span} 0`)
    const swayDelay = $derived(`animation-delay: ${-phase * SWAY_SECONDS}s`)
    const palette = $derived(bunting && bunting.length > 0 ? bunting : CREAM_PENNANTS)
    const pennants = $derived.by(() => {
        const count = Math.max(2, Math.floor(span / PENNANT_SPACING) - 1)
        return Array.from({ length: count }, (_, i) => {
            const t = (i + 1) / (count + 1)
            return {
                x: span * t,
                y: 4 * SAG * t * (1 - t),
                color: selected && selectedColor ? selectedColor : palette[i % palette.length],
                fillDelay: (fillsFromFarEnd ? count - 1 - i : i) * FILL_STAGGER_MS,
                flutterDelay: -((phase * 7 + i * 0.29) % 1) * 1.1
            }
        })
    })
</script>

{#snippet stakePost(stake: { x: number; y: number })}
    <rect
        x={stake.x - 3}
        y={stake.y - STAKE_HEIGHT}
        width="6"
        height={STAKE_HEIGHT}
        rx="1.5"
        fill="url(#surveyStakeWood)"
        stroke="rgba(80, 42, 14, 0.7)"
        stroke-width="0.8"
    />
    <ellipse cx={stake.x} cy={stake.y - STAKE_HEIGHT} rx="3" ry="1.5" fill="#fbe2bd" />
{/snippet}

<g class="survey" class:selected>
    {@render children?.()}

    {#each stakes as stake, i (i)}
        <ellipse cx={stake.x + 3.5} cy={stake.y + 1.5} rx="6" ry="2.6" fill="rgba(40, 20, 5, 0.45)" />
    {/each}

    {#each stakesBehindTwine as stake, i (i)}
        {@render stakePost(stake)}
    {/each}

    <g transform="translate({tops[0].x + 1.5} {tops[0].y + 2.5}) rotate({angle})">
        <g class="tension">
            <path class="twine-shadow twine-sway" d={twine} style={swayDelay} />
        </g>
    </g>
    <g transform="translate({tops[0].x} {tops[0].y}) rotate({angle})">
        {#each pennants as pennant, i (i)}
            <g transform="translate({pennant.x} 0)">
                <g class="pennant-lift" style="--rest-y: {pennant.y}px">
                    <g class="pennant-ride" style={swayDelay}>
                        <path
                            class="pennant"
                            d="M -4.5 0 L 4.5 0 L 0 10 Z"
                            fill={pennant.color}
                            style="animation-delay: {pennant.flutterDelay}s; transition-delay: {pennant.fillDelay}ms"
                        />
                    </g>
                </g>
            </g>
        {/each}
        <g class="tension">
            <path class="twine twine-sway" d={twine} style={swayDelay} />
        </g>
    </g>

    {#each stakesInFrontOfTwine as stake, i (i)}
        {@render stakePost(stake)}
    {/each}
</g>

<style>
    .twine,
    .twine-shadow {
        fill: none;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
        transition: stroke 0.15s ease-out;
    }
    .twine {
        stroke: #fff3d6;
        stroke-width: 2.6;
    }
    .twine-shadow {
        stroke: rgba(50, 25, 8, 0.4);
        stroke-width: 2.4;
    }
    .survey:hover .twine {
        stroke: #ffffff;
    }
    .survey.selected .twine {
        stroke: #fbbf24;
        stroke-width: 3.4;
    }
    /* Pulling the twine taut flattens its sag and lifts each pennant by the same share of its
       drop, on wrappers of their own so the transition never competes with the sway. */
    .tension,
    .pennant-lift {
        transition: transform 0.45s ease-in-out;
    }
    .survey.selected .tension {
        transform: scaleY(0.24);
    }
    .survey.selected .pennant-lift {
        transform: translateY(calc(var(--rest-y) * -0.76));
    }
    .twine-sway {
        animation: twine-sway 3.6s ease-in-out infinite;
    }
    .pennant-ride {
        transform: translateY(var(--rest-y));
        animation: pennant-ride 3.6s ease-in-out infinite;
    }
    /* Only choosing a spot flows the color in; a committed bribe or its undo recolors with the
       state. */
    .survey.selected .pennant {
        transition: fill 0.25s ease-out;
    }
    .pennant {
        stroke: rgba(70, 35, 10, 0.45);
        stroke-width: 0.4;
        transform-origin: 0 0;
        animation: pennant-flutter 1.1s ease-in-out infinite;
    }

    @keyframes twine-sway {
        0%,
        100% {
            transform: scaleY(0.7);
        }
        50% {
            transform: scaleY(1.25);
        }
    }

    @keyframes pennant-ride {
        0%,
        100% {
            transform: translateY(calc(var(--rest-y) * 0.7));
        }
        50% {
            transform: translateY(calc(var(--rest-y) * 1.25));
        }
    }

    @keyframes pennant-flutter {
        0%,
        100% {
            transform: rotate(-9deg);
        }
        50% {
            transform: rotate(9deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .twine-sway,
        .pennant-ride,
        .pennant {
            animation: none;
        }
    }
</style>
