import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './LibyaGlobe.css'

// Representative country locations, not office addresses.
const COUNTRIES = [
  { name: 'Libya', lat: 27, lon: 17, label: [0, 29] },
  { name: 'Egypt', lat: 27, lon: 30, label: [12, -12] },
  { name: 'Saudi Arabia', lat: 24, lon: 45, label: [-16, 24] },
  { name: 'United Arab Emirates', lat: 24, lon: 54, label: [12, -24] },
  { name: 'Sudan', lat: 15, lon: 30, label: [12, 3] },
] as const

const REVEAL_ORDER = ['Egypt', 'Saudi Arabia', 'Sudan', 'United Arab Emirates', 'Libya'] as const
const REVEAL_SECONDS = 0.5
const INITIAL_PAUSE = 0.25
const REVEAL_END = INITIAL_PAUSE + REVEAL_ORDER.length * REVEAL_SECONDS

function location(lat: number, lon: number, radius = 1) {
  const latitude = THREE.MathUtils.degToRad(lat)
  const longitude = THREE.MathUtils.degToRad(lon)
  return new THREE.Vector3(
    radius * Math.cos(latitude) * Math.cos(longitude),
    radius * Math.sin(latitude),
    -radius * Math.cos(latitude) * Math.sin(longitude),
  )
}

type Props = { assetPath?: string; className?: string }
type Boundary = { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }

