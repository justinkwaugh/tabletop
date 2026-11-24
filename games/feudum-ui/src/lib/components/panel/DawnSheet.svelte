<script lang="ts">
    import { GuildById } from '@tabletop/feudum'
    import type { SeatNames } from '$lib/model/actionPanel.js'
    import type { DawnSheetView } from '$lib/model/roundEnd.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { EpochNames } from '$lib/model/tileName.js'

    /** R-4.12 One row per seat; on a phone each row runs on as a line (contract: Phone layout). */
    let { sheet, seats }: { sheet: DawnSheetView; seats: SeatNames } = $props()

    const phone = new PhoneLayout()
</script>

<div class="w-full overflow-x-auto" data-dawn-sheet={sheet.epoch}>
    <p class="text-xs uppercase tracking-wide text-feudum-text-muted">
        Dawn of epoch {EpochNames[sheet.epoch]}
    </p>
    {#if phone.phone}
        <div class="mt-0.5 flex flex-col gap-1 text-xs leading-tight text-feudum-text">
            {#each sheet.rows as row (row.playerId)}
                <div
                    class="rounded-md bg-feudum-surface-raised px-1.5 py-0.5"
                    data-dawn-row={seats.nameOf(row.playerId)}
                >
                    <p class="flex items-center gap-1 font-semibold">
                        <span
                            class="inline-block h-2.5 w-2.5 rounded-full"
                            style:background-color={seats.paintOf(row.playerId).fill}
                        ></span>
                        {seats.nameOf(row.playerId)}
                        <span class="ml-auto" data-dawn-total>{row.total}</span>
                    </p>
                    <p>
                        <span data-dawn-ranks
                            ><span class="text-feudum-text-muted">Ranks</span>
                            {#each row.ranks as { guild, rank, vp }, index (guild)}{index > 0
                                    ? ', '
                                    : ''}{GuildById[guild].name}
                                {rank} · {vp}{:else}–{/each}</span
                        >
                        ·
                        <span data-dawn-landscapes
                            ><span class="text-feudum-text-muted">Landscapes</span>
                            {row.landscapes.empty} empty, {row.landscapes.filled} filled · {row
                                .landscapes.vp}</span
                        >
                        ·
                        <span data-dawn-regions
                            ><span class="text-feudum-text-muted">Regions</span>
                            {row.activeRegions.regions.length} · {row.activeRegions.vp}</span
                        >
                        ·
                        <span class="text-feudum-text-muted">Disloyalty</span>
                        <span
                            class={row.disloyaltyVp < 0 ? 'text-feudum-danger' : ''}
                            data-dawn-disloyalty>{row.disloyaltyVp}</span
                        >
                    </p>
                </div>
            {/each}
        </div>
    {:else}
        <!-- Contract, Spacing: as wide as its columns, so a total stands by its row. -->
        <table class="text-xs text-feudum-text">
            <thead>
                <tr class="text-feudum-text-muted">
                    <th class="pr-3 text-left font-normal"></th>
                    <th class="pr-3 text-left font-normal">Ranks</th>
                    <th class="pr-3 text-left font-normal">Landscapes</th>
                    <th class="pr-3 text-left font-normal">Regions</th>
                    <th class="pr-3 text-right font-normal">Disloyalty</th>
                    <th class="text-right font-normal">Total</th>
                </tr>
            </thead>
            <tbody>
                {#each sheet.rows as row (row.playerId)}
                    <tr data-dawn-row={seats.nameOf(row.playerId)}>
                        <td class="pr-3 font-semibold">
                            <span
                                class="mr-1 inline-block h-2.5 w-2.5 rounded-full"
                                style:background-color={seats.paintOf(row.playerId).fill}
                            ></span>{seats.nameOf(row.playerId)}
                        </td>
                        <td class="pr-3" data-dawn-ranks>
                            {#each row.ranks as { guild, rank, vp } (guild)}
                                <span class="mr-2 whitespace-nowrap"
                                    >{GuildById[guild].name} {rank} · {vp}</span
                                >
                            {:else}
                                –
                            {/each}
                        </td>
                        <td class="pr-3" data-dawn-landscapes>
                            {row.landscapes.empty} empty, {row.landscapes.filled} filled · {row
                                .landscapes.vp}
                        </td>
                        <td class="pr-3" data-dawn-regions>
                            {row.activeRegions.regions.length} · {row.activeRegions.vp}
                        </td>
                        <td
                            class="pr-3 text-right {row.disloyaltyVp < 0
                                ? 'text-feudum-danger'
                                : ''}"
                            data-dawn-disloyalty>{row.disloyaltyVp}</td
                        >
                        <td class="text-right font-semibold" data-dawn-total>{row.total}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
    {#each sheet.fills as note (note)}
        <p class="text-xs text-feudum-text-muted" data-dawn-note>{note}</p>
    {/each}
</div>
