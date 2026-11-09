export type JourneyProduct = {
  id: string; name: string; badge?: string; color?: string; soft?: string;
  image?: string; form?: string; rows?: [string, string][];
  features?: string; pending?: boolean; review?: string;
}

export const journeyProducts: JourneyProduct[] = [
  {
    "id": "conceive-q",
    "name": "Limitless Conceive Q",
    "badge": "Original",
    "color": "#60499d",
    "soft": "#a594c2",
    "image": "/assets/products/journey/conceive-q.jpg",
    "form": "Chewable Tablets / Powder Stick Pack",
    "rows": [
      [
        "Myo-Inositol",
        "2000 mg"
      ],
      [
        "Chiro-Inositol",
        "50 mg"
      ],
      [
        "Alpha-Lactalbumin",
        "50 mg"
      ],
      [
        "Methyl Folate (L-5-MTHF)",
        "400 mcg"
      ],
      [
        "CoQ10 Complex",
        "400 mg"
      ],
      [
        "Zinc",
        "22 mg"
      ]
    ],
    "features": "Clinically formulated to support reproductive health in both men and women, it features a superior 40:1 Myo-Inositol to D-Chiro-Inositol ratio; the gold standard for hormonal and metabolic balance. Enhanced with bioavailable folate, advanced CoQ10 and essential zinc to promote egg and sperm quality, insulin sensitivity and overall fertility outcomes."
  },
  {
    "id": "carnivita-women",
    "name": "Carnivita Advance Women",
    "badge": "For Women",
    "color": "#b61665",
    "soft": "#e68aa9",
    "image": "/assets/products/journey/carnivita-women.jpg",
    "form": "Powder Sachet",
    "rows": [
      [
        "L-Carnitine",
        "1000 mg"
      ],
      [
        "Acetyl L-Carnitine",
        "500 mg"
      ],
      [
        "Zinc",
        "500 mg †"
      ],
      [
        "Selenium",
        "27.5 mcg"
      ],
      [
        "L-Arginine",
        "500 mg"
      ],
      [
        "Folic Acid",
        "200 mcg"
      ],
      [
        "Vitamin E",
        "30 mg"
      ],
      [
        "Vitamin C",
        "90 mg"
      ],
      [
        "Vitamin B12",
        "2.5 mg †"
      ],
      [
        "Vitamin B5",
        "6 mg"
      ],
      [
        "Vitamin B6",
        "2 mg"
      ],
      [
        "N-Acetyl Cysteine",
        "50 mg"
      ],
      [
        "Vitamin D3",
        "5 mcg"
      ]
    ],
    "features": "A fertility-focused formula combining Levo-carnitine and antioxidants to support female reproductive health and energy.",
   
  },
  {
    "id": "methyl-folate",
    "name": "Limitless Methyl Folate",
    "badge": "1000 mcg",
    "color": "#b61935",
    "soft": "#e3697c",
    "image": "/assets/products/journey/methyl-folate.jpg",
    "form": "Mini Film Coated Tablets",
    "rows": [
      [
        "Methyl Folate (as Calcium L-5-Methyltetrahydrofolate)",
        "1000 mcg"
      ]
    ],
    "features": "Active folate to restore folate levels, especially recommended during pregnancy and for individuals with MTHFR mutation or a history of recurrent miscarriage."
  },
{
  id: 'omega-3',
  name: 'Limitless Omega-3',
  badge: '2000 mg',
  color: '#ad551e',
  soft: '#f7c438',
  image: '/assets/products/journey/omega-3.jpg',
  form: 'Soft Gel Capsules',
  rows: [
    ['Vitamin D3', '400 IU'],
    ['Fish Oil', '2000 mg'],
    ['Total Omega-3 Acids', '1400 mg'],
    ['Eicosapentaenoic Acid (EPA)', '300 mg'],
    ['Docosahexaenoic Acid (DHA)', '1000 mg'],
  ],
  features:
    'Delivers high-potency DHA with synergistic Vitamin D3 for optimal brain, heart, and immune support. 100% mercury-free and clinically backed for purity, safety and performance.',
},
  {
    "id": "lipoferrex",
    "name": "Limitless Lipoferrex",
    "badge": "40 mg",
    "color": "#b61935",
    "soft": "#e26950",
    "image": "/assets/products/journey/lipoferrex.jpg",
    "form": "Film Coated Tablets",
    "rows": [
      [
        "Iron (as Ferric Pyrophosphate)",
        "40 mg"
      ],
      [
        "Vitamin C (as Ascorbic Acid)",
        "70 mg"
      ],
      [
        "Folic Acid",
        "400 mcg"
      ],
      [
        "Vitamin D3",
        "400 IU"
      ],
      [
        "Vitamin B12 (as Cyanocobalamin)",
        "1.75 mcg"
      ],
      [
        "Vitamin B6 (as Pyridoxine HCl)",
        "1 mg"
      ]
    ],
    "features": "Clinically advanced iron formula with nanoliposomal technology for enhanced absorption and digestive comfort, supports red blood cell formation, hemoglobin, energy levels and helps correct iron deficiency effectively."
  }
]
