<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import type { ConspiracyNoTakeLine } from '$lib/model/conspiracyTake.js'
    import type { ReasonPart } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.1.4.IV — why no one at the site can be taken from, one red line per player there.
    let { lines }: { lines: ConspiracyNoTakeLine[] } = $props()

    let gameSession = getGameSession()

    function partsOf(line: ConspiracyNoTakeLine): ReasonPart[] {
        return line.kind === 'words' ? line.parts : gameSession.reasonParts(line.reason)
    }
</script>

{#each lines as line, i (i)}
    <p class="mb-1 text-[11px] text-oath-danger">
        {#each partsOf(line) as part, j (j)}{#if part.kind === 'text'}<TokenText
                    text={part.text}
                />{:else}<PlayerName
                    playerId={part.playerId}
                    possessive={part.possessive}
                />{/if}{/each}
    </p>
{/each}
