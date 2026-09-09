# TOP finances

The finance example follows the shared
[finance inspection contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md#finance-inspection).
The Game Session exposes an illustrative position with one prepared stock turn.
Share selection, payment confirmation, purchase history, and Undo follow the shared
contract. Switching away disposes this Game Session,
and revisiting restores its local example.

TOP additionally shows each numbered PEIR share's fraction of distributed earnings
and explains its current president: most shares, then lowest numbered share. Both
are derived from the displayed certificates. Union Bank's charter belongs in
its owner's portfolio; Union Bank's certificates and cash remain in its own treasury. Souris's President
is Union Bank, while its Controlling Owner is Union Bank's owning player.

Browser checks cover those distinctions, title switching, and reload at desktop
and mobile widths. Runtime tests cover player identity stability and retirement's
change to the PEIR denominator and president. Purchase, reload, and Undo are checked in the browser; processed-action replay is
checked through the engine.

Union Bank is a separate purchase choice. Its confirmation shows treasury cash
used first and its owning player paying the remainder. Company treasury shares
pay that company; Market purchases pay the Bank. Reserved shares are disabled.
