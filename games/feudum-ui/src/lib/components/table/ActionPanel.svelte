<script lang="ts">
    import type { PanelChoice } from '$lib/model/cardFlows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PanelRow from './PanelRow.svelte'

    /**
     * The action panel: what this seat can do now, read from the session's panels, which read the
     * logic's offers. It restates no rule. The moment-by-moment wording and layout stand on this base.
     */
    const gameSession = getGameSession()

    let goods = $derived(gameSession.startingGoodsPanel)
    let pawn = $derived(gameSession.startingPawnPanel)
    let hand = $derived(gameSession.handPanel)
    let turn = $derived(gameSession.turnPanel)
    let move = $derived(gameSession.movePanel)
    let guild = $derived(gameSession.guildPanel)
    let watching = $derived(gameSession.watchingPanel)

    let turnPrimary = $derived(guild?.primary ?? move?.primary ?? turn?.primary)

    function turnChoice(choice: PanelChoice) {
        void gameSession.pressTurnChoice(choice)
    }

    function plainRow(label: string, picked: boolean, refusal?: string): PanelChoice {
        return { label, picked, ...(refusal ? { refusal } : {}) }
    }
</script>

{#snippet primary(label: string, enabled: boolean, send: () => void)}
    <button
        type="button"
        class="rounded-lg px-4 py-1 text-sm font-semibold border border-feudum-primary-border bg-feudum-primary text-feudum-primary-text
            {enabled ? 'hover:bg-feudum-primary-hover' : 'opacity-50'}"
        disabled={!enabled}
        data-primary
        onclick={send}>{label}</button
    >
{/snippet}

<div
    class="flex flex-wrap items-center justify-center gap-2 px-3 py-2 text-sm text-feudum-text"
    data-action-panel
>
    {#if goods?.deciding}
        {#each goods.goods as row (row.good)}
            <PanelRow
                choice={plainRow(`${row.good} ${row.count}`, row.picked, row.refusal)}
                onPress={() => void gameSession.pressStartingGood(row.good)}
            />
        {/each}
        {#if goods.primary}
            {@render primary(goods.primary.label, goods.primary.enabled, () => {
                void gameSession.sendStartingGoods()
            })}
        {/if}
    {:else if goods?.waitingLine}
        <span data-waiting>{goods.waitingLine}</span>
    {:else if pawn?.deciding}
        <span>
            {pawn.asksCharacter
                ? 'Choose who stands here'
                : 'Press a starting space, or a character'}
        </span>
        {#if !pawn.asksCharacter}
            {#each pawn.characters as row (row.character)}
                <PanelRow
                    choice={plainRow(`${row.character} · ${row.rankChip}`, row.picked)}
                    onPress={() => void gameSession.pressStartingCharacter(row.character)}
                />
            {/each}
        {/if}
    {:else if hand?.drafting}
        {@const drafting = hand.drafting}
        <span data-hand-count>{drafting.count}</span>
        {#each drafting.cards as row (row.kind)}
            <PanelRow
                choice={plainRow(row.kind, row.picked)}
                onPress={() => gameSession.toggleHandCard(row.kind)}
            />
        {/each}
        {#each drafting.pouch as row (row.label)}
            <PanelRow
                choice={plainRow(row.label, row.picked, row.refusal)}
                onPress={() => gameSession.choosePouch(row.good)}
            />
        {/each}
        {#if drafting.conquerWarning}
            <span class="text-feudum-danger">{drafting.conquerWarning}</span>
        {/if}
        {@render primary(drafting.primary.label, drafting.primary.enabled, () => {
            void gameSession.finaliseHand()
        })}
    {:else if guild}
        <span data-turn-line>{guild.line}</span>
    {:else if move}
        <span data-turn-line>{move.line}</span>
        {#each move.rows as row (row.label)}
            <PanelRow choice={row} onPress={turnChoice} />
        {/each}
    {:else if turn}
        <span data-turn-line>{turn.flow?.line ?? turn.line}</span>
        {#each turn.cards as card (card.kind)}
            <PanelRow
                choice={{ label: card.label, picked: card.picked, lights: card.lights }}
                onPress={() => gameSession.pressTurnCard(card.kind)}
            />
        {/each}
        {#each turn.replays as row (row.label)}
            <PanelRow choice={row} onPress={turnChoice} />
        {/each}
        {#if turn.modes.length > 1}
            {#each turn.modes as row (row.label)}
                <PanelRow choice={row} onPress={turnChoice} />
            {/each}
        {/if}
        {#each turn.refusals as line (line)}
            <span class="text-xs text-feudum-text-muted">{line}</span>
        {/each}
        {#each turn.flow?.rows ?? [] as row (row.label)}
            <PanelRow choice={row} onPress={turnChoice} />
        {/each}
        {#if turn.secondCard}
            <PanelRow
                choice={plainRow(turn.secondCard.label, turn.secondCard.on)}
                onPress={() => gameSession.toggleTurnSecondCard()}
            />
        {/if}
        {#if turn.forfeit}
            <PanelRow
                choice={plainRow(turn.forfeit, false)}
                onPress={() => void gameSession.forfeitTurnCard()}
            />
        {/if}
    {:else if watching?.line}
        <span data-waiting>{watching.line}</span>
    {/if}
    {#if turnPrimary && !goods && !pawn && !hand?.drafting}
        {@render primary(turnPrimary.label, turnPrimary.enabled, () => {
            void gameSession.sendTurnCard()
        })}
    {/if}
</div>
