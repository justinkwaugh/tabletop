<script lang="ts">
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const funding = $derived(session.gameState.emergencyFunding)
</script>

{#if funding}
    <p>
        Treasury issuance is complete. Sell personal shares in one block per corporation, then buy a
        depot train. The operating corporation must keep its president and remain open.
    </p>
    {#if funding.minimumPrice}
        <p>After these sales, the train must cost at least ${funding.minimumPrice}.</p>
    {/if}
    {#each session.emergencySales as choice (choice.sales[0].companyId + ':' + choice.sales[0].shares)}
        {@const sale = choice.sales[0]}
        <button
            disabled={!session.canChooseAction}
            onclick={() => session.sellEmergencyShares(choice)}
        >
            Sell {sale.shares * 10}% {sale.companyId} · receive ${sale.proceeds}
        </button>
    {/each}
{/if}
{#each session.emergencyTrainChoices as choice (`${choice.trainId}:${choice.definitionId}`)}
    <button disabled={!session.canChooseAction} onclick={() => session.emergencyBuyTrain(choice)}>
        Buy {choice.definitionId} · ${choice.price}
        {#if !funding}
            · issue {choice.issuedShares}
            {choice.issuedShares === 1 ? 'share' : 'shares'} for ${choice.proceeds}
        {/if}
        · president pays ${choice.contribution}
    </button>
{/each}
{#if session.fundingStart}
    <button disabled={!session.canChooseAction} onclick={() => session.startEmergencyFunding()}>
        Begin personal share sales · issue {session.fundingStart.issuedShares}
        {session.fundingStart.issuedShares === 1 ? 'share' : 'shares'} for ${session.fundingStart
            .proceeds}
    </button>
    <p>This commits the required treasury issuance. Personal sales will then be available.</p>
{:else if !funding && session.emergencyTrainChoices.length}
    <p>
        Each purchase commits the displayed treasury issuance, president contribution and train
        purchase together.
    </p>
{/if}
{#if funding && !session.emergencyTrainChoices.length}
    <p>
        {#each session.fundingChoices as choice (`${choice.trainId}:${choice.definitionId}`)}
            {choice.definitionId}: ${choice.price}, requiring ${choice.contribution} from the president.
        {/each}
    </p>
    {#if session.bankruptcyShortfall !== undefined}
        <p>
            Even after legal share sales, funding is ${session.bankruptcyShortfall} short of the cheapest
            train. Bankruptcy sells your remaining shares, closes your private and independent companies,
            transfers your cash to {funding.companyId}, and eliminates you from the game.
        </p>
        <button disabled={!session.canChooseAction} onclick={() => session.declareBankruptcy()}>
            Declare bankruptcy
        </button>
    {/if}
{/if}
