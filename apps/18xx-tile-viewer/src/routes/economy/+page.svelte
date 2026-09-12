<script lang="ts">
    import { PrototypeUiDefinition as TopDefinition } from '@tabletop/the-old-prince-ui'
    import { PrototypeUiDefinition as ShikokuDefinition } from '@tabletop/shikoku-1889-ui'
    import type { FinanceExamplePosition } from '@tabletop/18xx'
    import FinanceExampleHost from '../../demo/FinanceExampleHost.svelte'
    import '../../map.css'
    let title = $state<'TOP' | '1889'>('TOP')
    let position = $state<FinanceExamplePosition>('trading')
    let playerCount = $state(3)
</script>

<svelte:head><title>18xx finances</title></svelte:head>
<main>
    <nav><a href="/">Tile library</a><a href="/maps">Maps</a></nav>
    <header>
        <h1>Finances</h1>
        <div class="titles" role="group" aria-label="Game">
            <button
                aria-pressed={title === 'TOP'}
                onclick={() => {
                    title = 'TOP'
                    if (playerCount !== 3 && playerCount !== 4) playerCount = 3
                }}>The Old Prince 1871</button
            >
            <button
                aria-pressed={title === '1889'}
                onclick={() => {
                    title = '1889'
                    if (position === 'split') position = 'trading'
                }}>Shikoku 1889</button
            >
        </div>
        <label class="example"
            >Example position
            <select bind:value={position}>
                <option value="opening">Opening auction</option>
                <option value="trading">Share trading</option>
                <option value="starting">Starting companies</option>
                {#if title === 'TOP'}<option value="split">Branch split</option>{/if}
                <option value="flotation">Flotation</option>
                <option value="construction">Track construction</option>
                <option value="stations">Station placement</option>
                <option value="trains">Train purchases</option><option value="routes">Routes</option
                >
                <option value="operations">Operating rounds</option>
                <option value="phases">Phase changes</option><option value="diesel"
                    >Diesel arrival</option
                >
                <option value="privates">Private exchanges</option>
                <option value="private-events">Private phase effects</option>
                <option value="transfers">Negotiated purchases</option>
                <option value="powers">Private powers</option>
                <option value="funding">Compulsory train funding</option>
                <option value="bankruptcy">Bankruptcy</option>
                <option value="ending">Final operating turn</option>
            </select>
        </label>
        {#if position === 'opening'}<label class="example"
                >Players<select bind:value={playerCount}>
                    {#each title === 'TOP' ? [3, 4] : [2, 3, 4, 5, 6] as count}<option value={count}
                            >{count}</option
                        >{/each}
                </select></label
            >{/if}
    </header>
    {#key `${title}:${position}:${playerCount}`}<FinanceExampleHost
            {position}
            playerCount={position === 'opening' ? playerCount : undefined}
            definition={title === 'TOP' ? TopDefinition : ShikokuDefinition}
        />{/key}
</main>

<style>
    :global(body) {
        margin: 0;
        background: #edf0e9;
        font-family: ui-sans-serif, system-ui, sans-serif;
        color: #253b35;
    }
    main {
        max-width: 1450px;
        padding: 20px;
        margin: auto;
    }
    nav {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
        font-size: 13px;
    }
    a {
        color: #28554c;
    }
    header {
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
        margin-bottom: 24px;
    }
    h1 {
        font-size: 21px;
        font-weight: 650;
        margin: 0;
    }
    .titles {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    button {
        padding: 10px 14px;
        border: 1px solid #aebfb4;
        background: #fffefa;
        border-radius: 6px;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
    }
    button[aria-pressed='true'] {
        background: #315d4f;
        color: white;
        border-color: #315d4f;
    }
    select {
        margin-left: 8px;
        padding: 10px 32px 10px 12px;
        background: #fffefa;
        border: 1px solid #aebfb4;
        border-radius: 6px;
        font: inherit;
        color: inherit;
    }
    .example {
        font-size: 12px;
        color: #607268;
    }
</style>
