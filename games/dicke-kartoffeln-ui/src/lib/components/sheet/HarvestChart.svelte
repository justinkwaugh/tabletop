<script lang="ts">
    import { VARIETIES, yieldChartRow } from '@tabletop/dicke-kartoffeln'
    import { SEED_IMAGES } from '$lib/utils/tokens.js'

    const WORMS = [0, 1, 2, 3, 4, 5]
</script>

<div class="chart">
    <div class="title">YIELDS <small>(IN SACKS)</small></div>
    <table>
        <thead>
            <tr>
                <th class="corner">WORMS IN FIELD</th>
                {#each WORMS as worms (worms)}<th>{worms}</th>{/each}
            </tr>
        </thead>
        <tbody>
            {#each VARIETIES as variety (variety)}
                {#each [true, false] as fertilized (fertilized)}
                    <tr class:first={fertilized}>
                        <th class="kind">
                            {#if fertilized}
                                <img src={SEED_IMAGES[variety]} alt={variety} />
                            {/if}
                            <span>{fertilized ? 'FERTILIZED' : 'UNFERTILIZED'}</span>
                        </th>
                        {#each yieldChartRow(variety, fertilized) as sacks, index (index)}
                            <td>{sacks}</td>
                        {/each}
                    </tr>
                {/each}
            {/each}
        </tbody>
    </table>
</div>

<style>
    .chart {
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        color: #1d1d1d;
    }

    .title {
        font-size: 21px;
        text-align: center;
    }

    small {
        font-size: 14px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        border: 2.5px solid #1d1d1d;
    }

    th,
    td {
        border: 1.5px solid #1d1d1d;
        text-align: center;
    }

    thead th {
        font-size: 18px;
    }

    .corner {
        font-size: 15px;
        line-height: 1;
    }

    .kind {
        position: relative;
        height: 25px;
        padding-left: 34px;
        font-size: 18px;
        text-align: left;
        padding-right: 4px;
        white-space: nowrap;
    }

    .kind img {
        position: absolute;
        left: 2px;
        top: 2px;
        width: 30px;
        height: 46px;
        object-fit: contain;
    }

    tr.first td,
    tr.first th {
        border-top-width: 2.5px;
    }

    thead th:not(.corner),
    td {
        width: 9%;
    }

    td {
        font-size: 18px;
    }
</style>
