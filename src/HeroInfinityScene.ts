import * as THREE from 'three'

/** Fixed original photograph with synchronized infinity/reflection illumination. */
export async function createHeroInfinityScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
  renderer.debug.onShaderError = () => { throw new Error('Hero shader compilation failed') }
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x060e20, 0)
  const loader = new THREE.TextureLoader()
  const textures: THREE.Texture[] = []
  let material: THREE.ShaderMaterial | undefined
  let geometry: THREE.PlaneGeometry | undefined
  try {
    // allSettled allows every successfully loaded texture to be released on failure.
    const results = await Promise.allSettled([
      loader.loadAsync('/assets/libya-red-castle.png'),
    ])
    for (const result of results) if (result.status === 'fulfilled') textures.push(result.value)
    if (results.some(result => result.status === 'rejected')) throw new Error('Hero artwork unavailable')
    const [original] = textures
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2)
    camera.position.z = 1
    material = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        original: { value: original },
        time: { value: 0 }, viewport: { value: new THREE.Vector2(1, 1) }, imageSize: { value: new THREE.Vector2(1572, 1001) },
        contain: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D original;
        uniform vec2 viewport, imageSize;
        uniform float time, contain;
        float coloredLight(vec3 color){
          // Select cyan/magenta illumination, excluding warm sunset and neutral highlights.
          return smoothstep(0.16,0.45,color.b-min(color.r,color.g))
            *smoothstep(0.32,0.75,max(color.r,color.b));
        }
        vec3 emission(vec2 uv){
          vec3 color=texture2D(original,uv).rgb;
          return color*coloredLight(color);
        }
        void main(){
          vec2 ratio=viewport/imageSize;
          float fit=mix(max(ratio.x,ratio.y),min(ratio.x,ratio.y),contain);
          vec2 p=(vUv-0.5)*viewport/(imageSize*fit)+0.5;
          if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0){gl_FragColor=vec4(0.02353,0.05490,0.12549,1.0);return;}
          float cycle=6.28318530718*mod(time,6.0)/6.0;
          float breath=0.5-0.5*cos(cycle);
          // Fixed artwork-space mask follows both branches; feathering avoids a box edge.
          vec2 loop=vec2((p.x-0.778)/0.166,(p.y-0.72)/0.105);
          float branch=2.0*abs(loop.x)*sqrt(max(0.0,1.0-loop.x*loop.x));
          float distanceToRibbon=abs(abs(loop.y)-branch);
          float infinityMask=(1.0-smoothstep(0.16,0.48,distanceToRibbon))
            *(1.0-smoothstep(1.0,1.09,abs(loop.x)))
            *(1.0-smoothstep(1.05,1.28,abs(loop.y)));
          // The waterfront is around source y=.54. Ripples start safely below it.
          float waterMask=(1.0-smoothstep(0.35,0.425,p.y))*smoothstep(0.008,0.06,p.y)
            *smoothstep(0.0,0.035,p.x)*(1.0-smoothstep(0.965,1.0,p.x));
          float reflectionMask=waterMask*smoothstep(0.48,0.62,p.x)
            *(1.0-smoothstep(0.95,1.0,p.x));
          // Several wave phases shear neighboring rows differently rather than sliding a layer.
          // Pixel-sized horizontal motion stays visible on mobile without large wave heights.
          vec2 pixelUv=1.0/(imageSize*fit);
          float wavePhase=p.y*230.0+sin(p.x*11.0)*0.65-2.0*cycle;
          float wave=sin(wavePhase);
          float secondary=sin(p.y*137.0+p.x*4.0+cycle);
          vec2 waterUv=p;
          waterUv.x+=waterMask*(wave*3.2+secondary*1.1)*pixelUv.x*(1.0-0.3*contain);
          // Small vertical variations locally stretch/compress the reflected ribbons.
          waterUv.y+=waterMask*(wave*0.0008+secondary*0.0003);
          vec3 base=texture2D(original,waterUv).rgb;
          float sourceMask=coloredLight(base);
          float region=clamp(infinityMask+reflectionMask*0.8,0.0,1.0);
          // Preserve bright ribbon texture; only its colored light gently dims and brightens.
          vec3 illuminated=base*(1.0-region*sourceMask*(1.0-breath)*0.28);
          float crest=pow(max(0.0,cos(wavePhase)),5.0);
          // Moving crests catch the existing reflected light; troughs separate the bands.
          illuminated*=1.0+waterMask*(crest*0.055-0.018);
          vec2 spread=vec2(0.004,0.006);
          vec3 halo=emission(waterUv)*0.32;
          halo+=(emission(waterUv+vec2(spread.x,0.0))+emission(waterUv-vec2(spread.x,0.0)))*0.12;
          halo+=(emission(waterUv+vec2(0.0,spread.y))+emission(waterUv-vec2(0.0,spread.y)))*0.12;
          halo+=(emission(waterUv+spread)+emission(waterUv-spread)
            +emission(waterUv+vec2(spread.x,-spread.y))+emission(waterUv+vec2(-spread.x,spread.y)))*0.05;
          float intensity=0.08+0.87*breath;
          vec3 reflectedCrest=emission(waterUv)*reflectionMask*crest
            *(0.025+0.15*breath);
          vec3 light=clamp(halo*(infinityMask+reflectionMask*0.68)*intensity
            +reflectedCrest,0.0,0.65);
          gl_FragColor=vec4(1.0-(1.0-illuminated)*(1.0-light),1.0);
        }`,
    })
    geometry = new THREE.PlaneGeometry(2, 2)
    scene.add(new THREE.Mesh(geometry, material))
    return {
      resize(width: number, height: number, mobile: boolean) {
        renderer.setSize(width, height, false)
        material!.uniforms.viewport.value.set(width, height)
        material!.uniforms.contain.value = mobile ? 1 : 0
      },
      draw(seconds: number) { material!.uniforms.time.value = seconds; renderer.render(scene, camera) },
      dispose() { textures.forEach(texture => texture.dispose()); geometry!.dispose(); material!.dispose(); renderer.dispose() },
    }
  } catch (error) {
    textures.forEach(texture => texture.dispose()); geometry?.dispose(); material?.dispose(); renderer.dispose()
    throw error
  }
}
