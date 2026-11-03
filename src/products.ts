export type Product = {
  id: string
  name: string
  form: string
  flavor?: string
  summary: string
  features: string
  url: string
  composition: [string, string][]
}

// Product copy and serving amounts supplied by the event team.
export const products: Product[] = [
  {
    id: 'chromax-cut', name: 'Limitless Chromax Cut', form: 'Powder Sachet', flavor: 'Green Apple',
    summary: 'A fresh approach to weight management.',
    features: 'Green apple-flavored sachet combining glucomannan to promote fullness, inulin and chromium for appetite control, and green coffee extract to enhance metabolism, designed to support healthy weight management and fat metabolism.',
    url: 'https://shop.limitlessnaturals.com/ar/products/limitless-chromax-cut',
    composition: [
      ['Glucomannan (from Konjac Root)', '1000 mg'], ['Inulin', '3200 mg'],
      ['Green Tea Leaf Extract', '50 mg'], ['Green Coffee Bean Extract', '50 mg'],
      ['Niacin', '5.3 mg'], ['Vitamin C (as Ascorbic Acid)', '27 mg'],
      ['Chromium (as Chromium Picolinate)', '11.6 mcg'],
    ],
  },
  {
    id: 'glow-hair', name: 'Limitless Glow Hair', form: 'Film Coated Tablets',
    summary: 'Discover everyday care for your hair.',
    features: "A rich blend of 27 elements including silica, marine collagen, MSM, and L-methionine to reduce hair fall, support regrowth, and restore shine, specially formulated for women's hair health.",
    url: 'https://shop.limitlessnaturals.com/products/limitless-glow-hair',
    composition: [
      ['Betacarotene (Source of Vitamin A)', '2 mg'], ['Vitamin C', '80 mg'],
      ['Vitamin D3', '800 IU'], ['Vitamin E', '40 mg'], ['Thiamine', '8 mg'],
      ['Riboflavin', '4 mg'], ['Niacin', '18 mg'], ['Vitamin B6', '10 mg'],
      ['Folic Acid', '400 mcg (DFE 667 mcg)'], ['Vitamin B12', '20 mcg'],
      ['Biotin', '150 mcg'], ['Pantothenic Acid', '40 mg'], ['Iron', '14 mg'],
      ['Iodine', '200 mcg'], ['Magnesium', '75 mg'], ['Zinc', '15 mg'],
      ['Selenium', '165 mcg'], ['Copper', '1 mg'], ['Manganese', '2 mg'],
      ['Chromium', '40 mcg'], ['Collagen Hydrolysate', '200 mg'],
      ['MSM (Methylsulphonymethane)', '200 mg'], ['L-Cystine', '100 mg'],
      ['Inositol', '200 mg'], ['L-Methionine', '50 mg'], ['Coenzyme Q10', '10 mg'],
      ['Silica', '24.6 mg'],
    ],
  },
]
