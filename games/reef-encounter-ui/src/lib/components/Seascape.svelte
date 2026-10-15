<script lang="ts">
    // Decoration only, after the box art; it takes no input and holds still under reduced motion.

    const Bubbles = [
        { left: 3, size: 7, delay: 0, duration: 13 },
        { left: 5.5, size: 4, delay: 4.5, duration: 11 },
        { left: 47, size: 5, delay: 8, duration: 15 },
        { left: 71, size: 6, delay: 2.5, duration: 14 },
        { left: 96, size: 8, delay: 6, duration: 12 },
        { left: 97.5, size: 4, delay: 10, duration: 10 }
    ]

    const caustics = `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360'><filter id='c' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='0.018 0.028' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -9 5.2'/></filter><rect width='360' height='360' filter='url(#c)'/></svg>`
    )}")`
</script>

<div class="seascape" aria-hidden="true">
    <div class="caustics" style:background-image={caustics}></div>
    <div class="rays"></div>
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
        .rays {
            animation: none;
        }

        .bubble {
            display: none;
        }
    }
</style>
