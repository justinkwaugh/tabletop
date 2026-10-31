<script lang="ts">
    let {
        subject,
        reason,
        keepGoing,
        disabled
    }: {
        subject: string
        reason: string
        keepGoing?: { ignoring: string; resume: () => void }
        disabled: boolean
    } = $props()
</script>

{subject} stopped: {reason}{#if keepGoing}<button class="link" {disabled} onclick={keepGoing.resume}
        >Keep going, ignore {keepGoing.ignoring}</button
    >{/if}

<style>
    .link {
        margin-left: 6px;
        padding: 0;
        border: 0;
        background: transparent;
        font: inherit;
        line-height: 16px;
        color: var(--rail-text, #e3e9ef);
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
    }
    .link:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .link:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 1px;
    }
</style>
