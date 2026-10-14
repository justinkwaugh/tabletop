<script lang="ts">
    import { localeOutlinePoints } from '$lib/map/localeOutline.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    function aim(event: Event, locale: number) {
        event.stopPropagation()
        gameSession.aimAt(locale)
    }

</script>

{#each gameSession.aimableLocales as locale (locale)}
    <polygon
        points={localeOutlinePoints(locale)}
        class="nt-aim-locale"
        role="button"
        tabindex="0"
        aria-label={gameSession.aimTask(locale)}
        data-aim-locale={locale}
        onclick={(event) => aim(event, locale)}
        onkeydown={(event) => event.key === 'Enter' && aim(event, locale)}
    ></polygon>
{/each}
{#if gameSession.aimedLocale !== undefined}
    <polygon
        points={localeOutlinePoints(gameSession.aimedLocale)}
        class="nt-aimed-locale"
        data-aimed-locale={gameSession.aimedLocale}
    ></polygon>
{/if}

<style>
    .nt-aim-locale {
        fill: transparent;
        cursor: pointer;
    }

    .nt-aimed-locale {
        fill: var(--nt-aimed-fill);
        stroke: var(--nt-aimed-line);
        stroke-width: 5;
        pointer-events: none;
    }
</style>
