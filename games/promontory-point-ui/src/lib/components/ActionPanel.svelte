<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { turnPanel } from '$lib/model/turnPanel.js'
    import ShareBlock from './ShareBlock.svelte'
    import TurnHeader from './TurnHeader.svelte'
    import TurnPieces from './TurnPieces.svelte'

    const gameSession = getGameSession()

    const panel = $derived(turnPanel(gameSession))
</script>

<div class="bg-pp-panel text-pp-text">
    <TurnHeader />
    {#if panel}
        <div class="action-area border-b border-pp-halo/40 px-4 pt-2.5 pb-3 max-sm:px-2">
            <p class="mb-2 text-[15px]">
                <b class="font-semibold">{panel.prompt.lead}</b>
                {panel.prompt.text}
                {#if panel.prompt.note}
                    <span class="ml-2 text-[13px] text-pp-muted">{panel.prompt.note}</span>
                {/if}
            </p>
            <div class="flex flex-wrap items-stretch gap-4">
                <TurnPieces {panel} />
                <ShareBlock shares={panel.shares} />
            </div>
        </div>
    {/if}
</div>

<style>
    .action-area {
        background: linear-gradient(var(--pp-panel), var(--pp-table));
    }

    .action-area :global(.pp-block) {
        background: color-mix(in srgb, var(--pp-halo) 14%, transparent);
        border: 1px solid var(--pp-line);
        border-radius: 8px;
        padding: 8px 10px;
    }

    .action-area :global(.pp-block-heading) {
        margin: 0 0 6px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--pp-muted);
    }

    .action-area :global(.pp-button) {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--pp-paper);
        color: var(--pp-ink);
        border: 1px solid var(--pp-paper-line);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 13px;
        font-weight: 650;
        white-space: nowrap;
    }

    .action-area :global(.pp-button small) {
        color: var(--pp-ink-sub);
        font-size: 13px;
        font-weight: 500;
    }

    .action-area :global(.pp-button:disabled) {
        opacity: 0.38;
    }

    .action-area :global(.pp-button.primary) {
        background: var(--pp-accent);
        border-color: var(--pp-accent);
        color: var(--pp-accent-ink);
    }

    .action-area :global(.pp-button.big) {
        padding: 7px 16px;
        font-size: 14px;
    }
</style>
