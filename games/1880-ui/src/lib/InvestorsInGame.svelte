<script lang="ts">
    import { investorsInGame } from '@tabletop/1880'
    import InvestorLineup from './InvestorLineup.svelte'
    import type { Session1880 } from './session.svelte.js'
    let { session }: { session: Session1880 } = $props()
</script>

<section class="investors-in-game centered-panel" aria-label="Foreign investors in this game">
    <span>Foreign investors in this game</span>
    <InvestorLineup
        {session}
        investorIds={investorsInGame(session.gameState)}
        tokenSize={26}
        label="Foreign investors in this game"
    />
</section>

<style>
    .investors-in-game {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 4px 0 6px;
        border-bottom: 1px solid var(--rail-shadow, #b9ac994f);
        color: var(--rail-text, #514536);
        font-size: 12px;
    }
    .investors-in-game > span {
        font-weight: 600;
    }
    .investors-in-game :global(.lineup) {
        justify-content: center;
    }
</style>
