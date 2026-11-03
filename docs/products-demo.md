# Our Products demo

## Install

From the existing project directory, extract libya-products-demo.zip with `unzip -o ~/Downloads/libya-products-demo.zip -d .`.
This patch updates LibyaHome.tsx and PassPage.tsx and adds ProductsSection.tsx, products.ts, products.css and the supplied demo PNG. It does not change Worker, D1, Vite or Wrangler configuration.

Run `npm run build`, then `npm run dev`. No database migration is needed.

## Behavior

- Home anchor: `/#our-products`; main navigation includes Our Products.
- Two slides: Limitless Chromax Cut and Limitless Glow Hair, using the same supplied demo artwork. The artwork shows other products and is labeled as demo artwork, pending final individual assets.
- Automatic switching every 3 seconds while visible. Pause on hover, keyboard focus, modal open, hidden browser tab or offscreen section. Reduced-motion preference disables autoplay and entry animation.
- Image / Explore product opens a native modal dialog with Key Features and Composition. The tables contain 7 and 27 ingredient rows respectively, using team-supplied copy and amounts. Escape/Close dismisses the dialog; native focus trapping and focus restoration apply.
- Previous/next, slide buttons and pause/start controls are available.
- Event pass links to the home products anchor. In the same tab, session storage remembers the private pass URL so a Back to my invitation link appears. No token is added to the products URL. Storage blocking does not prevent viewing products.
- Data lives in src/products.ts; replace the demo image path in ProductsSection.tsx when final artwork arrives. No new dependencies.

## Manual verification

1. Open /#our-products. Keep the pointer outside the frame; verify the title changes every 3 seconds, and the controls work on desktop and mobile.
2. Hover or focus a control: automatic switching pauses. Click either product to inspect its description and composition table, including all 27 Glow Hair rows. Close using the button or Escape and verify focus returns.
3. Open a valid /pass?token=... link, click Explore Our Products, then Back to my invitation. The original invitation must be restored.
4. Test a 360px mobile viewport and reduced motion. Confirm text contrast, table wrapping and no horizontal page overflow.

## Validation performed here

All four changed/new TS/TSX modules parse using Babel. Scratch checks of the transpiled component with hook/DOM doubles verify 3-second advance, previous/next, pause, hover, visibility/offscreen behavior, details pause, invitation return, ingredient counts and cleanup. The existing attendance suite passes 49/49. Project dependencies are not installed here; a full TypeScript/Vite build and actual browser visual verification were not performed.
