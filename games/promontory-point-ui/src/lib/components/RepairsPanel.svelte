<script lang="ts">
    import { shareFaceImage } from '$lib/images/cardImages.js'
    import { PreviewKind } from '$lib/model/cardPreview.svelte.js'
    import type { RepairsPanel } from '$lib/model/repairsPanel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ActionDescription from './ActionDescription.svelte'

    let { panel }: { panel: RepairsPanel } = $props()

    const gameSession = getGameSession()
</script>

<!-- R-4.3, R-4.3-H1 to H3: the deciding short seat sells at half price until it can pay. -->
<div data-repairs-panel>
    <p class="mb-2 text-[15px]">
        <b class="font-semibold">{panel.prompt.lead}</b>
        <ActionDescription parts={panel.prompt.parts} />
        <span class="ml-2 text-[13px] text-pp-muted">{panel.prompt.note}</span>
    </p>
    <div class="flex flex-wrap items-stretch gap-4">
        {#if panel.entries.length > 0}
            <section class="pp-block min-w-0 flex-1">
                <div class="pp-block-heading">Your shares · half price</div>
                <div class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2.5 xl:grid-cols-4">
                    {#each panel.entries as entry (entry.railroadId)}
                        {@const face = shareFaceImage(entry.railroadId)}
                        <div class="flex items-center gap-2" data-repairs-entry={entry.railroadId}>
                            <button
                                type="button"
                                class="shrink-0"
                                aria-label="Enlarge the {entry.name} share"
                                onclick={() =>
                                    gameSession.cardPreview.show({
                                        kind: PreviewKind.Share,
                                        railroadId: entry.railroadId
                                    })}
                            >
                                <img
                                    src={face.src}
                                    width={38}
                                    height={Math.round((38 * face.height) / face.width)}
                                    alt=""
                                    class="block rounded-[3px]"
                                />
                            </button>
                            <div class="min-w-0 text-xs leading-tight text-pp-muted">
                                <div>
                                    <span class="text-[13px] font-semibold text-pp-text"
                                        >{entry.name}</span
                                    >
                                    · {entry.holding}
                                </div>
                                <div>
                                    price {entry.priceLine.price} →
                                    <span class="pp-price">{entry.priceLine.proceeds}</span> each
                                </div>
                                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        class="pp-button"
                                        class:staged={entry.stagedNote !== undefined}
                                        disabled={entry.locked}
                                        onclick={() =>
                                            gameSession.stageRepairsSale(entry.railroadId)}
                                        >Sell one <small>{entry.sellLabel}</small></button
                                    >
                                    {#if entry.stagedNote}
                                        <span class="text-[11px]">{entry.stagedNote}</span>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </section>
        {/if}
        <section class="pp-block w-[300px] max-sm:w-full">
            <div class="pp-block-heading">Bill</div>
            <div class="text-[13px]" data-repairs-running-line>
                {panel.runningLine}
            </div>
            {#if panel.billNote}
                <p class="mt-1 text-xs text-pp-muted" data-repairs-bill-note>{panel.billNote}</p>
            {/if}
            {#if panel.everySaleNote}
                <p class="mt-1 text-xs text-pp-muted">{panel.everySaleNote}</p>
            {/if}
            <button
                type="button"
                class="pp-button primary big mt-2"
                disabled={!panel.send.ready}
                onclick={() => gameSession.sendRepairs()}>{panel.send.label}</button
            >
        </section>
    </div>
</div>

<style>
    .pp-price {
        font-family: Oswald, sans-serif;
        font-size: 18px;
        color: var(--pp-text);
    }

    .staged {
        box-shadow:
            0 0 0 2px var(--pp-halo),
            0 0 0 4px var(--pp-accent);
    }
</style>
