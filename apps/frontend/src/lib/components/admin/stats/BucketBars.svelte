<script lang="ts">
    import { histogramTotal } from '@tabletop/common'
    import { formatRate } from '$lib/utils/gameStats'

    let { caption, labels, counts }: { caption: string; labels: string[]; counts: number[] } =
        $props()

    const total = $derived(histogramTotal(counts))
    const peak = $derived(Math.max(1, ...counts))
</script>

<table class="buckets">
    <caption class="sr-only">{caption}</caption>
    <tbody>
        {#each labels as label, index (label)}
            <tr>
                <th scope="row">{label}</th>
                <td class="bar-cell" aria-hidden="true">
                    <span class="bar" style:width={`${(counts[index] / peak) * 100}%`}></span>
                </td>
                <td class="share">{total ? formatRate(counts[index] / total) : '–'}</td>
                <td class="count">{counts[index].toLocaleString()}</td>
            </tr>
        {/each}
    </tbody>
</table>

<style>
    .buckets {
        width: 100%;
        font-size: 13px;
        border-collapse: collapse;
    }
    th {
        width: 7.5rem;
        padding: 3px 12px 3px 0;
        text-align: left;
        font-weight: 400;
        color: var(--color-gray-300);
        white-space: nowrap;
    }
    .bar-cell {
        padding: 3px 0;
    }
    .bar {
        display: block;
        min-width: 1px;
        height: 12px;
        border-radius: 2px;
        background: #3b8eff;
    }
    .share,
    .count {
        width: 3.5rem;
        padding-left: 10px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .count {
        color: var(--color-gray-500);
        font-size: 12px;
    }
</style>
