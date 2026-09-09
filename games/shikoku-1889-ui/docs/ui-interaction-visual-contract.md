# Shikoku 1889 finances

The finance example follows the shared
[finance inspection contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md#finance-inspection).
The Game Session exposes an illustrative position with one prepared stock turn supporting purchases, sales, and Finish turn.
Share selection, trade previews, stock history, market rendering, and Undo follow the shared
contract. Switching away disposes this Game Session,
and revisiting restores its local example.

IPO and Market appear as separate pools of Bank-owned certificates. A president
certificate shows its 20% interest, two shares, and one certificate
limit contribution. Private ownership can be personal or corporate; the displayed
Controlling Owner identifies the player in control without changing ownership.

Browser checks cover those distinctions, title switching, and reload at desktop
and mobile widths. Runtime tests verify hydration and player identity stability.
Purchase, reload, and Undo are checked in the browser; processed-action replay is
checked through the engine.

IPO purchases display the par price; Market purchases display the market price.
Both pay the Bank. The prepared position uses ordinary market spaces.

Sales follow the shared contract: preview and cancellation leave the market and
portfolios unchanged; confirmation updates proceeds, presidency, and market
position. Undo restores the full trade. Effective certificate counts come from
the title rules for the current displayed market position.

Company starts and flotation follow the shared staged-selection contract. Sanuki
can be started by selecting its par price, and its separate flotation example
shows the qualifying purchase and capital grant. Its home remains reserved and
its station available after flotation, awaiting the operating round. Undo reverses
the purchase and automatic grant together.
