<script lang="ts">
    // Terms for a new pact, or a counter to one. A Player guarantees only their own ships; the
    // others' are offered as everyone saw them when the phase began, and their owners check
    // them when they accept.
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        pactTarget,
        pledgeOptions,
        possiblePartners,
        shipDefinition
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { PactDraft } from '$lib/model/selection.js'
    import { SHARE_ITEMS, type ShareItem } from '$lib/utils/pacts.js'

    let { draft }: { draft: PactDraft } = $props()

    const ITEM_LABELS: Record<ShareItem, string> = {
        influence: 'IP',
        cash: '$B',
        markers: 'Markers',
        settlements: 'Settlements',
        goods: 'Goods'
    }

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const me = $derived(gameSession.myPlayerId ?? '')
    const others = $derived(possiblePartners(gameState, me, draft.opening))
    const target = $derived(pactTarget(gameState, draft.opening, draft.partnerIds))
    const terms = $derived(gameSession.pactTerms)
    const items = $derived(target ? SHARE_ITEMS.filter((item) => target.reward[item] > 0) : [])
    const options = $derived(
        Object.fromEntries(
            draft.partnerIds.map((playerId) => [
                playerId,
                pledgeOptions(gameState, playerId, me, draft.opening, draft.counteredPactId)
            ])
        )
    )
    const strength = $derived(
        draft.partnerIds.reduce(
            (total, playerId) =>
                total +
                options[playerId]
                    .filter((option) => (draft.pledges[playerId] ?? []).includes(option.shipId))
                    .reduce((sum, option) => sum + option.strength, 0),
            0
        )
    )
</script>

<div class="editor">
    <div class="partners">
        <span class="label">Partners</span>
        <span class="chip mine"><PlayerName playerId={me} /></span>
        {#each others as playerId (playerId)}
            <button
                type="button"
                class="chip"
                class:on={draft.partnerIds.includes(playerId)}
                aria-pressed={draft.partnerIds.includes(playerId)}
                onclick={() => gameSession.togglePactPartner(playerId)}
                ><PlayerName {playerId} /></button
            >
        {/each}
    </div>

    {#each draft.partnerIds as playerId (playerId)}
        <div class="pledge">
            <span class="who"
                >{#if playerId === me}Your ships{:else}<PlayerName {playerId} />'s ships{/if}</span
            >
            <span class="ships">
                {#each options[playerId] as option (option.shipId)}
                    {@const chosen = (draft.pledges[playerId] ?? []).includes(option.shipId)}
                    <button
                        type="button"
                        class="ship"
                        class:on={chosen}
                        aria-pressed={chosen}
                        onclick={() => gameSession.togglePactShip(playerId, option.shipId)}
                        >{shipDefinition(option.shipId).name} +{option.strength}</button
                    >
                {/each}
            </span>
        </div>
    {/each}

    {#if target && terms && items.length > 0}
        <table class="shares">
            <thead>
                <tr>
                    <th></th>
                    {#each items as item (item)}
                        <th>{ITEM_LABELS[item]} ({target.reward[item]})</th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each draft.partnerIds as playerId (playerId)}
                    <tr>
                        <td><PlayerName {playerId} /></td>
                        {#each items as item (item)}
                            <td>
                                <span class="stepper">
                                    <button
                                        type="button"
                                        aria-label="Less {ITEM_LABELS[item]}"
                                        onclick={() =>
                                            gameSession.adjustPactShare(playerId, item, -1)}
                                        >−</button
                                    >
                                    <span>{terms.shares[playerId][item]}</span>
                                    <button
                                        type="button"
                                        aria-label="More {ITEM_LABELS[item]}"
                                        onclick={() =>
                                            gameSession.adjustPactShare(playerId, item, 1)}
                                        >+</button
                                    >
                                </span>
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}

    {#if terms?.keeperId !== undefined}
        <div class="partners">
            <span class="label">Keeps the tile</span>
            {#each draft.partnerIds as playerId (playerId)}
                <button
                    type="button"
                    class="chip"
                    class:on={terms.keeperId === playerId}
                    onclick={() => gameSession.choosePactKeeper(playerId)}
                    ><PlayerName {playerId} /></button
                >
            {/each}
        </div>
    {/if}

    <div class="actions">
        <span class="total" class:enough={target !== undefined && strength >= target.difficulty}
            >{strength} / {target?.difficulty}</span
        >
        <button
            type="button"
            class="primary"
            disabled={gameSession.pactProblem !== undefined}
            onclick={() => gameSession.proposePactDraft()}
            >{draft.counteredPactId ? 'Counter' : 'Propose pact'}</button
        >
        {#if gameSession.pactProblem}
            <span class="problem">{gameSession.pactProblem}</span>
        {/if}
    </div>
</div>

<style>
    .editor {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        border: 1px solid #2a3a58;
        border-radius: 8px;
        background: #0f1729;
    }

    .partners,
    .pledge,
    .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 8px;
    }

    .label,
    .who {
        min-width: 110px;
        font-size: 12.5px;
        color: #9fb4d0;
    }

    .ships {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .chip,
    .ship {
        padding: 3px 9px;
        border-radius: 6px;
        border: 1px solid #2f4366;
        font-size: 13px;
    }

    .chip.on,
    .ship.on,
    .chip.mine {
        border-color: #7fd3ff;
        background: #18324f;
    }

    .shares {
        font-size: 13px;
        border-collapse: collapse;
    }

    .shares th {
        padding: 2px 10px;
        font-weight: 600;
        color: #9fb4d0;
        text-align: center;
    }

    .shares td {
        padding: 2px 10px;
        text-align: center;
    }

    .stepper {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    .stepper button {
        width: 22px;
        height: 22px;
        padding: 0;
        border-radius: 4px;
    }

    .total {
        font-weight: 800;
        color: #f2994a;
    }

    .total.enough {
        color: #7fe08a;
    }

    .problem {
        font-size: 12.5px;
        color: #f2c94c;
    }
</style>
