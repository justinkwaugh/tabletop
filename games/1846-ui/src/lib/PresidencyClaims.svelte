<script lang="ts">
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const money = $derived(session.presentation.money)
</script>

<section class="receivership midwest-panel centered-panel" aria-label="Companies in receivership">
    <h2>Take over a company</h2>
    <div class="choices">
        {#each session.presidencyClaims as offer (offer.companyId)}
            <button
                class="action-button"
                disabled={!session.canChooseAction}
                onclick={() => session.claimPresidency(offer)}
                >{session.companyName(offer.companyId)} · buy 10% for {money(offer.price)} and become
                president</button
            >
        {/each}
    </div>
</section>
