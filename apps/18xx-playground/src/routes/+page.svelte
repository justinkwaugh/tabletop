<script lang="ts">
    import {
        TileLibraryViewer,
        Tile,
        ClassicTileAppearance,
        MutedTileAppearance
    } from '@tabletop/18xx-ui'
    import { StandardTileCatalog } from '@tabletop/18xx'
    import { TileSpecimenGroups, SpecimenLayouts, TileInventoryGroups } from '../demo/specimens.js'

    let group = $state('All specimens')
    const example = StandardTileCatalog.get('18xx:14')
</script>

<svelte:head><title>18xx tile library</title></svelte:head>
<main>
    <nav>
        <a href="/">TABLETOP <span>/ 18XX</span></a><a href="/table">Game table ↗</a><a href="/maps"
            >Maps ↗</a
        ><a href="/specimens">Visual specimen sheet ↗</a>
    </nav>
    <div class="intro">
        <label
            >Browse a collection<select bind:value={group}
                >{#each Object.keys(TileSpecimenGroups) as name}<option>{name}</option
                    >{/each}</select
            ></label
        >
    </div>
    <TileLibraryViewer
        tiles={TileSpecimenGroups[group]}
        layouts={SpecimenLayouts}
        inventory={TileInventoryGroups[group]}
    />
    <section class="style-preview" aria-label="Appearance comparison">
        <h2>Tile styles</h2>
        {#each [ClassicTileAppearance, MutedTileAppearance] as appearance}<figure>
                <Tile
                    face={example.face}
                    printedNumber={example.printedNumber}
                    {appearance}
                    size={145}
                />
                <figcaption>{appearance.name}</figcaption>
            </figure>{/each}
    </section>
    <footer>Complete title tile sets · Rendering examples in All specimens.</footer>
</main>

<style>
    :global(body) {
        margin: 0;
        background: #eaece2;
        color: #292e28;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    :global(*) {
        box-sizing: border-box;
    }
    main {
        max-width: 1280px;
        margin: auto;
        padding: 28px clamp(12px, 4vw, 48px);
    }
    nav {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 48px;
        font-size: 11px;
        letter-spacing: 0.09em;
    }
    a {
        color: #294635;
        text-decoration: none;
        font-weight: 750;
    }
    nav span {
        color: #798271;
    }
    .intro {
        display: flex;
        gap: 20px;
        align-items: end;
        justify-content: space-between;
        margin-bottom: 28px;
        flex-wrap: wrap;
    }
    label {
        display: grid;
        gap: 6px;
        font-size: 11px;
        font-weight: 650;
    }
    select {
        border: 1px solid #b7c0ad;
        border-radius: 6px;
        padding: 11px;
        background: #faf8f1;
        color: #293f2e;
        font: inherit;
        min-height: 44px;
    }
    .style-preview {
        display: flex;
        align-items: center;
        gap: 28px;
        flex-wrap: wrap;
        padding: 30px 0;
    }
    .style-preview h2 {
        font:
            400 25px Georgia,
            serif;
        margin: 0;
    }
    figure {
        margin: 0;
        text-align: center;
        font-size: 12px;
    }
    footer {
        font-size: 11px;
        color: #64715f;
        padding: 24px 0;
    }
</style>
