<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { LegalChoice } from '@tabletop/oath'
    import PlayerChips from '$lib/components/PlayerChips.svelte'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import {
        bargainPlayers,
        bargainRows,
        bargainStepLine,
        bargainStepPlayers,
        bargainStepRows,
        bargainThenPlayers,
        shownBargainPicks,
        shownBargainSteps,
        withBargainCount,
        withBargainPlayer,
        withBargainStep,
        withBargainStepCount,
        type BargainPick
    } from '$lib/model/bargainPicks.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Witch's Bargain from revision 7 (its Q&A: one use may affect several players at your site).
    // "With:" offers each player there as their chip, as every power's players are; a tap picks them
    // and opens their two rows of your own pieces, a second tap drops them. One player there starts
    // picked and stays so. Each row is held to what the engine's bounds leave: the secret the cost
    // places is never given, and Vow of Silence draws no secrets row.
    // From revision 32 (the spec's `inOrder`) the picks are steps in order, each using what the user
    // holds then: each step above the open one is one line, the open step has its chips ("With:"
    // first, "Then:" after) and its rows read after the steps above, a row with no pieces hidden,
    // and once it has a count "Then:" offers whom a next step can deal with.
    let {
        legal,
        picks,
        onchange
    }: {
        legal: LegalChoice
        picks: BargainPick[]
        onchange: (picks: BargainPick[]) => void
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let me = $derived(gameSession.myPlayer?.id)
    let players = $derived(bargainPlayers(legal))
    let picked = $derived(shownBargainPicks(legal, picks))
    let inOrder = $derived(legal.spec.inOrder === true)
    let steps = $derived(shownBargainSteps(legal, picks))
    let thenPlayers = $derived(
        me ? bargainThenPlayers(gameSession.gameState, me, legal, steps) : []
    )

    function nameOf(playerId: string): string {
        return gameSession.getPlayerName(playerId)
    }
</script>

{#if inOrder}
    <div class="bargain-picker text-xs" data-bargain-picker>
        {#if steps.length === 0}
            <PlayerChips
                label="With:"
                playerIds={players}
                picked={[]}
                onpick={(playerId) => onchange(withBargainStep(legal, picks, 0, playerId))}
                {busy}
            />
        {/if}
        {#if me}
            {#each steps as step, k (k)}
                {#if k < steps.length - 1}
                    <p class={k > 0 ? 'mt-1 text-sm' : 'text-sm'} data-bargain-done={k}>
                        <PlayerName playerId={step.playerId} />: <TokenText
                            text={bargainStepLine(step)}
                        />
                    </p>
                {:else}
                    {@const rows = bargainStepRows(gameSession.gameState, me, steps)}
                    {@const name = nameOf(step.playerId)}
                    <div class={k > 0 ? 'mt-1.5' : ''}>
                        <PlayerChips
                            label={k === 0 ? 'With:' : 'Then:'}
                            playerIds={bargainStepPlayers(
                                gameSession.gameState,
                                me,
                                legal,
                                steps,
                                k
                            )}
                            picked={[step.playerId]}
                            onpick={(playerId) =>
                                onchange(withBargainStep(legal, picks, k, playerId))}
                            {busy}
                        />
                    </div>
                    <div class="mt-1.5 flex flex-col gap-1" data-bargain-with={step.playerId}>
                        {#if rows.secrets && rows.secrets.held > 0}
                            <div class="bargain-row" data-bargain-row="secrets">
                                <span class="text-oath-text-muted"
                                    ><TokenText text="Give secret for favor favor:" /></span
                                >
                                <TokenRow
                                    image={secretToken()}
                                    {...rows.secrets}
                                    label={(n) =>
                                        `give ${name} ${n} ${n === 1 ? 'secret' : 'secrets'} for ${2 * n} favor`}
                                    ontap={(n) =>
                                        onchange(
                                            withBargainStepCount(
                                                gameSession.gameState,
                                                me,
                                                legal,
                                                picks,
                                                'secretsGiven',
                                                n
                                            )
                                        )}
                                    {busy}
                                />
                            </div>
                        {/if}
                        {#if rows.pairs.held >= 2}
                            <div class="bargain-row" data-bargain-row="pairs">
                                <span class="text-oath-text-muted"
                                    ><TokenText text="Give favor favor for secret:" /></span
                                >
                                <TokenRow
                                    image={favorToken()}
                                    {...rows.pairs}
                                    per={2}
                                    label={(n) =>
                                        `give ${name} ${2 * n} favor for ${n} ${n === 1 ? 'secret' : 'secrets'}`}
                                    ontap={(n) =>
                                        onchange(
                                            withBargainStepCount(
                                                gameSession.gameState,
                                                me,
                                                legal,
                                                picks,
                                                'pairsGiven',
                                                n
                                            )
                                        )}
                                    {busy}
                                />
                            </div>
                        {/if}
                    </div>
                {/if}
            {/each}
            {#if thenPlayers.length > 0}
                <div class="mt-1.5" data-bargain-then>
                    <PlayerChips
                        label="Then:"
                        playerIds={thenPlayers}
                        picked={[]}
                        onpick={(playerId) =>
                            onchange(withBargainStep(legal, picks, steps.length, playerId))}
                        {busy}
                    />
                </div>
            {/if}
        {/if}
    </div>
{:else}
    <div class="bargain-picker text-xs" data-bargain-picker>
        <PlayerChips
            label="With:"
            playerIds={players}
            picked={picked.map((pick) => pick.playerId)}
            onpick={(playerId) => onchange(withBargainPlayer(legal, picks, playerId))}
            {busy}
        />
        {#if me}
            {#each picked as pick (pick.playerId)}
                {@const rows = bargainRows(gameSession.gameState, me, picked, pick.playerId)}
                {@const name = nameOf(pick.playerId)}
                <div class="mt-1.5 flex flex-col gap-1" data-bargain-with={pick.playerId}>
                    {#if picked.length > 1}
                        <span class="text-sm"><PlayerName playerId={pick.playerId} />:</span>
                    {/if}
                    {#if rows.secrets}
                        <div class="bargain-row" data-bargain-row="secrets">
                            <span class="text-oath-text-muted"
                                ><TokenText text="Give secret for favor favor:" /></span
                            >
                            <TokenRow
                                image={secretToken()}
                                {...rows.secrets}
                                label={(n) =>
                                    `give ${name} ${n} ${n === 1 ? 'secret' : 'secrets'} for ${2 * n} favor`}
                                ontap={(n) =>
                                    onchange(
                                        withBargainCount(
                                            legal,
                                            picks,
                                            pick.playerId,
                                            'secretsGiven',
                                            n
                                        )
                                    )}
                                {busy}
                            />
                        </div>
                    {/if}
                    <div class="bargain-row" data-bargain-row="pairs">
                        <span class="text-oath-text-muted"
                            ><TokenText text="Give favor favor for secret:" /></span
                        >
                        <TokenRow
                            image={favorToken()}
                            {...rows.pairs}
                            per={2}
                            label={(n) =>
                                `give ${name} ${2 * n} favor for ${n} ${n === 1 ? 'secret' : 'secrets'}`}
                            ontap={(n) =>
                                onchange(
                                    withBargainCount(legal, picks, pick.playerId, 'pairsGiven', n)
                                )}
                            {busy}
                        />
                    </div>
                </div>
            {/each}
        {/if}
    </div>
{/if}

<style>
    .bargain-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
    }
    @media (max-width: 639px) {
        .bargain-row {
            flex-direction: column;
            align-items: flex-start;
        }
    }
</style>
