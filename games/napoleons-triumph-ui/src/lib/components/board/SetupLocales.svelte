<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import { localeOutlinePoints } from '$lib/map/localeOutline.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { DestinationKind } from '$lib/model/setupSelection.js'

    const gameSession = getGameSession()

    function open(event: Event, commanderId: string) {
        event.stopPropagation()
        gameSession.openSetupDestination({ kind: DestinationKind.Corps, commanderId })
    }
</script>

{#each gameSession.setupLocales as entry (entry.commanderId)}
    <polygon
        points={localeOutlinePoints(entry.locale)}
        class="nt-setup-locale"
        class:nt-setup-locale-open={entry.open}
        fill={gameSession.myPlayerId
            ? gameSession.armyColors(gameSession.myPlayerId).block
            : 'none'}
        role="button"
        tabindex="0"
        aria-label="Open {commanderDefinition(entry.commanderId).name}’s corps"
        aria-pressed={entry.open}
        data-setup-locale={entry.commanderId}
        onclick={(event) => open(event, entry.commanderId)}
        onkeydown={(event) => event.key === 'Enter' && open(event, entry.commanderId)}
    ></polygon>
{/each}

<style>
    .nt-setup-locale {
        fill-opacity: 0.16;
        cursor: pointer;
    }

    .nt-setup-locale:hover {
        fill-opacity: 0.26;
    }

    .nt-setup-locale-open,
    .nt-setup-locale-open:hover {
        fill-opacity: 0.4;
        stroke: var(--nt-ink);
        stroke-width: 4;
        stroke-dasharray: 4 6;
    }
</style>
