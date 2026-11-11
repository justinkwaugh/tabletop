<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        commanderId,
        playerId,
        label,
        marker,
        chosen = false,
        dimmed = false,
        onclick
    }: {
        commanderId: string
        playerId: string
        /** What the flag says of its commander here, and what a tap on it does. */
        label: string
        /** A word under the flag, as under a unit: what the commander does. */
        marker?: string
        chosen?: boolean
        dimmed?: boolean
        onclick?: () => void
    } = $props()

    const gameSession = getGameSession()
</script>

<button
    type="button"
    class="nt-commander-chip"
    class:nt-commander-chip-chosen={chosen}
    class:nt-commander-chip-dimmed={dimmed}
    disabled={!onclick}
    aria-pressed={chosen}
    aria-label={label}
    title={onclick ? label : undefined}
    data-commander-chip={commanderId}
    {onclick}
>
    <span class="nt-commander-chip-flag">
        <span class="nt-commander-chip-staff"></span>
        <span
            class="nt-commander-chip-banner"
            style:--stripe={gameSession.armyColors(playerId).block}
            >{commanderDefinition(commanderId).name}</span
        >
    </span>
    {#if marker}
        <span class="nt-commander-chip-marker">{marker}</span>
    {/if}
</button>

<style>
    .nt-commander-chip {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        margin-left: -3px;
        border: 2px solid transparent;
        border-radius: 4px;
        padding: 0 2px 0 1px;
        background: transparent;
        line-height: 1;
    }

    .nt-commander-chip-flag {
        display: inline-flex;
        align-items: flex-start;
        height: 26px;
    }

    .nt-commander-chip-marker {
        padding-bottom: 1px;
        color: var(--nt-ink);
        font-size: 10px;
    }

    .nt-commander-chip:not(:disabled) {
        cursor: pointer;
    }

    .nt-commander-chip:not(:disabled):hover {
        border-color: color-mix(in srgb, var(--nt-ink) 35%, transparent);
    }

    .nt-commander-chip-chosen,
    .nt-commander-chip-chosen:not(:disabled):hover {
        border-color: var(--nt-ink);
    }

    .nt-commander-chip-dimmed {
        opacity: 0.5;
    }

    .nt-commander-chip-staff {
        width: 2px;
        height: 24px;
        background: #3b3b3b;
    }

    .nt-commander-chip-banner {
        display: inline-flex;
        align-items: center;
        height: 18px;
        border-left: 6px solid var(--stripe);
        padding: 0 13px 0 5px;
        background: #e9e1cb;
        color: #2b2620;
        font-size: 13px;
        font-style: italic;
        line-height: 1;
        white-space: nowrap;
        clip-path: polygon(0 0, 100% 0, calc(100% - 7px) 50%, 100% 100%, 0 100%);
    }
</style>
