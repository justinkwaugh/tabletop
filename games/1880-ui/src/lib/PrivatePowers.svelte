<script lang="ts">
    import type { Session1880 } from './session.svelte.js'
    let { session }: { session: Session1880 } = $props()
    const money = $derived(session.presentation.money)
</script>

{#if session.woosongPayment || session.engineerCompany || session.rocketCompany}
    <div class="powers" aria-label="Private powers">
        {#if session.woosongPayment}
            <button
                class="action-button"
                disabled={session.busy}
                onclick={() => session.claimWoosong()}
                >P0: take {money(session.woosongPayment)} now</button
            >
        {/if}
        {#if session.engineerCompany}
            <button
                class="action-button"
                disabled={session.busy}
                onclick={() => session.assignEngineer()}
                >P5: give {session.actionCompanyName(session.engineerCompany)} a D permit</button
            >
        {/if}
        {#if session.rocketCompany}
            <button
                class="action-button"
                disabled={session.busy}
                onclick={() => session.exchangeRocket(session.rocketCompany ?? '')}
                >P7: exchange the Rocket of China for the train on sale</button
            >
        {/if}
    </div>
{/if}

<style>
    .action-button {
        padding: 6px 14px;
        border: 1px solid var(--rail-border, #aebfb4);
        border-radius: 4px;
        background: var(--rail-surface, #edf3eb);
        color: inherit;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
    }
    .action-button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .powers {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        padding: 4px 0 8px;
    }
</style>
