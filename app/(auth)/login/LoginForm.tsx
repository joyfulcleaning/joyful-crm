'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Mode = 'dark' | 'light'

const T = {
  dark: {
    bg:          'linear-gradient(158deg,#0e1626 0%,#0a0f1a 55%,#07080c 100%)',
    cardBg:      'rgba(18,26,42,.74)',
    cardBorder:  'rgba(255,255,255,.07)',
    fieldBg:     '#131c2d',
    fieldBorder: 'rgba(255,255,255,.08)',
    fieldIcon:   '#5d6b82',
    text:        '#eaf0fa',
    muted:       '#8593a8',
    label:       '#bf90ab',
    accent:      '#7c6cf0',
    accentHov:   '#8a7cf5',
    red:         '#f0506e',
    rule:        'rgba(255,255,255,.07)',
    footerTxt:   '#2e3545',
    glowA:       'rgba(108,92,240,.30)',
    glowB:       'rgba(124,108,240,.20)',
    glowC:       'rgba(190,144,171,.14)',
    spark:       'rgba(190,206,255,.85)',
    starFill:    'rgba(190,206,255,.92)',
    trackBg:     'rgba(255,255,255,.08)',
    trackBorder: 'rgba(255,255,255,.14)',
    shadowCard:  '0 24px 64px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06)',
    cardInset:   'rgba(10,15,30,.52)',
  },
  light: {
    bg:          'linear-gradient(158deg,#f6f5ff 0%,#e9ebf9 55%,#dfe2f6 100%)',
    cardBg:      'rgba(255,255,255,.88)',
    cardBorder:  'rgba(75,63,168,.10)',
    fieldBg:     '#f2f2fc',
    fieldBorder: 'rgba(75,63,168,.14)',
    fieldIcon:   '#9a8db8',
    text:        '#1b2236',
    muted:       '#6b7488',
    label:       '#9a5d7e',
    accent:      '#6b5ce0',
    accentHov:   '#7a6cf0',
    red:         '#e03050',
    rule:        'rgba(75,63,168,.13)',
    footerTxt:   '#9ca3af',
    glowA:       'rgba(107,92,224,.18)',
    glowB:       'rgba(107,92,224,.14)',
    glowC:       'rgba(190,144,171,.10)',
    spark:       'rgba(107,92,224,.55)',
    starFill:    'rgba(107,92,224,.65)',
    trackBg:     'rgba(75,63,168,.10)',
    trackBorder: 'rgba(75,63,168,.20)',
    shadowCard:  '0 16px 48px rgba(75,63,168,.12),inset 0 1px 0 rgba(255,255,255,.8)',
    cardInset:   'transparent',
  },
}

function starPath(r: number) {
  const s = r * 0.22
  return `M 0 ${-r} L ${s} ${-s} L ${r} 0 L ${s} ${s} L 0 ${r} L ${-s} ${s} L ${-r} 0 L ${-s} ${-s} Z`
}

const STARS = [
  { r: 9,  x: 66,  y: -10, delay: 0,   dur: 2.2 },
  { r: 5,  x: 10,  y: 22,  delay: 0.7, dur: 1.8 },
  { r: 7,  x: -14, y: 8,   delay: 1.4, dur: 2.6 },
  { r: 4,  x: 34,  y: 80,  delay: 0.5, dur: 2.0 },
  { r: 6,  x: -28, y: 72,  delay: 1.1, dur: 2.4 },
  { r: 3,  x: -5,  y: 46,  delay: 1.8, dur: 1.6 },
  { r: 8,  x: 58,  y: -4,  delay: 0.3, dur: 2.8 },
]

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  left:  (i * 37 + 7)  % 100,
  top:   (i * 53 + 13) % 100,
  size:  1.5 + (i % 3),
  dur:   3500 + (i * 700) % 4000,
  delay: (i * 317) % 3000,
}))

function SunIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
      <circle cx={12} cy={12} r={4.4}/>
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={11.2} y={0.6} width={1.6} height={3.4} rx={0.8}
          transform={`rotate(${i * 45} 12 12)`}/>
      ))}
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 14.5A8 8 0 1 1 10.2 4 6.4 6.4 0 0 0 20 14.5Z"/>
    </svg>
  )
}

