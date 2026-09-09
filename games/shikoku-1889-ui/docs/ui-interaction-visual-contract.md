# Shikoku 1889 finance inspection

The finance example follows the shared
[finance inspection contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md#finance-inspection).
The Game Session exposes the title's illustrative position; the screen has no
Action Draft or gameplay mutations. Switching away disposes this Game Session,
and revisiting restores its local example.

IPO and Market appear as separate pools of Bank-owned certificates. A president
certificate shows its 20% interest, two shares, and one certificate
limit contribution. Private ownership can be personal or corporate; the displayed
Controlling Owner identifies the player in control without changing ownership.

Browser checks cover those distinctions, title switching, and reload at desktop
and mobile widths. Runtime tests verify hydration and player identity stability.
No history behavior is claimed for this action-free scenario.
