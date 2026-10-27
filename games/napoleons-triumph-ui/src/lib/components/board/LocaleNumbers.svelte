<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LOCALE_NUMBER_INK, localeNumbers } from '$lib/utils/localeNumbers.js'

    const gameSession = getGameSession()

    const numbers = $derived(localeNumbers(gameSession.gameState.map.localeIds))
</script>

{#if gameSession.localeNumbersShown}
    <g class="pointer-events-none" fill={LOCALE_NUMBER_INK} text-anchor="middle">
        {#each numbers as { locale, at, size } (locale)}
            <text
                transform="translate({at.x} {at.y}) rotate({-gameSession.boardRotation})"
                dy="0.35em"
                font-size={size}
                data-locale-number={locale}>{locale}</text
            >
        {/each}
    </g>
{/if}
