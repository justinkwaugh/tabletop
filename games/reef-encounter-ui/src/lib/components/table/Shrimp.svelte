<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { fnv1a } from '$lib/utils/hash.js'

    // Traced from the silhouettes printed on the open sea; the wooden pieces' googly eyes sit
    // at the jagged end.
    let {
        center,
        length,
        color,
        upsideDown = false,
        blinkSeed
    }: {
        center: Point
        length: number
        color: string
        upsideDown?: boolean
        blinkSeed?: string
    } = $props()

    const blink = $derived.by(() => {
        if (blinkSeed === undefined) {
            return undefined
        }
        const hash = fnv1a(blinkSeed)
        const period = 7.5 + ((hash % 1000) / 1000) * 2.5
        const offset = (((hash >>> 10) % 1000) / 1000) * period
        return { period: `${period.toFixed(2)}s`, delay: `${(-offset).toFixed(2)}s` }
    })

    const Outline =
        'M28.4 0.0 L30.1 0.3 L34.0 3.3 L38.3 0.6 L40.1 0.5 L42.1 8.8 L43.1 10.4 L44.5 11.0 L45.9 10.5 L48.7 7.7 L50.1 7.1 L51.1 7.5 L54.4 11.1 L55.5 11.6 L57.2 11.1 L58.6 9.4 L59.8 3.1 L60.7 1.9 L61.9 2.4 L64.8 5.5 L66.5 6.2 L68.5 5.7 L71.4 4.0 L72.5 4.3 L72.8 6.5 L71.7 17.0 L69.6 30.3 L63.5 43.9 L63.7 45.6 L65.4 49.2 L65.6 51.8 L62.1 58.9 L64.4 64.8 L62.7 71.3 L62.9 72.7 L69.5 80.6 L72.0 84.9 L72.2 86.3 L71.5 89.1 L67.3 95.1 L62.3 98.3 L56.6 100.0 L49.3 99.8 L44.2 97.7 L42.3 95.9 L40.3 92.8 L39.2 89.7 L39.2 86.0 L42.8 77.8 L42.3 76.1 L40.2 73.6 L39.7 71.6 L39.8 67.6 L41.4 59.1 L40.7 57.8 L37.2 54.9 L36.1 52.6 L36.2 48.1 L37.7 41.0 L33.1 34.3 L30.7 26.3 L28.6 15.0 L27.2 4.6 L27.4 1.2 Z'
</script>

<g
    transform="translate({center.x} {center.y}) rotate({upsideDown ? 180 : 0}) scale({length /
        100}) translate(-50 -50)"
>
    <path d={Outline} transform="translate(2.5 4)" fill="#0b2a26" fill-opacity="0.3"></path>
    <g transform="translate(1.2 2)">
        <path d={Outline} fill={color}></path>
        <path d={Outline} fill="#000" fill-opacity="0.35"></path>
    </g>
    <path
        d={Outline}
        fill={color}
        stroke="#000"
        stroke-opacity="0.3"
        stroke-width="0.8"
        stroke-linejoin="round"
    ></path>
    <g
        class="eyes"
        class:blinking={blink}
        style:animation-duration={blink?.period}
        style:animation-delay={blink?.delay}
    >
        {#each [42.5, 56.5] as x (x)}
            <circle cx={x} cy="17" r="4.2" fill="#fff" stroke="#1f2f2b" stroke-width="0.4"></circle>
            <circle cx={x + 0.6} cy="17.7" r="2" fill="#111"></circle>
        {/each}
    </g>
</g>

<style>
    .eyes {
        transform-box: fill-box;
        transform-origin: center;
    }

    .blinking {
        animation-name: blink;
        animation-iteration-count: infinite;
        animation-timing-function: ease-in-out;
    }

    /* About a sixth of a second shut, once a cycle */
    @keyframes blink {
        0%,
        97.2% {
            transform: scaleY(1);
        }
        98.2% {
            transform: scaleY(0.08);
        }
        99.2%,
        100% {
            transform: scaleY(1);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .blinking {
            animation: none;
        }
    }
</style>
