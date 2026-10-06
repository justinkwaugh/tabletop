<script lang="ts">
    import { draftCompany, EighteenFortySixTileSet } from '@tabletop/1846'
    import { Tile } from '@tabletop/18xx-ui'
    import { privateOwningCompany } from '@tabletop/18xx'
    import { MapView1846, TileLayouts1846 } from './mapView.js'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const draft = $derived(session.privateDraft)
    const available = $derived(session.canUsePrivateConstruction)
    const result = $derived(session.privateConstructionResult)
    const track = $derived(session.recordedPrivateTrack)
    const station = $derived(session.recordedPrivateStation)
    const tunnelOwner = $derived(
        session.gameState.companies.some((company) => company.id === 'TBC')
            ? privateOwningCompany(session.gameState, 'TBC')
            : undefined
    )
</script>

{#if draft || session.constructionPrivateIds.length || session.chicagoPrivateStation || tunnelOwner || track || station}
    <section aria-label="Private construction powers">
        <h2>Private construction powers</h2>
        {#if draft}
            <h3>{draftCompany(draft.privateCompanyId).name}</h3>
            <p>
                Select up to {session.privateConstruction?.maximumLays} tiles, then confirm the complete
                plan. The board previews your selections.
            </p>
            {#each draft.lays as lay (lay.locationId)}
                <p>
                    Staged: {lay.locationId} · tile {EighteenFortySixTileSet.definitions.find(
                        (tile) => tile.id === lay.definitionId
                    )?.printedNumber} · {lay.rotation * 60}°
                </p>
            {/each}
            {#if session.privateConstruction?.maximumLays === 2 && draft.lays.length === 1}
                <p>Confirming one tile forfeits the second lay.</p>
            {/if}
            <div class="choices">
                {#each session.privateTrackChoices as choice (`${choice.locationId}:${choice.definitionId}:${choice.rotation}:${JSON.stringify(choice.nodeMapping)}`)}
                    {@const tile = EighteenFortySixTileSet.definitions.find(
                        (tile) => tile.id === choice.definitionId
                    )!}
                    <button
                        disabled={!available}
                        onclick={() => session.stagePrivateTrack(choice)}
                        aria-label={`Stage ${choice.locationId} tile ${tile.printedNumber}, rotation ${choice.rotation * 60}, cost ${choice.cost}`}
                    >
                        <Tile
                            face={tile.face}
                            layout={TileLayouts1846[tile.id]}
                            printedNumber={tile.printedNumber}
                            rotation={choice.rotation}
                            orientation={MapView1846.map.definition.orientation}
                            appearance={session.tileAppearance}
                            size={80}
                        />
                        {choice.locationId} · #{tile.printedNumber} · {choice.rotation * 60}° · ${choice.cost}
                    </button>
                {/each}
            </div>
            {#if result?.reason && draft.lays.length}<p role="status">{result.reason}</p>{/if}
            <button disabled={!available} onclick={() => session.backFromPrivateConstruction()}
                >Back</button
            >
            <button
                disabled={!available || !result?.lays}
                onclick={() => session.confirmPrivateConstruction()}
            >
                Confirm private construction{result?.lays
                    ? ` · $${result.lays.reduce((sum, lay) => sum + lay.cost, 0)}`
                    : ''}
            </button>
        {:else}
            {#each session.constructionPrivateIds as id (id)}
                <button disabled={!available} onclick={() => session.selectPrivateConstruction(id)}
                    >Use {draftCompany(id).name}</button
                >
            {/each}
            {#if session.chicagoPrivateStation}
                <button disabled={!available} onclick={() => session.placeChicagoPrivateStation()}
                    >Place C&WI extra Chicago station · $0</button
                >
            {/if}
        {/if}
        {#if tunnelOwner}<p>
                {tunnelOwner} · Tunnel Blasting reduces mountain, tunnel and pass costs by $20. Displayed
                construction costs include the discount.
            </p>{/if}
        {#if track?.metadata}<p role="status">
                {draftCompany(track.privateCompanyId).name}: {track.metadata.lays
                    .map((lay) => lay.locationId)
                    .join(' + ')} · paid ${track.metadata.cost}.
            </p>{/if}
        {#if station}<p role="status">
                {station.companyId} placed its extra C&WI station in Chicago.
            </p>{/if}
    </section>
{/if}
