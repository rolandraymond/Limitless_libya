import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { products, type Product } from './products'
import './products.css'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'


const PASS_RETURN_KEY = 'limitless-products-return'

export function rememberProductPass() {
  try { sessionStorage.setItem(PASS_RETURN_KEY, window.location.pathname + window.location.search) } catch { /* Storage is optional. */ }
}

function storedPass() {
  try {
    const path = sessionStorage.getItem(PASS_RETURN_KEY)
    return path?.startsWith('/pass?token=') ? path : null
  } catch { return null }
}

function ProductDetails({ product, onClose }: { product: Product; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    dialog.current?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      dialog.current?.close()
      previousFocus?.focus()
    }
  }, [])
  return <dialog ref={dialog} className="lp-dialog" aria-labelledby="lp-detail-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="lp-dialog-inner">
      <header className="lp-dialog-header">
        <div><p className="lp-kicker">Limitless Beauty</p><h2 id="lp-detail-title">{product.name}</h2></div>
        <button type="button" autoFocus className="lp-icon" onClick={onClose} aria-label="Close product details"><X size={20} /></button>
      </header>
      <div className="lp-detail-body">
        <div className="lp-tags"><span>{product.form}</span>{product.flavor && <span>Flavor: {product.flavor}</span>}</div>
        <h3>Key Features</h3><p>{product.features}</p>
        <div className="lp-table-wrap"><table>
          <caption>Composition</caption>
          <thead><tr><th scope="col">Element</th><th scope="col">Amount per Serving</th></tr></thead>
          <tbody>{product.composition.map(([element, amount]) => <tr key={element}><th scope="row">{element}</th><td>{amount}</td></tr>)}</tbody>
        </table></div>
       
      </div>
    </div>
  </dialog>
}

function ProductSlide({ product, index, reducedMotion, onDetails }: {
  product: Product
  index: number
  reducedMotion: boolean
  onDetails: (product: Product) => void
}) {
  const isPresent = useIsPresent()

  return (
<motion.div
  className="lp-slide"
  role="group"
  aria-roledescription="slide"
  aria-label={`${index + 1} of ${products.length}: ${product.name}`}
  aria-hidden={!isPresent}
  inert={!isPresent}
  initial={{ x: reducedMotion ? 0 : '100vw' }}
  animate={{ x: 0 }}
  exit={{ x: reducedMotion ? 0 : '-100vw' }}
  transition={{
    duration: reducedMotion ? 0 : 1.1,
    ease: [0.65, 0, 0.35, 1],
  }}
  style={{
    pointerEvents: isPresent ? 'auto' : 'none',
  }}
>
      <button
        className="lp-art"
        type="button"
        onClick={() => onDetails(product)}
        aria-label={`View ${product.name} details`}
      >
        <img
          src="/assets/products/beauty-demo.png"
          alt="Demo artwork showing the Limitless women's wellness collection"
          width="1920"
          height="930"
          loading="lazy"
        />
      </button>

      <div className="lp-slide-copy">
        <p className="lp-kicker">
          {product.form}
          {product.flavor ? ` · ${product.flavor}` : ''}
        </p>

        <h3>{product.name}</h3>
        <p>{product.summary}</p>

        <button
          type="button"
          className="lp-action"
          onClick={() => onDetails(product)}
          aria-haspopup="dialog"
        >
          Explore product <ArrowUpRight size={18} />
        </button>
      </div>
    </motion.div>
  )
}

export default function ProductsSection() {
  const [index, setIndex] = useState(0)
  const [details, setDetails] = useState<Product | null>(null)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [returnPass] = useState(storedPass)
  const section = useRef<HTMLElement>(null)
  const product = products[index]
  const advance = (direction: number) => setIndex(current => (current + direction + products.length) % products.length)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    const updateVisibility = () => setPageVisible(!document.hidden)
    updateMotion(); updateVisibility()
    media.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { threshold: 0.15 })
    if (section.current) observer.observe(section.current)
    return () => {
      media.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
      observer.disconnect()
    }
  }, [])

  const playing = !paused && !hovered && !focused && !details && visible && pageVisible && !reducedMotion
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setIndex(current => (current + 1) % products.length), 3000)
    return () => window.clearInterval(timer)
  }, [playing, index])

  return <section ref={section} id="our-products" className="lp-section" aria-labelledby="lp-heading">
    <div className="lp-section-heading"><div><p className="lp-kicker">Discover the range</p><h2 id="lp-heading">Our Products</h2></div>
      {returnPass && <a className="lp-return" href={returnPass}>Back to my invitation <ArrowUpRight size={16} /></a>}
    </div>
    <div className="lp-frame" role="region" aria-roledescription="carousel" aria-label="Limitless Beauty products"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <div className="lp-frame-top"><span>Limitless Beauty</span><span><strong>{String(index + 1).padStart(2, '0')}</strong> / {String(products.length).padStart(2, '0')}</span></div>
 <div className="lp-viewport" aria-live={playing ? 'off' : 'polite'}>
  <AnimatePresence initial={false} mode="sync">
    <ProductSlide
      key={product.id}
      product={product}
      index={index}
      reducedMotion={reducedMotion}
      onDetails={setDetails}
    />
  </AnimatePresence>
</div>
      <div className="lp-frame-bottom"><span className="lp-demo">Demo artwork · final product visuals to follow</span>
        <div className="lp-controls">
          <button type="button" className="lp-icon" aria-label="Previous product" onClick={() => advance(-1)}><ChevronLeft size={21} /></button>
          <div className="lp-dots">{products.map((item, i) => <button type="button" key={item.id} aria-label={`Show ${item.name}`} aria-current={i === index ? 'true' : undefined} onClick={() => setIndex(i)} />)}</div>
          <button type="button" className="lp-icon" aria-label="Next product" onClick={() => advance(1)}><ChevronRight size={21} /></button>
          {!reducedMotion && <button type="button" className="lp-icon" aria-label={paused ? 'Start automatic slides' : 'Pause automatic slides'} onClick={() => setPaused(current => !current)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>}
        </div>
      </div>
    </div>
    {details && <ProductDetails product={details} onClose={() => setDetails(null)} />}
  </section>
}
