/**
 * Whether a `pointerover` or `pointerout` crosses the edge of the element that hears it, as a
 * `pointerenter` or `pointerleave` would. Those two don't bubble, so Svelte adds a listener for each
 * element that mounts with one; `pointerover` and `pointerout` bubble to its one root listener.
 */
export function crossesEdge({ currentTarget, relatedTarget }: PointerEvent): boolean {
    return !(
        currentTarget instanceof Node &&
        relatedTarget instanceof Node &&
        currentTarget.contains(relatedTarget)
    )
}
