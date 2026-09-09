<script lang="ts">
    import { UiDefinition as TopDefinition } from '@tabletop/the-old-prince-ui'
    import { UiDefinition as ShikokuDefinition } from '@tabletop/shikoku-1889-ui'
    import type { FinanceExamplePosition } from '@tabletop/18xx'
    import FinanceExampleHost from '../../demo/FinanceExampleHost.svelte'
    import '../../map.css'
    let title = $state<'TOP' | '1889'>('TOP')
    let position = $state<FinanceExamplePosition>('trading')
</script>

<svelte:head><title>18xx finances</title></svelte:head>
<main>
    <nav><a href="/">Tile library</a><a href="/maps">Maps</a></nav>
    <header>
        <h1>Finances</h1>
        <div class="titles" role="group" aria-label="Game">
            <button aria-pressed={title === 'TOP'} onclick={() => (title = 'TOP')}
                >The Old Prince 1871</button
            >
            <button aria-pressed={title === '1889'} onclick={() => (title = '1889')}
                >Shikoku 1889</button
            >
        </div>
        <label class="example"
            >Example position
            <select bind:value={position}>
                <option value="trading">Share trading</option>
                <option value="starting">Starting companies</option>
                <option value="flotation">Flotation</option>
            </select>
        </label>
    </header>
    {#key `${title}:${position}`}<FinanceExampleHost
            {position}
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
