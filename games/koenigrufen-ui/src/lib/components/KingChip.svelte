<script lang="ts">
    // A King as a small card-coloured chip, so every player can spot it at a glance.
    import { FourthKing, isRed, type CalledKing } from '@tabletop/koenigrufen'
    import { calledKingName, spokenKingName } from '$lib/utils/actionDescription.js'

    let { king }: { king: CalledKing } = $props()

    const red = $derived(king !== FourthKing && isRed(king))
</script>

<span class="king" class:red aria-label={spokenKingName(king)}>{calledKingName(king)}</span>

<style>
    .king {
        display: inline-block;
        padding: 1px 7px 0;
        border: 1px solid #b9ae95;
        border-bottom: 2px solid rgb(0 0 0 / 0.45);
        border-radius: 5px;
        background: #f7f3ec;
        background-clip: padding-box;
        color: #1b1b1b;
        font-size: 1.1em;
        font-weight: 800;
        line-height: 1.2;
        white-space: nowrap;
    }

    .king.red {
        color: #c62828;
    }
</style>
