# TOP finance inspection

The finance example follows the shared
[finance inspection contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md#finance-inspection).
The Game Session exposes the title's illustrative position; the screen has no
Action Draft or gameplay mutations. Switching away disposes this Game Session,
and revisiting restores its local example.

TOP additionally shows each numbered PEIR share's fraction of distributed earnings
and explains its current president: most shares, then lowest numbered share. Both
are derived from the displayed holdings. Union Bank's charter belongs in
its owner's portfolio; Union Bank's certificates and cash remain in its own treasury. Souris's President
is Union Bank, while its Controlling Owner is Union Bank's owning player.

Browser checks cover those distinctions, title switching, and reload at desktop
and mobile widths. Runtime tests cover player identity stability and retirement's
change to the PEIR denominator and president. No history behavior is claimed for
this action-free scenario.
