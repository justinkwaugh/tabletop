<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Numeral from './Numeral.svelte'

    const gameSession = getGameSession()

    // How many cards are left in each politics pile. This is the ONLY thing about those
    // piles that matters turn to turn (their contents are hidden until you win politics
    // and look through one), so the piles themselves no longer sit on the table - they
    // come up over the board at the moment of choosing, via PoliticsPileChooser.
    const pileACount = $derived(gameSession.gameState.politicsCardPileA.length)
    const pileBCount = $derived(gameSession.gameState.politicsCardPileB.length)

    // Per-player Silver Mine payout, while a revealed mine is still sitting on the
    // discard pile (see GameSession.lastMineHillScoring) - keyed for the lookup below.
    const minePointsByPlayerId = $derived(
        new Map((gameSession.lastMineHillScoring ?? []).map((entry) => [entry.playerId, entry.points]))
    )

    // The caption sits snug under the scores normally. A mine payout pushes it down by the
    // pill's own height (the pill is in flow), which is the lowering that was missing
    // before - but landing 2px under a pill reads as jammed where 2px under a score box
    // reads as attached, so it gets a little extra clearance in that case only.
    const anyMineGain = $derived(minePointsByPlayerId.size > 0)

</script>

<!-- The Silver Mine "+N" sits in NORMAL FLOW under its player's score, not absolutely
     positioned over it. Hanging it out of flow meant the "Points" caption below had no
     idea it existed, so the clearance had to be hand-reserved as a margin - and any
     number chosen was either an overlap or a guess. In flow, the pill simply pushes the
     caption down and the spacing is correct at every size with no magic number.
     Two labelled groups on one line: the politics piles' remaining counts, and every
     player's running score. Both are table-wide readings rather than per-player state,
     which is why they sit here above the panels instead of inside them - power points
     spent a while in the player panels themselves, but that pushed the name pill off
     centre and cost the panels a row, so they came back up here. The captions sit BELOW
     their numbers so the numbers align on one line and the eye reads the figures first. -->
<div class="px-3 pt-2 pb-1 flex items-start justify-center gap-12 border-b-2 border-black/20 text-black">
    <div class="flex flex-col items-center gap-0.5">
        <div class="flex items-center gap-1.5">
            <span
                class="px-2 py-0.5 rounded-md bg-black/10 font-bold tabular-nums"
                title="Cards left in politics pile A"
            >
                <Numeral value={pileACount} />
            </span>
            <span
                class="px-2 py-0.5 rounded-md bg-black/10 font-bold tabular-nums"
                title="Cards left in politics pile B"
            >
                <Numeral value={pileBCount} />
            </span>
        </div>
        <span class="text-[13px] font-semibold uppercase tracking-wide text-black/60">
            Politics
        </span>
    </div>

    <div class="flex flex-col items-center gap-0.5">
        <div class="flex items-start gap-1.5">
            {#each gameSession.gameState.players as ps (ps.playerId)}
                {@const mineGain = minePointsByPlayerId.get(ps.playerId) ?? 0}
                <span class="w-9 shrink-0 flex flex-col items-center gap-[3px]">
                    <span
                        class="w-full block text-center px-1 py-0.5 rounded-md font-bold text-white tabular-nums"
                        style="background-color: {gameSession.colors.getPlayerUiColor(ps.playerId)}"
                    >
                        <Numeral value={ps.powerPoints} />
                    </span>
                    {#if mineGain > 0}
                        <span
                            class="w-full text-center px-1 py-0.5 rounded-md text-[13px] font-bold leading-none text-white shadow-sm"
                            style="background-color: {gameSession.colors.getPlayerUiColor(ps.playerId)}"
                            title="Silver Mine: power points for enclosed hills"
                        >
                            +<Numeral value={mineGain} />
                        </span>
                    {/if}
                </span>
            {/each}
        </div>
        <span
            class="{anyMineGain
                ? 'mt-2'
                : ''} text-[13px] font-semibold uppercase tracking-wide text-black/60"
        >
            Points
        </span>
    </div>
</div>
