# Interface rules

Follow these when changing pages. For wording, use the humanizer skill in
`.claude/skills/humanizer/` (from github.com/blader/humanizer, MIT).

## Layout

- One title per page, in the top bar. No eyebrow label, hero banner or greeting.
- A section is a heading and its content (`PageSection`). Do not wrap sections in cards.
- Lists of records are tables (`DataTable`) or divided rows (`ProductList`). No card grids.
- Numbers go in a `StatRow` or a right-aligned column with tabular figures.
- Show one primary button per task. Other actions are outline or link buttons.

## Style

- Black, white and zinc grey. Colour only for errors, warnings and graph node kinds.
- Small corner radius. No gradients, shadows or tinted panels.
- Icons only in the sidebar. No decorative icons beside headings, buttons or messages.
- No badges for ordinary values. Write them as text.
- Use Nuxt UI components for controls.

## Text

- Name things plainly: "Products", "Check order". No slogans.
- Add a description only when someone needs it to use the page.
- Every sentence states a fact the reader does not already see on screen.
- No em dashes, no groups of three for rhythm, no "not X but Y".
- Explanations of how a feature works go behind "How this works", not on the page.
