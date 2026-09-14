<script lang="ts">
    import { UiDefinition as Top } from '@tabletop/the-old-prince-ui'
    import { UiDefinition as Shikoku } from '@tabletop/shikoku-1889-ui'
    import type { FinanceExamplePosition } from '@tabletop/18xx'
    import FinanceExampleHost from '../../demo/FinanceExampleHost.svelte'
    import '../../table.css'
    let title = $state('TOP')
    let position = $state<FinanceExamplePosition | 'finished'>('construction')
</script>

<svelte:head><title>18xx table</title></svelte:head>
<div class="table-harness">
    <nav aria-label="Development harness">
        <a href="/">18xx</a>
        <select
            aria-label="Game"
            bind:value={title}
            onchange={(event) => {
                if (event.currentTarget.value !== 'TOP' && (position === 'finished' || position === 'funding-chain'))
                    position = 'opening'
            }}
            ><option value="TOP">The Old Prince 1871</option><option value="1889"
                >Shikoku 1889</option
            ></select
        >
        <select aria-label="Position" bind:value={position}>
            <option value="opening">Opening auction</option>
            <option value="trading">Stock round</option>
            <option value="starting">Company starts</option>
            {#if title === 'TOP'}<option value="split">Branch split</option>{/if}
            <option value="construction">Track construction</option>
            <option value="stations">Station placement</option>
            <option value="routes">Run trains</option>
            <option value="operations">Operating rounds</option>
            <option value="trains">Buy trains</option>
            {#if title === 'TOP'}<option value="funding-chain">Union Bank train funding</option>{/if}
            <option value="transfers">Negotiated purchases</option>
            <option value="ending">Final operating turn</option>
            {#if title === 'TOP'}<option value="finished">Finished game</option>{/if}
        </select>
        <a class="tools" href="/economy">Logic workbench</a>
    </nav>
    {#key `${title}:${position}`}<FinanceExampleHost
            definition={title === 'TOP' ? Top : Shikoku}
            {position}
        />{/key}
</div>

<style>
    :global(body) {
        margin: 0;
        background: #ede2dc;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .table-harness {
        --app-navbar-height: 48px;
    }
    nav {
        height: 48px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 0 20px;
        background: #302c28;
        color: #f4eee6;
    }
    a {
        text-decoration: none;
        color: inherit;
        font-size: 12px;
        letter-spacing: 0.04em;
    }
    select {
        background: transparent;
        color: inherit;
        border: 0;
        font: inherit;
        font-size: 12px;
        padding: 6px 26px 6px 0;
    }
    option {
        color: #302c28;
        background: #f4eee6;
    }
    .tools {
        margin-left: auto;
        color: #bcb2a6;
    }
</style>
