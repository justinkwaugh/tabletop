<script lang="ts">
    // The sunlit shallows behind the table, after the box art: light shafts from the surface,
    // a shimmer of caustics, a distant reef along the bottom and a few rising bubbles.
    // Decoration only; it takes no input and holds still under reduced motion.

    const Bubbles = [
        { left: 3, size: 7, delay: 0, duration: 13 },
        { left: 5.5, size: 4, delay: 4.5, duration: 11 },
        { left: 47, size: 5, delay: 8, duration: 15 },
        { left: 71, size: 6, delay: 2.5, duration: 14 },
        { left: 96, size: 8, delay: 6, duration: 12 },
        { left: 97.5, size: 4, delay: 10, duration: 10 }
    ]

    // Ripples of light, as an SVG noise pattern tiled across the water.
    const caustics = `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360'><filter id='c' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='0.018 0.028' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -9 5.2'/></filter><rect width='360' height='360' filter='url(#c)'/></svg>`
    )}")`
</script>

<div class="seascape" aria-hidden="true">
    <div class="caustics" style:background-image={caustics}></div>
    <div class="rays"></div>
    <svg class="reef far" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
        <path
            d="M0 200 V150 C40 120 70 128 95 140 C120 100 160 96 190 130 C210 118 240 122 260 140 L280 70 L292 120 L305 60 L315 125 C340 112 380 118 400 135 C450 108 500 112 540 138 C580 126 610 130 640 145 L640 200 Z M900 200 V160 C930 130 980 126 1010 150 C1040 110 1100 104 1140 140 C1170 128 1200 132 1230 150 L1250 92 L1262 140 L1278 82 L1288 145 C1330 122 1390 120 1430 146 C1480 118 1550 120 1600 140 V200 Z"
        ></path>
    </svg>
    <svg class="reef near" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
        <!-- Mounds of brain coral, a sea fan and a few fronds of weed. -->
        <path
            d="M0 200 V176 C20 150 60 146 84 170 C100 156 130 156 146 176 V200 Z M1460 200 V172 C1490 140 1550 138 1580 166 C1590 160 1600 160 1600 162 V200 Z M600 200 V186 C630 168 680 166 704 188 V200 Z"
        ></path>
        <g class="fan">
            <path
                d="M200 200 L200 168 M200 168 L176 120 M200 168 L214 112 M200 168 L236 128 M176 120 L160 92 M176 120 L188 86 M214 112 L206 78 M214 112 L230 82 M236 128 L258 100 M236 128 L250 150"
            ></path>
            <path
                d="M1390 200 L1392 172 M1392 172 L1372 130 M1392 172 L1404 124 M1392 172 L1424 140 M1372 130 L1360 104 M1404 124 L1398 96 M1404 124 L1418 98"
            ></path>
        </g>
        <g class="weed">
            <path d="M118 200 C108 170 130 150 118 118 C108 92 126 78 120 56"></path>
            <path d="M132 200 C140 176 124 160 136 134"></path>
            <path d="M1532 200 C1522 168 1544 146 1532 112 C1524 90 1540 76 1534 58"></path>
            <path d="M650 200 C660 180 644 166 656 146"></path>
        </g>
    </svg>
    {#each Bubbles as bubble, index (index)}
        <span
            class="bubble"
            style:left="{bubble.left}%"
            style:width="{bubble.size}px"
            style:height="{bubble.size}px"
            style:animation-delay="-{bubble.delay}s"
            style:animation-duration="{bubble.duration}s"
        ></span>
    {/each}
</div>

<style>
    .seascape {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
    }

    .caustics {
        position: absolute;
        inset: -360px 0 0 -360px;
        opacity: 0.07;
        background-size: 360px 360px;
        mix-blend-mode: soft-light;
        animation: drift 60s linear infinite;
        mask-image: linear-gradient(180deg, black, transparent 85%);
    }

    .rays {
        position: absolute;
        inset: -10% -20% 30%;
        background: repeating-linear-gradient(
            100deg,
            transparent 0 70px,
            rgb(255 255 235 / 0.11) 90px 130px,
            transparent 150px 230px,
            rgb(255 255 235 / 0.07) 250px 270px,
            transparent 290px 380px
        );
        mask-image: radial-gradient(ellipse 80% 90% at 50% 0, black, transparent 80%);
        transform-origin: 50% 0;
        animation: sway 18s ease-in-out infinite alternate;
    }

    .reef {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
    }

    .reef.far {
        height: 150px;
        fill: var(--reef-silhouette-far);
    }

    .reef.near {
        height: 130px;
        fill: var(--reef-silhouette);
        stroke: var(--reef-silhouette);
    }

    .fan path {
        fill: none;
        stroke-width: 5;
        stroke-linecap: round;
    }

    .weed path {
        fill: none;
        stroke-width: 6;
        stroke-linecap: round;
        transform-box: fill-box;
        transform-origin: 50% 100%;
        animation: wave 7s ease-in-out infinite alternate;
    }

    .weed path:nth-child(even) {
        animation-duration: 9s;
        animation-delay: -3s;
    }

    .bubble {
        position: absolute;
        bottom: -12px;
        border-radius: 50%;
        background: radial-gradient(
            circle at 35% 30%,
            rgb(255 255 255 / 0.9),
            rgb(255 255 255 / 0.15) 60%
        );
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.45);
        animation: rise linear infinite;
    }

    @keyframes drift {
        to {
            transform: translate(360px, 360px);
        }
    }

    @keyframes sway {
        from {
            transform: skewX(-4deg);
        }
        to {
            transform: skewX(5deg);
        }
    }

    @keyframes wave {
        from {
            transform: rotate(-5deg);
        }
        to {
            transform: rotate(6deg);
        }
    }

    @keyframes rise {
        0% {
            transform: translate(0, 0);
            opacity: 0;
        }
        10% {
            opacity: 1;
        }
        50% {
            transform: translate(8px, -50vh);
        }
        90% {
            opacity: 0.8;
        }
        100% {
            transform: translate(-4px, -100vh);
            opacity: 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .caustics,
        .rays,
        .weed path {
            animation: none;
        }

        .bubble {
            display: none;
        }
    }
</style>
