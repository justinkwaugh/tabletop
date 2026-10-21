<script lang="ts">
    import type { TreasuryShareChoice } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const shares = $derived(session.treasuryShares)
    const money = $derived(session.presentation.money)
    const companyId = $derived(shares.companyId)
    function holder(choice: TreasuryShareChoice): string {
        const certificate = session.gameState.certificates.find(
            (item) => item.id === choice.certificateIds[0]
        )
        if (!certificate) return ''
        if (certificate.owner.kind === 'bank')
            return certificate.poolId ? `the ${session.poolName(certificate.poolId)}` : 'the Bank'
        return certificate.owner.kind === 'player'
            ? session.getPlayerName(certificate.owner.playerId)
            : session.companyName(certificate.owner.companyId)
    }
    function describe(choice: TreasuryShareChoice): string {
        const count = choice.certificateIds.length
        const shareText = `${count} share${count === 1 ? '' : 's'}`
        if (choice.operation === 'redeem')
            return `Redeem ${shareText} from ${holder(choice)} for ${money(choice.amount)}`
        const pool = choice.poolId ? ` to the ${session.poolName(choice.poolId)}` : ''
        const par = choice.parPrice !== undefined ? ` · par becomes ${money(choice.parPrice)}` : ''
        return `Reissue ${shareText}${pool} for ${money(choice.amount)}${par}`
    }
</script>

{#if companyId}
    <section aria-label="Share operations">
        <p>
            {session.companyName(companyId)} may redeem shares from the bank pool or reissue the shares
            it owns.
        </p>
        <div class="choices">
            {#each shares.choices as choice (`${choice.operation}:${choice.certificateIds.join(',')}`)}
                <button disabled={!shares.canAct} onclick={() => shares.trade(choice)}
                    >{describe(choice)}</button
                >
            {/each}
            <button class="done" disabled={!shares.canAct} onclick={() => shares.finish()}
                >{shares.choices.length ? 'Skip' : 'Continue'}</button
            >
        </div>
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
        text-align: center;
    }
    p {
        margin: 8px 0;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    button {
        border: 1px solid var(--rail-border, #cbbcad);
        border-radius: 4px;
        padding: 5px 12px;
        background: var(--rail-surface-raised, #e8ded4);
        color: var(--rail-text, #51412f);
        font: inherit;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-selected, #ded0c2);
    }
    button:disabled {
        opacity: 0.6;
        cursor: default;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #695543);
        outline-offset: 2px;
    }
</style>
