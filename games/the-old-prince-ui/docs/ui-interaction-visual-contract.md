# TOP finances

The finance example follows the shared
[finance inspection contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md#finance-inspection).
The Game Session exposes an illustrative position with one prepared stock turn supporting purchases, sales, and Finish turn.
Share selection, trade previews, stock history, market rendering, and Undo follow the shared
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

Sales follow the shared contract: preview and cancellation leave the market and
portfolios unchanged; confirmation updates proceeds, presidency, and market
position. Undo restores the full trade. Effective certificate counts come from
the title rules for the current displayed market position.

Company starts and flotation follow the shared staged-selection contract. The
starting example supports player and Union Bank starts and displays tranche
occupancy. The flotation example exchanges a numbered PEIR share, replaces its
station, updates certificates and capital, and restores all of those through Undo.
The title's home positions come from its existing map definition. The finance
inspector displays station locations; integration into the board view is deferred.
