<script lang="ts">
    import { ART_INSET, FURROW_CARD_WIDTH, furrowArt } from '$lib/utils/furrowArt.js'

    let {
        seed,
        aspect = 1,
        pending = false
    }: { seed: number; aspect?: number; pending?: boolean } = $props()

    const uid = $props.id()
    const width = FURROW_CARD_WIDTH
    const height = $derived(FURROW_CARD_WIDTH * aspect)
    const art = $derived(furrowArt(seed, height))
    const INK = '#1f150d'
</script>

<svg
    class="furrow"
    class:pending
    viewBox="0 0 {width} {height}"
    preserveAspectRatio="none"
    aria-hidden="true"
>
    <defs>
        <filter id="{uid}-wash" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
                type="fractalNoise"
                baseFrequency="0.05"
                numOctaves="3"
                seed={seed * 3 + 1}
                result="noise"
            ></feTurbulence>
            <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="2.5"
                xChannelSelector="R"
                yChannelSelector="G"
                result="ragged"
            ></feDisplacementMap>
            <feColorMatrix
                in="noise"
                type="matrix"
                values="0 0 0 0 0.22  0 0 0 0 0.13  0 0 0 0 0.06  0 0 0 2.2 -1.05"
                result="dark"
            ></feColorMatrix>
            <feColorMatrix
                in="noise"
                type="matrix"
                values="0 0 0 0 0.66  0 0 0 0 0.45  0 0 0 0 0.27  1.8 0 0 0 -1.02"
                result="light"
            ></feColorMatrix>
            <feComposite in="dark" in2="ragged" operator="in" result="darkIn"></feComposite>
            <feComposite in="light" in2="ragged" operator="in" result="lightIn"></feComposite>
            <feMerge>
                <feMergeNode in="ragged"></feMergeNode>
                <feMergeNode in="lightIn"></feMergeNode>
                <feMergeNode in="darkIn"></feMergeNode>
            </feMerge>
        </filter>
        <filter id="{uid}-wobble" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
                type="turbulence"
                baseFrequency="0.09"
                numOctaves="2"
                seed={seed * 5 + 2}
                result="noise"
            ></feTurbulence>
            <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="1.4"
                xChannelSelector="R"
                yChannelSelector="G"
            ></feDisplacementMap>
        </filter>
        <clipPath id="{uid}-print">
            <rect
                x={ART_INSET}
                y={ART_INSET}
                width={width - 2 * ART_INSET - 1}
                height={height - 2 * ART_INSET - 1.5}
                rx="2"
            ></rect>
        </clipPath>
    </defs>

    <rect x="1.4" y="2.2" width={width - 2} height={height - 2.6} rx="4.5" fill="#a8977a"></rect>
    <rect
        x="0.4"
        y="0.4"
        width={width - 2}
        height={height - 2.6}
        rx="4.5"
        fill="#f7f1df"
        stroke="#b3a487"
        stroke-width="0.5"
    ></rect>
    <path
        d="M1.6 {height - 6} V5 Q1.6 1.6 5 1.6 H{width - 6}"
        fill="none"
        stroke="#fffdf6"
        stroke-width="0.9"
        stroke-linecap="round"
    ></path>

    <g clip-path="url(#{uid}-print)">
        <rect
            x={ART_INSET - 2}
            y={ART_INSET - 2}
            width={width - 2 * ART_INSET + 3}
            height={height - 2 * ART_INSET + 2.5}
            fill="#7a5233"
            filter="url(#{uid}-wash)"
        ></rect>
        {#each art.ridges as ridge, index (index)}
            <path d={ridge.trough} fill="#3d2615" opacity="0.38"></path>
            <path
                d={ridge.highlight}
                fill="none"
                stroke="#c69a6c"
                stroke-width="1.6"
                stroke-linecap="round"
                opacity="0.75"
            ></path>
        {/each}
        {#each art.tufts as tuft, index (index)}
            <ellipse
                cx={tuft.wash.x}
                cy={tuft.wash.y}
                rx={tuft.wash.rx}
                ry={tuft.wash.ry}
                fill="#97b53c"
                opacity="0.85"
            ></ellipse>
        {/each}
        <g filter="url(#{uid}-wobble)">
            {#each art.ridges as ridge, index (index)}
                {#each ridge.ink as stroke, part (part)}
                    <path
                        d={stroke}
                        fill="none"
                        stroke={INK}
                        stroke-width={ridge.width}
                        stroke-linecap="round"
                    ></path>
                {/each}
            {/each}
            {#each art.clods as clod, index (index)}
                <path d={clod.path} fill="#8f6642" stroke={INK} stroke-width="0.55"></path>
            {/each}
            {#each art.pebbles as pebble, index (index)}
                <path d={pebble.path} fill="#ddd5c2" stroke={INK} stroke-width="0.5"></path>
            {/each}
            {#each art.ticks as tick, index (index)}
                <path
                    d={tick}
                    fill="none"
                    stroke={INK}
                    stroke-width="0.45"
                    stroke-linecap="round"
                    opacity="0.8"
                ></path>
            {/each}
            {#each art.flowers as flower, index (index)}
                <g transform="translate({flower.x} {flower.y})">
                    {#each flower.petals as petal, part (part)}
                        <circle
                            cx={petal.x}
                            cy={petal.y}
                            r={petal.r}
                            fill={flower.colour}
                            stroke={INK}
                            stroke-width="0.35"
                        ></circle>
                    {/each}
                    <circle r="1.1" fill="#f6e7a0" stroke={INK} stroke-width="0.35"></circle>
                </g>
            {/each}
            {#each art.tufts as tuft, index (index)}
                {#each tuft.blades as blade, part (part)}
                    <path
                        d={blade}
                        fill="none"
                        stroke={INK}
                        stroke-width="0.55"
                        stroke-linecap="round"
                    ></path>
                {/each}
            {/each}
        </g>
        {#each art.stipple as dot, index (index)}
            <circle cx={dot.x} cy={dot.y} r={dot.r} fill={INK} opacity="0.7"></circle>
        {/each}
    </g>
    <rect
        x={ART_INSET}
        y={ART_INSET}
        width={width - 2 * ART_INSET - 1}
        height={height - 2 * ART_INSET - 1.5}
        rx="2"
        fill="none"
        stroke={INK}
        stroke-width="0.8"
        filter="url(#{uid}-wobble)"
    ></rect>
</svg>

<style>
    .furrow {
        position: absolute;
        inset: 3%;
        width: 94%;
        height: 94%;
        filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.45));
    }

    .furrow.pending {
        opacity: 0.55;
    }
</style>
