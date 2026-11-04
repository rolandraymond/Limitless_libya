export type Product = {
  id: string
  name: string
  form: string
  flavor?: string
  image?: string
  summary: string
  features: string
  items?: string[]
  details?: Product[]
  composition: [string, string][]
}

const glowHair: Product = {
  id: 'glow-hair',
  name: 'Limitless Glow Hair',
  image: '/assets/products/LimitlessChromaxCut.webp',
  form: 'Film Coated Tablets',
  summary: 'Discover everyday care for your hair.',
  features:
    "A rich blend of 27 elements including silica, marine collagen, MSM, and L-methionine to reduce hair fall, support regrowth, and restore shine, specially formulated for women's hair health.",
  composition: [
    ['Betacarotene (Source of Vitamin A)', '2 mg'],
    ['Vitamin C', '80 mg'],
    ['Vitamin D3', '800 IU'],
    ['Vitamin E', '40 mg'],
    ['Thiamine', '8 mg'],
    ['Riboflavin', '4 mg'],
    ['Niacin', '18 mg'],
    ['Vitamin B6', '10 mg'],
    ['Folic Acid', '400 mcg (DFE 667 mcg)'],
    ['Vitamin B12', '20 mcg'],
    ['Biotin', '150 mcg'],
    ['Pantothenic Acid', '40 mg'],
    ['Iron', '14 mg'],
    ['Iodine', '200 mcg'],
    ['Magnesium', '75 mg'],
    ['Zinc', '15 mg'],
    ['Selenium', '165 mcg'],
    ['Copper', '1 mg'],
    ['Manganese', '2 mg'],
    ['Chromium', '40 mcg'],
    ['Collagen Hydrolysate', '200 mg'],
    ['MSM (Methylsulphonymethane)', '200 mg'],
    ['L-Cystine', '100 mg'],
    ['Inositol', '200 mg'],
    ['L-Methionine', '50 mg'],
    ['Coenzyme Q10', '10 mg'],
    ['Silica', '24.6 mg'],
  ],
}

export const products: Product[] = [
  {
    id: 'enhance-her-journey',
    name: 'Enhance Her Journey',
image: '/assets/products/Enhance Her Journey copy.png',
    form: '5 Products',
    summary: '',
    features: '',
    composition: [],
    items: [
      'Limitless Conceive Q',
      'Carnivita Advance Women',
      'Limitless Methyl Folate',
      'Limitless Omega-3',
      'Limitless Lipoferrex',
    ],
  },
  {
    id: 'mens-health',
    name: 'Limitless Men’s Health',
    image: '/assets/products/Limitless Men’s Health 2.png',
    form: '3 Products',
    summary: '',
    features: '',
    composition: [],
    items: [
      'Carnivita Advance Men',
      'Limitless PowerMax',
      'Limitless Prostanorm Max',
    ],
  },
  {
    id: 'orthopedic-health',
    name: 'Limitless Orthopedic Health',
    image: '/assets/products/Limitless Orthopedic Health 2.png',
    form: '5 Products',
    summary: '',
    features: '',
    composition: [],
    items: [
      'Limitless Allzyme',
      'Limitless B Complex ODF',
      'Limitless Osteodense',
      'Limitless Ossofortin 5000',
      'Limitless Magnesium',
    ],
  },
  {
    id: 'wellness',
    name: 'Limitless Wellness',
    image: '/assets/products/Limitless Wellness2.png',
    form: '4 Products',
    summary: '',
    features: '',
    composition: [],
    items: [
      'Limitless Man Max',
      'Limitless Woman Max',
      'Limitless Omega-3',
      'Limitless Woman Multigummies',
    ],
  },
  {
    id: 'beauty',
    name: 'Limitless Beauty',
    image: '/assets/products/Limitless Beauty.png',
    form: '2 Products',
    summary: '',
    features: '',
    composition: [],
    items: [
      'Limitless Chromax Cut',
      'Limitless Glow Hair',
    ],
    details: [glowHair],
  },
]