Enhance Her Journey integration

1. Open a terminal in the website project directory (the directory containing package.json).
2. Extract this patch there. It replaces src/ProductsSection.tsx using your supplied current version and adds the other files.
3. Example if the ZIP is in Downloads:
   unzip -o ~/Downloads/enhance-her-journey-integration.zip -d .
4. Run npm run dev (or keep the existing dev server running).
5. Open Our Products, choose Enhance Her Journey, and press Explore product.
6. Select each product using the buttons inside the details dialog.

Your products.ts and products.css do not need changes for this patch.
The main carousel behavior and the other product groups are preserved.
Journey composition and features live in src/journey-products.ts.
The new CSS uses ej- prefixes and is scoped to .lp-dialog.

Pending content:
- Omega-3 Fish Oil 2000 mg: no composition supplied for this exact version.
- Carnivita Women: brochure prints Zinc 500 mg and Vitamin B12 2.5 mg. These source values are flagged for product-team verification before publishing.

Validation:
- TypeScript/TSX syntax parsed for the three source files.
- Main carousel source is unchanged.
- Background assets extracted from the supplied PDF.
- Full project build and integrated browser check must be run in your project; this patch was not deployed.
