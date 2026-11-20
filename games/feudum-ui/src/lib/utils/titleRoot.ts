/**
 * The title's own root, which the site marks `data-game-ui`: a lookup from inside the table stays
 * inside it, so it never finds another part of the page. A component mounted on its own, with no
 * such root round it, looks in its own document.
 */
export function titleRootOf(node: Element): ParentNode {
    return node.closest('[data-game-ui]') ?? node.ownerDocument
}
