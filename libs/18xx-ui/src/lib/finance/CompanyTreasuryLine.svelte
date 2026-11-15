<script lang="ts">
    import { cashOwnedBy } from '@tabletop/18xx'
    import { cashText } from '../presentation/money.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        companyId,
        borrowable = 0
    }: {
        session: EighteenXXSessionView
        companyId: string
        /** What the loans the company may take for this payment would add to its cash. */
        borrowable?: number
    } = $props()
    const money = $derived(session.presentation.money)
    const cash = $derived(cashOwnedBy(session.gameState, { kind: 'company', companyId }))
</script>

<p class="treasury" role="status">
    {session.companyName(companyId)} has {cashText(money, cash)}{#if borrowable > 0}{' '}and can
        borrow {money(borrowable)} more{/if}
</p>

<style>
    .treasury {
        margin: 4px 0 0;
        text-align: center;
        font-size: 12px;
        color: var(--rail-muted, #887664);
    }
</style>
