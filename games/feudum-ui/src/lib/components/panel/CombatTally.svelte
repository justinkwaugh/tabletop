<script lang="ts">
    import type { TallyLine } from '$lib/model/cardFlows.js'

    /** R-4.8 Attack and defence by source. The one drawing of the tally (contract: Render ownership). */
    let { lines, note }: { lines: readonly TallyLine[]; note?: string } = $props()
</script>

<div class="w-full" data-combat-tally>
    <table class="text-xs text-feudum-text">
        <thead>
            <tr class="text-feudum-text-muted">
                <th class="pr-3 text-left font-normal"></th>
                <th class="pr-3 text-right font-normal">Attack</th>
                <th class="text-right font-normal">Defence</th>
            </tr>
        </thead>
        <tbody>
            {#each lines as line (line.source)}
                <tr class={line.source === 'total' ? 'font-semibold' : ''}>
                    <td class="pr-3">{line.source}</td>
                    <td class="pr-3 text-right">{line.attack ?? ''}</td>
                    <td class="text-right">{line.defence ?? ''}</td>
                </tr>
            {/each}
        </tbody>
    </table>
    {#if note}
        <p class="text-xs text-feudum-text-muted" data-tally-note>{note}</p>
    {/if}
</div>