export default function LibyaGlobe({ assetPath = '/assets', className = '' }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const mountedHost = host.current
    if (!mountedHost) return
    const container: HTMLDivElement = mountedHost
    setStatus('loading')
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    } catch (error) {
      console.error('[LibyaGlobe] WebGL initialization failed', error)
      setStatus('error')
      return
    }

    let disposed = false
    let visible = false
    let loaded = false
    let prepared = false
    let dragging = false
    let lastTime = 0
    let elapsed = 0
    let revealElapsed = 0
    let lastInput = 0
    let pointerX = 0
    let pointerY = 0
    const drag = new THREE.Vector2()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const controller = new AbortController()
    const resources: Array<{ dispose(): void }> = []
    const labels: Array<{ element: HTMLDivElement; point: THREE.Vector3; offset: readonly number[]; step: number }> = []
    const countryVisuals: Array<{ step: number; marker: THREE.Sprite; core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> }> = []
    const routes: Array<{ step: number; mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>; opacity: number }> = []
    const highlights: Array<{ object: THREE.Object3D; material: THREE.MeshBasicMaterial | THREE.LineBasicMaterial; opacity: number }> = []
    const revealAmounts = REVEAL_ORDER.map(() => 0)
    const rings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = []
    const flights: Array<{ sprite: THREE.Sprite; curve: THREE.CatmullRomCurve3; step: number }> = []
    const scene = new THREE.Scene()
    const world = new THREE.Group()
    scene.add(world)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30)
    const canvas = renderer.domElement
    canvas.setAttribute('aria-hidden', 'true')
    container.appendChild(canvas)
    renderer.setClearColor(0x060e20, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    const keep = <T extends { dispose(): void }>(resource: T): T => {
      resources.push(resource)
      return resource
    }
    const globeGeometry = keep(new THREE.SphereGeometry(1, 128, 96))
    const globeMaterial = keep(new THREE.MeshStandardMaterial({
      color: 0x8492a6,
      roughness: 0.92,
      metalness: 0.0,
      normalScale: new THREE.Vector2(0.22, 0.22),
      emissive: 0xffdcb2,
      emissiveIntensity: 0.7,
    }))
    // The specular source is white for oceans; invert it for physical roughness.
    // Desaturate the daylight map slightly for the reference's restrained night palette.
    globeMaterial.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness;
         #ifdef USE_ROUGHNESSMAP
           float water = texture2D(roughnessMap, vRoughnessMapUv).g;
           roughnessFactor *= mix(0.98, 0.52, water);
         #endif`,
      ).replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         float landLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
         diffuseColor.rgb = mix(vec3(landLuminance), diffuseColor.rgb, 0.58);`,
      )
    }
    globeMaterial.customProgramCacheKey = () => 'libya-earth-realistic-v2'
    world.add(new THREE.Mesh(globeGeometry, globeMaterial))
    scene.add(new THREE.AmbientLight(0x8ba1be, 0.18))
    const sunlight = new THREE.DirectionalLight(0xe1ebfa, 1.65)
    sunlight.position.copy(location(48, -35, 5))
    scene.add(sunlight)

    // Local glow texture shared by every marker; depth testing hides far-side markers.
    const glowCanvas = document.createElement('canvas')
    glowCanvas.width = glowCanvas.height = 128
    const context = glowCanvas.getContext('2d')!
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(235,255,255,1)')
    gradient.addColorStop(0.09, 'rgba(160,245,255,1)')
    gradient.addColorStop(0.24, 'rgba(0,180,255,.8)')
    gradient.addColorStop(0.5, 'rgba(0,150,255,.23)')
    gradient.addColorStop(1, 'rgba(0,130,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
    const glowTexture = keep(new THREE.CanvasTexture(glowCanvas))
    const markerMaterial = keep(new THREE.SpriteMaterial({
      map: glowTexture, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }))
    const glow = (position: THREE.Vector3, scale: number) => {
      // Independent opacity is essential for sequential fades; share only the texture.
      const sprite = new THREE.Sprite(keep(markerMaterial.clone()))
      sprite.material.opacity = 0
      sprite.visible = false
      sprite.position.copy(position)
      sprite.scale.setScalar(scale)
      world.add(sprite)
      return sprite
    }

    // Thin blue atmosphere with a soft outer halo.
    for (const [radius, strength] of [[1.008, 0.55], [1.022, 0.07]]) {
      const atmosphere = keep(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        uniforms: { strength: { value: strength } },
        vertexShader: `varying vec3 normalView; varying vec3 viewDirection;
          void main() {
            vec4 p = modelViewMatrix * vec4(position, 1.0);
            normalView = normalize(normalMatrix * normal);
            viewDirection = normalize(-p.xyz);
            gl_Position = projectionMatrix * p;
          }`,
        fragmentShader: `uniform float strength;
          varying vec3 normalView; varying vec3 viewDirection;
          void main() {
            float rim = pow(1.0 - max(dot(normalize(normalView), normalize(viewDirection)), 0.0), 4.0);
            gl_FragColor = vec4(0.03, 0.53, 1.0, rim * strength);
          }`,
      }))
      world.add(new THREE.Mesh(keep(new THREE.SphereGeometry(radius, 96, 64)), atmosphere))
    }

    const libyaPoint = location(27, 17, 1.012)
    COUNTRIES.forEach(country => {
      const isLibya = country.name === 'Libya'
      const step = REVEAL_ORDER.indexOf(country.name)
      const point = location(country.lat, country.lon, 1.012)
      const marker = glow(point, isLibya ? 0.095 : 0.062)
      const core = new THREE.Mesh(
        keep(new THREE.SphereGeometry(isLibya ? 0.009 : 0.006, 16, 12)),
        keep(new THREE.MeshBasicMaterial({ color: 0xdaffff, toneMapped: false, transparent: true, opacity: 0 })),
      )
      core.position.copy(point)
      core.visible = false
      world.add(core)
      countryVisuals.push({ step, marker, core })
      const element = document.createElement('div')
      element.className = `ly-map-label${isLibya ? ' ly-map-label-libya' : ''}`
      element.setAttribute('aria-hidden', 'true')
      element.hidden = true
      element.style.opacity = '0'
      const title = document.createElement('span')
      title.textContent = country.name
      element.appendChild(title)
      if (isLibya) {
        const caption = document.createElement('strong')
        caption.textContent = 'NEW CHAPTER'
        element.appendChild(caption)
      }
      container.appendChild(element)
      labels.push({ element, point, offset: country.label, step })

      if (isLibya) {
        for (let i = 0; i < 3; i++) {
          const ring = new THREE.Mesh(
            keep(new THREE.RingGeometry(0.029, 0.0305, 80)),
            keep(new THREE.MeshBasicMaterial({
              color: 0x22caff, transparent: true, opacity: 0.7,
              side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
            })),
          )
          ring.position.copy(libyaPoint)
          ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), libyaPoint.clone().normalize())
          ring.scale.setScalar(1 + i * 0.65)
          ring.visible = false
          world.add(ring)
          rings.push(ring)
        }
        return
      }
      const start = point.clone().normalize()
      const end = libyaPoint.clone().normalize()
      const angle = start.angleTo(end)
      const samples = Array.from({ length: 81 }, (_, i) => {
        const t = i / 80
        // Spherical interpolation keeps long routes above the actual globe.
        const direction = start.clone().multiplyScalar(Math.sin((1 - t) * angle))
          .addScaledVector(end, Math.sin(t * angle)).divideScalar(Math.sin(angle))
        const arch = Math.sin(t * Math.PI)
        const north = new THREE.Vector3(0, 1, 0).addScaledVector(direction, -direction.y).normalize()
        direction.addScaledVector(north, arch * (0.07 + angle * 0.08)).normalize()
        return direction.multiplyScalar(1.014 + arch * (0.10 + angle * 0.12))
      })
      const curve = new THREE.CatmullRomCurve3(samples)
      for (const [radius, opacity] of [[0.0012, 0.92], [0.0042, 0.10]]) {
        const mesh = new THREE.Mesh(
          keep(new THREE.TubeGeometry(curve, 100, radius, 6, false)),
          keep(new THREE.MeshBasicMaterial({
            color: 0x37caff, transparent: true, opacity: 0,
            depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
          })),
        )
        mesh.visible = false
        mesh.geometry.setDrawRange(0, 0)
        world.add(mesh)
        routes.push({ step, mesh, opacity })
      }
      flights.push({ sprite: glow(curve.getPoint(0.5), 0.026), curve, step })
    })

    function addLibyaBoundary(boundary: Boundary) {
      const polygons = boundary.type === 'Polygon'
        ? [boundary.coordinates as number[][][]]
        : boundary.coordinates as number[][][][]
      for (const polygon of polygons) {
        const contour = polygon[0].slice(0, -1).map(([lon, lat]) => new THREE.Vector2(lon, lat))
        // Subdivide planar triangles before projection so the fill follows the sphere.
        const vertices: number[] = []
        const pushTriangle = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, depth: number) => {
          if (depth > 0) {
            const ab = a.clone().add(b).multiplyScalar(0.5)
            const bc = b.clone().add(c).multiplyScalar(0.5)
            const ca = c.clone().add(a).multiplyScalar(0.5)
            pushTriangle(a, ab, ca, depth - 1)
            pushTriangle(ab, b, bc, depth - 1)
            pushTriangle(ca, bc, c, depth - 1)
            pushTriangle(ab, bc, ca, depth - 1)
            return
          }
          for (const v of [a, b, c]) vertices.push(...location(v.y, v.x, 1.004).toArray())
        }
        for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
          pushTriangle(contour[a], contour[b], contour[c], 3)
        }
        const geometry = keep(new THREE.BufferGeometry())
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
        const fillMaterial = keep(new THREE.MeshBasicMaterial({
          color: 0x008bda, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
        }))
        const fill = new THREE.Mesh(geometry, fillMaterial)
        fill.visible = false
        world.add(fill)
        highlights.push({ object: fill, material: fillMaterial, opacity: 0.32 })
        const illuminationMaterial = keep(new THREE.MeshBasicMaterial({
          color: 0x22caff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          depthWrite: false, toneMapped: false,
        }))
        const illumination = new THREE.Mesh(geometry, illuminationMaterial)
        illumination.scale.setScalar(1.001)
        illumination.visible = false
        world.add(illumination)
        highlights.push({ object: illumination, material: illuminationMaterial, opacity: 0.12 })
        const outline = polygon[0].map(([lon, lat]) => location(lat, lon, 1.006))
        const outlineMaterial = keep(new THREE.LineBasicMaterial({ color: 0x1c9ddd, transparent: true, opacity: 0 }))
        const border = new THREE.Line(
          keep(new THREE.BufferGeometry().setFromPoints(outline)),
          outlineMaterial,
        )
        border.visible = false
        world.add(border)
        highlights.push({ object: border, material: outlineMaterial, opacity: 0.85 })
      }
    }

    const loader = new THREE.TextureLoader()
    const texture = (file: string, color = false) => new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(`${assetPath}/${file}`, value => {
        if (disposed) { value.dispose(); reject(new Error('Disposed')); return }
        keep(value)
        // Preserve 8K on desktop; cap GPU memory on small screens and older GPUs.
        const limit = Math.min(renderer.capabilities.maxTextureSize, container.clientWidth < 600 ? 4096 : 8192)
        const image = value.image as HTMLImageElement
        if (image.width > limit) {
          const resized = document.createElement('canvas')
          resized.width = limit
          resized.height = Math.round(image.height * limit / image.width)
          const resizer = resized.getContext('2d')
          if (resizer) {
            resizer.drawImage(image, 0, 0, resized.width, resized.height)
            const canvasTexture: THREE.Texture = value
            canvasTexture.image = resized
          }
        }
        if (color) value.colorSpace = THREE.SRGBColorSpace
        value.minFilter = THREE.LinearMipmapLinearFilter
        value.magFilter = THREE.LinearFilter
        value.generateMipmaps = true
        value.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy())
        resolve(value)
      }, undefined, error => reject(new Error(`Could not load ${assetPath}/${file}: ${String(error)}`)))
    })
    Promise.all([
      texture('earth-day-hd.jpg', true),
      texture('earth-night-hd.jpg', true),
      texture('earth-normal.jpg'),
      texture('earth-specular.jpg'),
      fetch(`${assetPath}/libya-boundary.json`, { signal: controller.signal }).then(response => {
        if (!response.ok) throw new Error('Boundary unavailable')
        return response.json() as Promise<Boundary>
      }),
    ]).then(([day, night, normal, specular, boundary]) => {
      if (disposed) return
      globeMaterial.map = day
      globeMaterial.emissiveMap = night
      globeMaterial.normalMap = normal
      globeMaterial.roughnessMap = specular
      globeMaterial.needsUpdate = true
      addLibyaBoundary(boundary)
      loaded = true
      setStatus('ready')
      updateLoop()
    }).catch(error => {
      if (!disposed) {
        console.error('[LibyaGlobe] Asset loading failed', error)
        setStatus('error')
      }
    })

    const projected = new THREE.Vector3()
    const worldPoint = new THREE.Vector3()
    const towardCamera = new THREE.Vector3()
    function applyReveal() {
      REVEAL_ORDER.forEach((_, step) => {
        revealAmounts[step] = THREE.MathUtils.smoothstep(
          (revealElapsed - INITIAL_PAUSE - step * REVEAL_SECONDS) / REVEAL_SECONDS, 0, 1,
        )
      })
      const libya = revealAmounts[4]
      for (const country of countryVisuals) {
        const amount = revealAmounts[country.step]
        country.marker.visible = country.core.visible = amount > 0
        country.marker.material.opacity = country.core.material.opacity = amount
      }
      for (const label of labels) label.element.style.opacity = String(revealAmounts[label.step])
      for (const route of routes) {
        const amount = revealAmounts[route.step]
        // Stop before Libya until its finale; then complete every incoming route.
        const progress = amount * (0.82 + libya * 0.18)
        const segments = Math.floor(progress * route.mesh.geometry.parameters.tubularSegments)
        const indicesPerSegment = route.mesh.geometry.parameters.radialSegments * 6
        route.mesh.geometry.setDrawRange(0, segments * indicesPerSegment)
        route.mesh.visible = segments > 0
        route.mesh.material.opacity = route.opacity * amount
      }
      for (const highlight of highlights) {
        highlight.object.visible = libya > 0
        highlight.material.opacity = highlight.opacity * libya
      }
      for (const ring of rings) ring.visible = libya > 0
    }
    function draw() {
      applyReveal()
      world.updateMatrixWorld(true)
      renderer.render(scene, camera)
      const factor = container.clientWidth < 500 ? 0.78 : 1
      for (const label of labels) {
        worldPoint.copy(label.point).applyMatrix4(world.matrixWorld)
        towardCamera.copy(camera.position).sub(worldPoint).normalize()
        const front = worldPoint.clone().normalize().dot(towardCamera) > 0.08
        projected.copy(worldPoint).project(camera)
        const x = (projected.x + 1) * container.clientWidth / 2
        const y = (1 - projected.y) * container.clientHeight / 2
        label.element.hidden = !loaded || revealAmounts[label.step] === 0 || !front || projected.z > 1 || x < 0 || x > container.clientWidth || y < 0 || y > container.clientHeight
        label.element.style.transform = `translate(${x + label.offset[0] * factor}px, ${y + label.offset[1] * factor}px)${label.element.classList.contains('ly-map-label-libya') ? ' translateX(-50%)' : ''}`
      }
    }
    function animate(time: number) {
      if (container.clientWidth < 600 && lastTime && time - lastTime < 1000 / 30) return
      const activeDelta = lastTime ? (time - lastTime) / 1000 : 0
      const delta = Math.min(activeDelta, 0.1)
      lastTime = time
      elapsed += delta
      // At normal frame rates each stage lasts 0.5s. Under a stalled/slow GPU,
      // stretch the reveal rather than consuming several country fades at once.
      revealElapsed = Math.min(REVEAL_END, revealElapsed + Math.min(activeDelta, 0.05))
      if (!dragging && performance.now() - lastInput > 2800) drag.multiplyScalar(Math.exp(-delta * 1.5))
      world.rotation.set(drag.y, drag.x + Math.sin(elapsed * 0.18) * 0.012, 0)
      rings.forEach((ring, i) => {
        const phase = (elapsed * 0.18 + i / 3) % 1
        ring.scale.setScalar(1 + phase * 1.8)
        const libya = THREE.MathUtils.smoothstep((revealElapsed - INITIAL_PAUSE - 4 * REVEAL_SECONDS) / REVEAL_SECONDS, 0, 1)
        ring.material.opacity = (1 - phase) * 0.8 * libya
      })
      flights.forEach((flight, i) => {
        const amount = THREE.MathUtils.smoothstep((revealElapsed - INITIAL_PAUSE - flight.step * REVEAL_SECONDS) / REVEAL_SECONDS, 0, 1)
        const libya = THREE.MathUtils.smoothstep((revealElapsed - INITIAL_PAUSE - 4 * REVEAL_SECONDS) / REVEAL_SECONDS, 0, 1)
        const routeProgress = amount * (0.82 + libya * 0.18)
        flight.sprite.visible = amount > 0 && !reducedMotion.matches
        flight.sprite.material.opacity = amount
        flight.sprite.position.copy(flight.curve.getPoint(((elapsed * 0.12 + i * 0.23) % 1) * routeProgress))
      })
      draw()
    }
    function updateLoop() {
      renderer.setAnimationLoop(null)
      lastTime = 0
      if (disposed || !visible || document.hidden || !loaded) return
      if (!prepared) {
        // Prepare hidden marker/route/highlight buffers too. A tiny offscreen render
        // avoids deferring GPU setup until a country's half-second reveal.
        renderer.compile(scene, camera)
        renderer.initTexture(glowTexture)
        const visibility: Array<[THREE.Object3D, boolean]> = []
        world.traverse(object => { visibility.push([object, object.visible]); object.visible = true })
        routes.forEach(route => route.mesh.geometry.setDrawRange(0, Infinity))
        const warmup = new THREE.WebGLRenderTarget(1, 1)
        try {
          renderer.setRenderTarget(warmup)
          renderer.render(scene, camera)
          renderer.readRenderTargetPixels(warmup, 0, 0, 1, 1, new Uint8Array(4))
        } finally {
          renderer.setRenderTarget(null)
          warmup.dispose()
          visibility.forEach(([object, wasVisible]) => { object.visible = wasVisible })
        }
        draw()
        prepared = true
      }
      if (reducedMotion.matches) {
        revealElapsed = REVEAL_END
        world.rotation.set(0, 0, 0)
        rings.forEach((ring, i) => { ring.scale.setScalar(1 + i * 0.65); ring.material.opacity = 0.7 - i * 0.15 })
        flights.forEach(flight => { flight.sprite.visible = false })
        draw()
      } else {
        renderer.setAnimationLoop(animate)
      }
    }
    const resize = new ResizeObserver(() => {
  const width = container.clientWidth
  const height = container.clientHeight

  if (!width || !height) return

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, width < 600 ? 1.5 : 2)
  )

  renderer.setSize(width, height)

  camera.aspect = width / height
  camera.zoom = 1

  // Fit the whole globe, atmosphere, and connection arcs.
  const verticalFov = THREE.MathUtils.degToRad(camera.fov)

  const horizontalFov = 2 * Math.atan(
    Math.tan(verticalFov / 2) * camera.aspect
  )

  const limitingFov = Math.min(verticalFov, horizontalFov)
 const sceneRadius = 1.06

const distance = (
  sceneRadius / Math.sin(limitingFov / 2)
) * 1.02

  camera.position.copy(location(22, 32, distance))
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()

  updateLoop()
})

    resize.observe(container)
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; updateLoop() })
    observer.observe(container)
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || reducedMotion.matches) return
      dragging = true
      pointerX = event.clientX
      pointerY = event.clientY
      canvas.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!dragging) return
      drag.x = THREE.MathUtils.clamp(drag.x + (event.clientX - pointerX) * 0.0015, -0.18, 0.18)
      drag.y = THREE.MathUtils.clamp(drag.y + (event.clientY - pointerY) * 0.001, -0.08, 0.08)
      pointerX = event.clientX
      pointerY = event.clientY
      lastInput = performance.now()
    }
    const up = () => { dragging = false; lastInput = performance.now() }
    const contextLost = (event: Event) => {
      event.preventDefault()
      renderer.setAnimationLoop(null)
      setStatus('error')
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('lostpointercapture', up)
    canvas.addEventListener('webglcontextlost', contextLost)
    reducedMotion.addEventListener('change', updateLoop)
    document.addEventListener('visibilitychange', updateLoop)

    return () => {
      disposed = true
      controller.abort()
      resize.disconnect()
      observer.disconnect()
      renderer.setAnimationLoop(null)
      reducedMotion.removeEventListener('change', updateLoop)
      document.removeEventListener('visibilitychange', updateLoop)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('lostpointercapture', up)
      canvas.removeEventListener('webglcontextlost', contextLost)
      labels.forEach(label => label.element.remove())
      resources.forEach(resource => resource.dispose())
      renderer.dispose()
      canvas.remove()
    }
  }, [assetPath])

  return (
    <div className={`ly-globe-wrap ly-globe-detailed ${className}`} role="group"
      aria-label="Earth at night, highlighting connections from Egypt, Saudi Arabia, the United Arab Emirates and Sudan to Libya.">
      <div ref={host} className="ly-globe-canvas" hidden={status === 'error'} />
 
      {status === 'loading' && <div className="ly-globe-message" role="status">Loading our global presence…</div>}
      {status === 'error' && <div className="ly-globe-message">
        <strong>Libya — NEW CHAPTER</strong>
        <p>Egypt · Saudi Arabia · United Arab Emirates · Sudan</p>
        <small>The interactive globe could not load.</small>
      </div>}
    </div>
  )
}
