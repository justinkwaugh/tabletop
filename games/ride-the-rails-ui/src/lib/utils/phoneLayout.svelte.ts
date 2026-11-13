import { MediaQuery } from 'svelte/reactivity'
import { FOCUS_CHOOSER_INSET } from './boardFocus.js'

/** Below `sm`, the width the contract's Phone layout covers. */
const PHONE_WIDTH = new MediaQuery('(width < 40rem)', false)

/** Whether the view is phone width, below `sm` (reactive). */
export function isPhoneWidth(): boolean {
    return PHONE_WIDTH.current
}

export type PopupSide = 'left' | 'right' | 'bottom'

/**
 * Contract, Phone layout: on phones a popup opens below its hex, flips above it when there is no
 * room below and is shifted inside the viewport (the Floater's flip and shift); on wider screens it
 * keeps its side.
 */
export function popupSide(wide: PopupSide): PopupSide {
    return PHONE_WIDTH.current ? 'bottom' : wide
}

/**
 * The screen pixels at the top of the board kept clear of a fitted map for the focus chooser: on
 * phones, where the whole map is small and the chooser would cover its top; on wider screens the
 * board's own margin lies under it.
 */
export function boardInsetTop(): number {
    return PHONE_WIDTH.current ? FOCUS_CHOOSER_INSET : 0
}