export default function LoginForm() {
  const router = useRouter()
  const [mode,     setMode]     = useState<Mode>('light')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)
  const [ready,    setReady]    = useState(false)

  useEffect(() => { setReady(true) }, [])

  const tok = T[mode]
  const isDark = mode === 'dark'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <>
      <style>{`
        html,body { margin:0; padding:0; height:100%; }
        *, *::before, *::after { box-sizing:border-box; }
        @keyframes jl-floatY {
          0%,100% { transform:translateY(0px); }
          50%     { transform:translateY(-8px); }
        }
        @keyframes jl-halo {
          0%,100% { opacity:.26; transform:scale(1); }
          50%     { opacity:.42; transform:scale(1.06); }
        }
        @keyframes jl-glow1 {
          0%,100% { transform:translate(0,0); }
          50%     { transform:translate(44px,32px); }
        }
        @keyframes jl-glow2 {
          0%,100% { transform:translate(0,0); }
          50%     { transform:translate(-36px,-28px); }
        }
        @keyframes jl-glow3 {
          0%,100% { transform:translate(0,0); }
          50%     { transform:translate(22px,-20px); }
        }
        @keyframes jl-spark {
          0%,100% { opacity:0; }
          50%     { opacity:1; }
        }
        @keyframes jl-star {
          0%   { opacity:0; transform:scale(.2) rotate(0deg); }
          40%  { opacity:1; transform:scale(1) rotate(22deg); }
          50%  { opacity:.55; }
          60%  { opacity:1; }
          100% { opacity:0; transform:scale(.2) rotate(22deg); }
        }
        @keyframes jl-in {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        [data-jl-mode="dark"]  .jl-input::placeholder { color:#3e4d62; }
        [data-jl-mode="light"] .jl-input::placeholder { color:#a7a4bf; }
        .jl-input:focus { outline:none; }
        .jl-input:focus { border-color:rgba(124,108,240,.65) !important; }
        .jl-btn { transition:all .2s; }
        .jl-btn:hover:not(:disabled) { filter:brightness(1.12); transform:translateY(-1px);
          box-shadow:0 10px 30px rgba(108,92,240,.55) !important; }
        .jl-btn:active:not(:disabled) { transform:translateY(0); }
        .jl-eye:hover { opacity:.9; }
      `}</style>

      {/* ── Full-screen container (no scroll) ── */}
      <div data-jl-mode={mode} style={{
        height:'100vh', width:'100vw',
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        background: tok.bg,
        position:'relative', overflow:'hidden',
        fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        transition:'background .4s',
        padding:'0 16px',
      }}>

        {/* ── Glow blobs ── */}
        <div style={{ position:'absolute', top:-150, left:-150, width:380, height:380,
          borderRadius:'50%', pointerEvents:'none',
          background:`radial-gradient(circle,${tok.glowA} 0%,transparent 70%)`,
          animation:'jl-glow1 16s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', bottom:-150, right:-150, width:360, height:360,
          borderRadius:'50%', pointerEvents:'none',
          background:`radial-gradient(circle,${tok.glowB} 0%,transparent 70%)`,
          animation:'jl-glow2 19s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', top:'30%', right:-90, width:300, height:300,
          borderRadius:'50%', pointerEvents:'none',
          background:`radial-gradient(circle,${tok.glowC} 0%,transparent 70%)`,
          animation:'jl-glow3 22s ease-in-out infinite' }}/>

        {/* ── Sparkle dots ── */}
        {ready && SPARKS.map((s, i) => (
          <div key={i} style={{
            position:'absolute', pointerEvents:'none',
            left:`${s.left}%`, top:`${s.top}%`,
            width:s.size, height:s.size, borderRadius:'50%',
            backgroundColor: tok.spark,
            animation:`jl-spark ${s.dur}ms ${s.delay}ms ease-in-out infinite`,
          }}/>
        ))}

        {/* ── Theme toggle (top-right) ── */}
        <div style={{ position:'absolute', top:20, right:20, zIndex:20 }}>
          <button
            onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
            style={{
              position:'relative', width:62, height:28, borderRadius:14,
              background: tok.trackBg,
              border:`1px solid ${tok.trackBorder}`,
              cursor:'pointer', padding:0, display:'flex',
              alignItems:'center', justifyContent:'space-between',
              paddingLeft:6, paddingRight:6,
              transition:'background .3s, border-color .3s',
            }}
            aria-label="Toggle theme"
          >
            {/* Sun (left) */}
            <span style={{
              color: isDark ? tok.fieldIcon : tok.accent,
              opacity: isDark ? 0.38 : 1,
              transition:'opacity .3s, color .3s', zIndex:2, lineHeight:0,
            }}>
              <SunIcon/>
            </span>
            {/* Moon (right) */}
            <span style={{
              color: isDark ? tok.accent : tok.fieldIcon,
              opacity: isDark ? 1 : 0.38,
              transition:'opacity .3s, color .3s', zIndex:2, lineHeight:0,
            }}>
              <MoonIcon/>
            </span>
            {/* Sliding knob */}
            <div style={{
              position:'absolute',
              width:22, height:22, borderRadius:'50%',
              background:'linear-gradient(135deg,#7c6cf0,#6a59e6)',
              top:2,
              left: isDark ? 36 : 2,
              transition:'left .28s cubic-bezier(.34,1.56,.64,1)',
              boxShadow:'0 2px 8px rgba(108,92,240,.45)',
              zIndex:1,
            }}/>
          </button>
        </div>

        {/* ── Main content (compact, fits viewport) ── */}
        <div style={{
          width:'100%', maxWidth:390, zIndex:10,
          animation: ready ? 'jl-in .6s cubic-bezier(.2,.7,.3,1) both' : undefined,
          display:'flex', flexDirection:'column', gap:0,
        }}>

          {/* ── Brandmark ── */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:20 }}>
            <div style={{ position:'relative', display:'inline-block' }}>
              {/* Halo */}
              <div style={{
                position:'absolute', inset:-44, borderRadius:'50%', pointerEvents:'none',
                background:`radial-gradient(circle,${tok.glowA} 0%,transparent 70%)`,
                animation:'jl-halo 3s ease-in-out infinite',
              }}/>
              {/* Floating logo */}
              <div style={{ animation:'jl-floatY 5.8s ease-in-out infinite', position:'relative' }}>
                <Image
                  src="/Joyful_logo_transparent.png"
                  alt="Joyful Cleaning Services"
                  width={140} height={140}
                  priority
                  style={{
                    filter: isDark
                      ? 'drop-shadow(0 4px 24px rgba(108,92,240,.5))'
                      : 'drop-shadow(0 4px 16px rgba(107,92,224,.25))',
                    transition:'filter .4s',
                  }}
                />
                {/* 4-pointed stars */}
                <div style={{ position:'absolute', inset:0, overflow:'visible', pointerEvents:'none' }}>
                  {STARS.map((st, i) => (
                    <svg key={i}
                      width={st.r * 2 + 4} height={st.r * 2 + 4}
                      viewBox={`${-st.r-2} ${-st.r-2} ${st.r*2+4} ${st.r*2+4}`}
                      style={{
                        position:'absolute', left:'50%', top:'50%', overflow:'visible',
                        transform:`translate(calc(-50% + ${st.x}px),calc(-50% + ${st.y}px))`,
                        animation:`jl-star ${st.dur}s ${st.delay}s ease-in-out infinite`,
                      }}
                    >
                      <path d={starPath(st.r)} fill={tok.starFill}/>
                    </svg>
                  ))}
                </div>
              </div>
            </div>

            <h1 style={{
              marginTop:10, fontSize:19, fontWeight:700,
              color: tok.text, letterSpacing:'.02em', textAlign:'center',
              textShadow: isDark ? '0 2px 12px rgba(108,92,240,.32)' : 'none',
              transition:'color .3s',
            }}>
              Joyful Cleaning Services
            </h1>
            <p style={{ fontSize:11, color:tok.muted, marginTop:3, letterSpacing:'.04em', transition:'color .3s' }}>
              Management Portal
            </p>
          </div>

          {/* ── Glass card ── */}
          <div style={{
            background: tok.cardBg,
            backdropFilter:'blur(28px)',
            WebkitBackdropFilter:'blur(28px)',
            border:`1px solid ${tok.cardBorder}`,
            borderRadius:22,
            padding:'24px 26px 20px',
            boxShadow: tok.shadowCard,
            transition:'background .3s, border-color .3s, box-shadow .3s',
          }}>
            <h2 style={{
              fontSize:17, fontWeight:700, color:tok.text,
              marginBottom:18, textAlign:'center', letterSpacing:'.01em',
              transition:'color .3s',
            }}>
              Sign in
            </h2>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:13 }}>

              {error && (
                <div style={{
                  background:`${tok.red}1a`, border:`1px solid ${tok.red}4d`,
                  color:tok.red, fontSize:13, borderRadius:11,
                  padding:'9px 14px', textAlign:'center',
                }}>
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label style={{
                  display:'block', marginBottom:6,
                  fontSize:10, fontWeight:700, color:tok.label,
                  letterSpacing:'.09em', textTransform:'uppercase',
                  transition:'color .3s',
                }}>
                  Email
                </label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', lineHeight:0 }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={tok.fieldIcon} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      <rect x={3} y={5} width={18} height={14} rx={2.5}/><path d="M4 7l8 6 8-6"/>
                    </svg>
                  </span>
                  <input
                    className="jl-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    style={{
                      width:'100%', background:tok.fieldBg,
                      border:`1px solid ${tok.fieldBorder}`, borderRadius:12,
                      padding:'10px 13px 10px 40px', color:tok.text,
                      fontSize:14, transition:'border-color .2s, background .3s, color .3s',
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{
                  display:'block', marginBottom:6,
                  fontSize:10, fontWeight:700, color:tok.label,
                  letterSpacing:'.09em', textTransform:'uppercase',
                  transition:'color .3s',
                }}>
                  Password
                </label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', lineHeight:0 }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={tok.fieldIcon} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      <rect x={4.5} y={10.5} width={15} height={9.5} rx={2.5}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>
                      <circle cx={12} cy={15} r={1.3} fill={tok.fieldIcon} stroke="none"/>
                    </svg>
                  </span>
                  <input
                    className="jl-input"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{
                      width:'100%', background:tok.fieldBg,
                      border:`1px solid ${tok.fieldBorder}`, borderRadius:12,
                      padding:'10px 44px 10px 40px', color:tok.text,
                      fontSize:14, transition:'border-color .2s, background .3s, color .3s',
                    }}
                  />
                  <button
                    type="button"
                    className="jl-eye"
                    onClick={() => setShowPw(v => !v)}
                    style={{
                      position:'absolute', right:11, top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', cursor:'pointer', padding:4,
                      color:tok.fieldIcon, lineHeight:0, transition:'color .2s',
                    }}
                  >
                    {showPw ? (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 4.5 9 6a11 11 0 0 1-2.4 3.2M6.1 7.1C3.9 8.4 3 10.7 3 12c0 1.2 2.5 4.5 6.4 5.6"/>
                        <path d="M9.5 10.6a3 3 0 0 0 4 4"/>
                      </svg>
                    ) : (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12c0-1.5 4-6 9-6s9 4.5 9 6-4 6-9 6-9-4.5-9-6Z"/>
                        <circle cx={12} cy={12} r={2.6}/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="jl-btn"
                disabled={loading}
                style={{
                  marginTop:4, width:'100%', padding:'12px',
                  background: loading
                    ? `${tok.accent}70`
                    : `linear-gradient(135deg,${tok.accent},${tok.accentHov})`,
                  border:'none', borderRadius:13, color:'#fff',
                  fontSize:14, fontWeight:700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : `0 6px 22px ${tok.accent}66`,
                  letterSpacing:'.02em',
                }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Rule */}
            <div style={{ marginTop:18, borderTop:`1px solid ${tok.rule}`, paddingTop:14 }}>
              <p style={{ textAlign:'center', fontSize:10, color:tok.muted, letterSpacing:'.04em', transition:'color .3s' }}>
                Joyful Cleaning Services Corp.
              </p>
            </div>
          </div>

          {/* Footer */}
          <p style={{
            marginTop:16, textAlign:'center',
            fontSize:9, color:tok.footerTxt, letterSpacing:'.12em', textTransform:'uppercase',
            transition:'color .3s',
          }}>
            JOYFUL CLEANING SERVICES CORP. · NC
          </p>
        </div>
      </div>
    </>
  )
}
