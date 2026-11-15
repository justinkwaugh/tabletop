<script lang="ts">
    import type { MessageId } from '@tabletop/dicke-kartoffeln'
    import { MESSAGE_TEXT } from '$lib/utils/messageText.js'

    // A "Nachrichtenkarte": a fax from the agricultural press service. The card is laid out once
    // at its design size and scaled, so every size shows the same lines, only larger.
    let { messageId, width }: { messageId?: MessageId; width: number } = $props()

    const DESIGN_WIDTH = 300
    const ASPECT = 1.45
    const FAX_COUNT = 6
    const text = $derived(messageId ? MESSAGE_TEXT[messageId] : undefined)
</script>

<div class="frame" style:width="{width}px" style:height="{width * ASPECT}px">
    <div
        class="card"
        class:back={!text}
        style:width="{DESIGN_WIDTH}px"
        style:height="{DESIGN_WIDTH * ASPECT}px"
        style:font-size="{DESIGN_WIDTH / 14}px"
        style:transform="scale({width / DESIGN_WIDTH})"
    >
        {#if text}
            <div class="letterhead">
                <span class="logo">DK</span>
                <span class="sender">Agricultural Press Service<br />Dreieich</span>
            </div>
            <div class="fax strip">
                {#each { length: FAX_COUNT }, index (index)}<span>FAX</span>{/each}
            </div>
            <p class="headline">{text.headline}</p>
            <div class="effect">
                {#each text.effect as line (line)}
                    <p>{line}</p>
                {/each}
            </div>
        {:else}
            <div class="fax">FAX</div>
        {/if}
    </div>
</div>

<style>
    .frame {
        flex: none;
    }

    .card {
        transform-origin: top left;
        display: flex;
        flex: none;
        flex-direction: column;
        gap: 0.35em;
        overflow: hidden;
        border: 0.1em solid #bdb6a4;
        border-radius: 0.9em;
        background: #fffef9;
        padding: 0.6em 0.7em 1em;
        box-shadow: 0.1em 0.3em 0.6em rgba(40, 30, 10, 0.35);
        color: #1d1d1d;
        font-family: 'Kartoffeln Typewriter', 'Courier New', monospace;
        font-weight: 400;
        line-height: 1.2;
    }

    .card.back {
        align-items: center;
        justify-content: center;
        background: repeating-linear-gradient(
            45deg,
            #efe7d2,
            #efe7d2 0.6em,
            #e6dcc2 0.6em,
            #e6dcc2 1.2em
        );
    }

    .letterhead {
        display: flex;
        align-items: center;
        gap: 0.5em;
    }

    .logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.2em;
        height: 2.2em;
        border-radius: 50%;
        background: #1d1d1d;
        color: #fffef9;
        font-weight: 800;
        font-size: 0.9em;
    }

    .sender {
        font-size: 0.58em;
        letter-spacing: 0.02em;
        white-space: nowrap;
        text-transform: uppercase;
    }

    .fax {
        border-bottom: 0.14em solid #1d1d1d;
        white-space: nowrap;
        font-size: 0.72em;
        font-weight: 700;
    }

    .fax.strip {
        display: flex;
        justify-content: space-between;
    }

    .headline {
        font-size: 1.1em;
        font-weight: 700;
        text-align: center;
    }

    .effect {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        font-size: 0.9em;
        line-height: 1.15;
        text-align: center;
    }
</style>
