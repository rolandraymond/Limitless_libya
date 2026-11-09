import { useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { journeyProducts, type JourneyProduct } from './journey-products'
import './journey-brochures.css'
import './mens-brochures.css'
import './orthopedic-brochures.css'
import './wellness-brochures.css'
import './beauty-brochures.css'

function CompositionTable({ rows }: { rows: [string, string][] }) {
  return <table>
    <thead><tr><th scope="col">Element</th><th scope="col">Amount per Serving</th></tr></thead>
    <tbody>{rows.map(([element, amount]) => <tr key={element}>
      <th scope="row">{element}</th><td>{amount.replace(/\s*†/g, '')}</td>
    </tr>)}</tbody>
  </table>
}

export default function JourneyBrochures({
  products = journeyProducts,
  collectionName = 'Enhance Her Journey',
}: { products?: JourneyProduct[]; collectionName?: string }) {
  const [index, setIndex] = useState(0)
  const product = products[index]
  const rows = product.rows ?? []
  const split = rows.length > 8 ? Math.ceil(rows.length / 2) : 0
  const style = {
    '--ej-accent': product.color ?? '#60499d',
    '--ej-soft': product.soft ?? '#a594c2',
    '--ej-background': product.image ? `url("${product.image}")` : 'none',
  } as CSSProperties
  const advance = (direction: number) => setIndex(current =>
    (current + direction + products.length) % products.length)

  return <div className="ej-browser">
    <nav className="ej-tabs" aria-label={`${collectionName} products`}>
      {products.map((item, i) => <button type="button" key={item.id}
        aria-pressed={i === index} onClick={() => setIndex(i)}>{item.name}</button>)}
    </nav>
    <div className="ej-controls">
      <button type="button" className="lp-icon" aria-label="Previous product" onClick={() => advance(-1)}><ChevronLeft size={20} /></button>
      <span aria-live="polite">{product.name} · {index + 1} / {products.length}</span>
      <button type="button" className="lp-icon" aria-label="Next product" onClick={() => advance(1)}><ChevronRight size={20} /></button>
    </div>
    {product.pending ? <section className="ej-pending" aria-labelledby="ej-pending-title">
      <p className="lp-kicker">Product details coming soon</p>
      <h3 id="ej-pending-title">{product.name}</h3>
      <p>Fish Oil 2000 mg</p>
    </section> : <article key={product.id} className={`ej-brochure ej-${product.id}`} style={style} aria-label={`${product.name} brochure`}>
      <div className="ej-main">
        <header className="ej-masthead">
          <h3>{product.name}</h3><span className="ej-badge">{product.badge}</span>
        </header>
        <section aria-labelledby={`ej-composition-${product.id}`}>
          <h4 className="ej-subtitle" id={`ej-composition-${product.id}`}>Composition</h4>
          <div className={`ej-tables${split ? ' ej-tables--split' : ''}`}>
            {split ? <><CompositionTable rows={rows.slice(0, split)} /><CompositionTable rows={rows.slice(split)} /></> : <CompositionTable rows={rows} />}
          </div>
        </section>
        <section className="ej-features" aria-labelledby={`ej-features-${product.id}`}>
          <h4 className="ej-subtitle" id={`ej-features-${product.id}`}>Key Features</h4>
          <p>{product.features}</p>
        </section>
        <span className="ej-form">{product.form}</span>
      </div>
      <aside className="ej-rail" aria-label="Product collection"><strong>{collectionName.toUpperCase()}</strong><span>{product.badge}</span></aside>
    </article>}
  </div>
}
