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
    <p class="mb-2 text-[15px] max-sm:mb-1 max-sm:text-[13px] max-sm:leading-snug">
        <b class="font-semibold">{panel.prompt.lead}</b>
        <ActionDescription parts={panel.prompt.parts} />
        <!-- A phone shows the half price on each button and the shortfall on the running line. -->
        <span class="ml-2 text-[13px] text-pp-muted max-sm:hidden">{panel.prompt.note}</span>
    </p>
    <div class="flex flex-wrap items-stretch gap-4 max-sm:gap-1">
        {#if panel.entries.length > 0}
            <section class="pp-block min-w-0 flex-1 max-sm:contents">
                <div class="pp-block-heading max-sm:hidden">Your shares · half price</div>
                <!-- Contract, "Phone layout": one button per railroad held, in two columns. -->
                <div
                    class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2.5 max-sm:mt-0 max-sm:w-full max-sm:gap-1 xl:grid-cols-4"
                >
                    {#each panel.entries as entry (entry.railroadId)}
                        {@const face = shareFaceImage(entry.railroadId)}
                        <div class="flex items-center gap-2" data-repairs-entry={entry.railroadId}>
                            <button
                                type="button"
                                class="shrink-0 max-sm:hidden"
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
                            <div class="min-w-0 text-xs leading-tight text-pp-muted max-sm:w-full">
                                <div class="max-sm:hidden">
                                    <span class="text-[13px] font-semibold text-pp-text"
                                        >{entry.name}</span
                                    >
                                    · {entry.holding}
                                </div>
                                <div class="max-sm:hidden">
                                    price {entry.priceLine.price} →
                                    <span class="pp-price">{entry.priceLine.proceeds}</span> each
                                </div>
                                <div
                                    class="mt-1 flex flex-wrap items-center gap-1.5 max-sm:mt-0 max-sm:block"
                                >
                                    <button
                                        type="button"
                                        class="pp-button max-sm:w-full"
                                        class:staged={entry.stagedNote !== undefined}
                                        disabled={entry.locked}
                                        onclick={() =>
                                            gameSession.stageRepairsSale(entry.railroadId)}
                                        ><span class="max-sm:hidden"
                                            >Sell one <small>{entry.sellLabel}</small></span
                                        ><span class="phone-sell sm:hidden"
                                            ><span>{entry.short}</span><small
                                                >{entry.stagedNote ??
                                                    `${entry.sellLabel} each`}</small
                                            ></span
                                        ></button
                                    >
                                    {#if entry.stagedNote}
                                        <span class="text-[11px] max-sm:hidden"
                                            >{entry.stagedNote}</span
                                        >
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </section>
        {/if}
        <section class="bill pp-block w-[300px] max-sm:w-full">
            <div class="pp-block-heading max-sm:hidden">Bill</div>
            <div class="line text-[13px]" data-repairs-running-line>
                {panel.runningLine}
            </div>
            {#if panel.billNote}
                <p class="note mt-1 text-xs text-pp-muted" data-repairs-bill-note>
                    {panel.billNote}
                </p>
            {/if}
            {#if panel.everySaleNote}
                <p class="every mt-1 text-xs text-pp-muted">{panel.everySaleNote}</p>
            {/if}
            <button
                type="button"
                class="send pp-button primary big mt-2"
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

    .phone-sell {
        display: flex;
        width: 100%;
        align-items: baseline;
        justify-content: space-between;
        gap: 6px;
    }

    /* Contract, "Phone layout": the running line and the send on one row, the notes under it. */
    @media (width < 40rem) {
        section.bill.pp-block {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas:
                'line send'
                'note note'
                'every every';
            align-items: center;
            column-gap: 8px;
            padding: 0;
            border: 0;
            background: none;
        }

        .bill .line {
            grid-area: line;
            font-size: 12.5px;
        }

        .bill .note {
            grid-area: note;
            font-size: 11px;
        }

        .bill .every {
            grid-area: every;
            font-size: 11px;
        }

        /* A staged railroad stays legible though its row locks once the bill is covered. */
        button.pp-button.staged:disabled {
            opacity: 1;
        }

        .bill .send {
            grid-area: send;
            margin-top: 0;
            padding: 6px 10px;
            font-size: 13.5px;
        }
    }

    .staged {
        box-shadow:
            0 0 0 2px var(--pp-halo),
            0 0 0 4px var(--pp-accent);
    }
</style>
