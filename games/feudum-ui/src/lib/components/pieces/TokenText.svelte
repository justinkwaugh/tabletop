<script lang="ts">
    import { tokenParts } from '$lib/model/tokenText.js'
    import GoodToken from './GoodToken.svelte'
    import GuildIcon from './GuildIcon.svelte'
    import MonsterToken from './MonsterToken.svelte'
    import SealFace from './SealFace.svelte'
    import ShillingToken from './ShillingToken.svelte'
    import TextMark from './TextMark.svelte'
    import VesselToken from './VesselToken.svelte'

    /**
     * A panel or history line, with what it names drawn as its piece, so the table and the
     * sentences share one vocabulary. Each token keeps the word as its label; a guild keeps its name.
     */
    let { text }: { text: string } = $props()

    let parts = $derived(tokenParts(text))
    const Em = 16
</script>

{#each parts as part, index (index)}
    {#if 'text' in part}{part.text}{:else}<span
            class="token-text__token"
            aria-label={part.word}
            role="img"
            >{#if part.amount}{part.amount}{/if}{#if part.token.kind === 'good'}<GoodToken
                    good={part.token.good}
                    size={Em}
                />{:else if part.token.kind === 'shilling'}<ShillingToken
                    value={part.token.value}
                    size={Em}
                />{:else if part.token.kind === 'seal'}<SealFace
                    faceShown={false}
                    size={Em}
                />{:else if part.token.kind === 'bead'}<SealFace
                    faceShown={part.token.value !== undefined}
                    beadValue={part.token.value}
                    size={Em}
                />{:else if part.token.kind === 'vp' || part.token.kind === 'star'}<TextMark
                    kind={part.token.kind}
                    label={part.word}
                />{:else if part.token.kind === 'vessel'}<VesselToken
                    vessel={part.token.vessel}
                    size={Em * 1.5}
                />{:else if part.token.kind === 'monster'}<MonsterToken
                    monster={part.token.monster}
                    size={Em * 1.25}
                />{:else}<GuildIcon guild={part.token.guild} size={Em} />{part.word}{/if}</span
        >{/if}
{/each}

<style>
    .token-text__token {
        display: inline-flex;
        align-items: center;
        gap: 0.15em;
        vertical-align: -0.2em;
        white-space: nowrap;
    }
</style>
