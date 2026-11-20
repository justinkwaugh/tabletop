/**
 * As `pointerenter`/`pointerleave` would: those don't bubble, so Svelte adds a listener per element,
 * while `pointerover`/`pointerout` bubble to its one root listener.
 */
export function crossesEdge({ currentTarget, relatedTarget }: PointerEvent): boolean {
    return !(
        currentTarget instanceof Node &&
        relatedTarget instanceof Node &&
        currentTarget.contains(relatedTarget)
    )
}
