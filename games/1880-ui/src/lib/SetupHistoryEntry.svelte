<script lang="ts">
    import { investorsInGame } from '@tabletop/1880'
    import InvestorLineup from './InvestorLineup.svelte'
    import type { Session1880 } from './session.svelte.js'
    let { session }: { session: Session1880 } = $props()
</script>

<div class="setup-entry">
    <span>Random investors drawn</span>
    <InvestorLineup
        {session}
        investorIds={investorsInGame(session.gameState)}
        tokenSize={18}
        label="Foreign investors in this game"
    />
</div>

<style>
    .setup-entry {
        display: flex;
        flex-direction: column;
        gap: 0.25em;
        color: var(--rail-text, #463e35);
        line-height: 1.333em;
    }
    .setup-entry > span {
        font-weight: 600;
    }
    .setup-entry :global(.home) {
        color: var(--rail-muted, #817565);
        font-size: 0.833em;
    }
</style>
