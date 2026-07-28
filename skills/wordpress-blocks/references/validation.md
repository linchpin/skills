# Validation — always, before insert

Block markup that *looks* right can still be rejected by the editor (a drifted wrapper class,
a void/open mismatch, attribute JSON that doesn't match the saved HTML). A rejected block
shows as *"This block contains unexpected or invalid content"* and the user loses the layout.
So validation is not optional — it's the last step of every content generation.

## The contract

1. Generate the block markup (reused asset or composed core blocks).
2. Call `validate_blocks({ block_markup, autofix: true })` (see `tool-contract.md`).
3. Branch on the result:
   - `valid: true` → insert the markup (use `fixed_markup` if present — it's normalized).
   - `valid: false` → read `issues`, repair, and re-validate. Common repairs:
     - void/open mismatch (`/-->` vs `-->`) — see `block-grammar.md`
     - missing/wrong `wp-block-*` wrapper class or tag
     - attribute JSON not matching generated classes (e.g. `textColor` set but `has-…-color`
       class missing)
     - a referenced block that isn't registered (`list_registered_blocks` to confirm) — drop
       to a core-block equivalent
   - Still invalid after a repair pass → **simplify**. Fall back to a plainer composition
     (e.g. paragraphs + a single columns block) rather than shipping invalid markup. A simpler
     layout that renders beats a fancy one that breaks.
4. Never return un-validated markup to the editor, and never paper over failure with prose.

## Why repair instead of guess

Saved-HTML shapes drift across WordPress/Gutenberg versions, so the exact classes in this
skill's examples won't be byte-perfect on every site. The validator reflects *this* site's
actual block versions — trust it over hand-written markup. Prefer `fixed_markup` from the
validator when it's offered; it's the site's own normalization of your intent.

## Host wiring

Point `validate_blocks` at a real WordPress parser so "valid" means what the editor means.
The WordPress Studio MCP server exposes `validate_html_blocks` and `validate_and_fix_blocks`
for exactly this; reuse one instead of writing a parser. The `autofix`/`fixed_markup` path
maps to `validate_and_fix_blocks`.
