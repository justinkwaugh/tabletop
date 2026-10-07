<script lang="ts">
    import type { ScenarioPosition } from '@tabletop/18xx/scenarios'
    import { PlaygroundTitles, playgroundTitle, type PlaygroundTitle } from '../../titles.js'
    import '../../table.css'

    type Position = ScenarioPosition | 'finished'
    // In menu order; title-specific positions appear only for titles that offer them.
    const Positions: readonly { id: Position; label: string; titleSpecific?: true }[] = [
        { id: 'opening', label: 'Opening' },
        { id: 'optional-opening', label: 'Opening with options', titleSpecific: true },
        { id: 'trading', label: 'Stock round' },
        { id: 'starting', label: 'Company starts' },
        { id: 'flotation', label: 'Company flotation' },
        { id: 'split', label: 'Branch split', titleSpecific: true },
        { id: 'construction', label: 'Track construction' },
        { id: 'stations', label: 'Station placement' },
        { id: 'routes', label: 'Run trains' },
        { id: 'operations', label: 'Operating rounds' },
        { id: 'trains', label: 'Buy trains' },
        { id: 'diesel', label: 'Diesel exchange', titleSpecific: true },
        { id: 'funding-chain', label: 'Union Bank train funding', titleSpecific: true },
        { id: 'bankruptcy', label: 'Bankruptcy' },
        { id: 'powers', label: 'Buy privates' },
        { id: 'company-powers', label: 'Company private powers', titleSpecific: true },
        { id: 'private-tiles', label: 'Private paired tiles', titleSpecific: true },
        { id: 'private-upgrade', label: 'Private upgrade', titleSpecific: true },
        { id: 'private-marker', label: 'Private revenue marker', titleSpecific: true },
        { id: 'shorts', label: 'Short positions', titleSpecific: true },
        { id: 'transfers', label: 'Negotiated purchases' },
        { id: 'ending', label: 'Final operating turn' },
        { id: 'finished', label: 'Finished game', titleSpecific: true }
    ]
    function positionsFor(title: PlaygroundTitle) {
        return Positions.filter(
            ({ id, titleSpecific }) =>
                (id === 'finished' ||
                    !title.supportedPositions ||
                    title.supportedPositions.some((position) => position === id)) &&
                (!titleSpecific ||
                    (id === 'finished'
                        ? !!title.finishedGame
                        : title.positions.some((position) => position === id)))
        )
    }

    let titleKey = $state(PlaygroundTitles[0].key)
    let playerCount = $state(3)
    let position = $state<Position>('construction')
    const title = $derived(playgroundTitle(titleKey))
</script>

<svelte:head><title>18xx table</title></svelte:head>
<div class="table-harness">
    <nav aria-label="Development harness">
        <a href="/">18xx</a>
        <select
            aria-label="Game"
            bind:value={titleKey}
            onchange={(event) => {
                const next = playgroundTitle(event.currentTarget.value)
                if (!positionsFor(next).some(({ id }) => id === position)) position = 'opening'
                playerCount = 3
            }}
            >{#each PlaygroundTitles as { key, name } (key)}<option value={key}>{name}</option
                >{/each}</select
        >
        <select aria-label="Position" bind:value={position}>
            {#each positionsFor(title) as { id, label } (id)}<option value={id}>{label}</option
                >{/each}
        </select>
        {#if title.playerCounts && position !== 'finished'}
            <select aria-label="Players" bind:value={playerCount}>
                {#each title.playerCounts as count (count)}<option value={count}
                        >{count} players</option
                    >{/each}
            </select>
        {/if}
    </nav>
    {#key `${titleKey}:${position}:${playerCount}`}<title.host
            {position}
            playerCount={title.playerCounts ? playerCount : undefined}
        />{/key}
</div>

<style>
    :global(body) {
        margin: 0;
        background: #18212b;
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
        min-width: 0;
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
</style>
