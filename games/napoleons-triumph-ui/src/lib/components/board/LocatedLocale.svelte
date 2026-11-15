<script lang="ts">
    import { localeOutlinePoints } from '$lib/map/localeOutline.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MARK_INK } from '$lib/utils/approachSymbols.js'

    const gameSession = getGameSession()
</script>

{#if gameSession.locatedLocale}
    {@const { locale, press } = gameSession.locatedLocale}
    {#key press}
        <polygon
            class="nt-located-locale pointer-events-none"
            points={localeOutlinePoints(locale)}
            fill={MARK_INK}
            fill-opacity="0.16"
            stroke={MARK_INK}
            stroke-width="5"
            stroke-linejoin="round"
            data-located-locale={locale}
            onanimationend={() => gameSession.locatedLocaleFaded(press)}
        ></polygon>
    {/key}
{/if}

<style>
    .nt-located-locale {
        animation: nt-located-fade 2.4s ease-in forwards;
    }

    @keyframes nt-located-fade {
        0%,
        55% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }
</style>
