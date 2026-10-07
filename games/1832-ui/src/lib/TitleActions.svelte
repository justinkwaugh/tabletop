<script lang="ts">
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const state = $derived(session.gameState)
    const companyName = (companyId: string) =>
        session.presentation.companyNames?.[companyId]?.initials ?? companyId
    const londonCompanies = $derived(
        [
            ...new Map(
                session.londonChoices.map((certificateId) => {
                    const certificate = state.certificates.find((item) => item.id === certificateId)
                    return [certificate?.companyId ?? certificateId, certificateId] as const
                })
            )
        ].map(([companyId, certificateId]) => ({ companyId, certificateId }))
    )
    const cityLabel = (nodeId: string, index: number) => {
        const occupants = state.stations
            .filter(
                (station) =>
                    station.status === 'placed' &&
                    station.position.locationId === session.pendingTokenLocation?.locationId &&
                    station.position.nodeId === nodeId
            )
            .map((station) => companyName(station.companyId))
        return occupants.length ? `${companyName(occupants[0])}’s city` : `City ${index + 1}`
    }
</script>

{#if session.tokenCityChoices.length}
    <header class="title-prompt">
        <span>Choose the city in {session.pendingTokenLocation?.locationId}:</span>
        {#each session.tokenCityChoices as choice, index (choice.nodeId)}<button
                class="action-button inline-action"
                disabled={!session.canChooseAction}
                onclick={() => session.placeRevenueToken(choice)}
                >{cityLabel(choice.nodeId, index)}</button
            >{/each}
    </header>
{:else if session.keyWestChoice && session.canChooseAction}
    <header class="title-prompt">
        <span>Place the Key West token in Miami instead of a station?</span>
        <button
            class="action-button inline-action"
            onclick={() => session.keyWestChoice && session.placeRevenueToken(session.keyWestChoice)}
            >place</button
        >
    </header>
{/if}
{#if session.canBuyCoalRights}
    <header class="title-prompt">
        <span>Buy a West Virginia Coal Fields token for $80, using a yellow tile lay?</span>
        <button class="action-button inline-action" onclick={() => session.buyCoalRights()}
            >buy</button
        >
    </header>
{/if}
{#if londonCompanies.length && session.canChooseAction}
    <header class="title-prompt">
        <span>London Investment Company: take a free share of</span>
        {#each londonCompanies as { companyId, certificateId } (companyId)}<button
                class="action-button inline-action"
                onclick={() => session.takeLondonShare(certificateId)}
                >{companyName(companyId)}</button
            >{/each}
    </header>
{/if}

<style>
    .title-prompt {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
    }
    .title-prompt button {
        margin: 0;
    }
</style>
