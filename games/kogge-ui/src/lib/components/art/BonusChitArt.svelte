<script lang="ts">
    import { BonusChit } from '@tabletop/kogge'

    let {
        chit,
        x = 0,
        y = 0,
        size = 46
    }: { chit: BonusChit; x?: number; y?: number; size?: number } = $props()
    const scale = $derived(size / 46)
</script>

<!-- A 46 x 44 chit anchored at its top-left. -->
<g transform="translate({x} {y}) scale({scale})">
    <rect width="46" height="44" rx="3" fill="#efe3c3" stroke="#6e2c86" stroke-width="1.6"></rect>
    <text
        x="23"
        y="11.5"
        text-anchor="middle"
        font-family="IM Fell English"
        font-style="italic"
        font-size="9.5"
        fill="#6e2c86">Bonus</text
    >
    <g
        fill="none"
        stroke="#6e2c86"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        {#if chit === BonusChit.ThreeForOne}
            <rect x="7" y="22" width="7" height="7" fill="#6e2c86"></rect>
            <path d="M17 25.5 H26 M23 22.5 L26 25.5 L23 28.5"></path>
            <rect x="29" y="15" width="6" height="6" fill="#6e2c86"></rect>
            <rect x="29" y="23" width="6" height="6" fill="#6e2c86"></rect>
            <rect x="29" y="31" width="6" height="6" fill="#6e2c86"></rect>
        {:else if chit === BonusChit.ExtraRouteMarker}
            <path
                d="M15 17 H31 V27 C31 33 27 36 23 38 C19 36 15 33 15 27 Z"
                fill="#6e2c86"
                fill-opacity="0.2"
            ></path>
            <path d="M23 22 V32 M18 27 H28"></path>
        {:else if chit === BonusChit.MoveTwo}
            <path d="M6 34 Q13 22 20 30 Q27 38 34 22"></path>
            <path d="M30 21 L34.5 21.5 L34 26"></path>
            <circle cx="20" cy="30" r="2.2" fill="#6e2c86"></circle>
        {:else}
            <path d="M7 36 C12 18 30 32 36 18" stroke-dasharray="3 3"></path>
            <path d="M33 14 L37 17.5 L32 20"></path>
            <circle cx="9" cy="35" r="2.2" fill="#6e2c86"></circle>
        {/if}
    </g>
</g>
