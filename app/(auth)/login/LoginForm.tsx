'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

function starPath(r: number) {
  const s = r * 0.22
  return `M 0 ${-r} L ${s} ${-s} L ${r} 0 L ${s} ${s} L 0 ${r} L ${-s} ${s} L ${-r} 0 L ${-s} ${-s} Z`
}

const STARS = [
  { r: 10, x: 72,  y: -10, delay: 0,   dur: 2.2 },
  { r: 6,  x: 12,  y: 26,  delay: 0.7, dur: 1.8 },
  { r: 8,  x: -16, y: 10,  delay: 1.4, dur: 2.6 },
  { r: 5,  x: 38,  y: 84,  delay: 0.5, dur: 2.0 },
  { r: 7,  x: -32, y: 76,  delay: 1.1, dur: 2.4 },
  { r: 4,  x: -6,  y: 50,  delay: 1.8, dur: 1.6 },
  { r: 9,  x: 62,  y: -6,  delay: 0.3, dur: 2.8 },
]

const SPARKS = Array.from({ length: 20 }, (_, i) => ({
  left:  (i * 37 + 7)  % 100,
  top:   (i * 53 + 13) % 100,
  size:  2 + (i % 3),
  dur:   3500 + (i * 700) % 4000,
  delay: (i * 317) % 3000,
}))

export default function LoginForm() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)
  const [ready,    setReady]    = useState(false)

  useEffect(() => { setReady(true) }, [])

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
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes jl-floatY {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-9px); }
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
          50%     { opacity:.85; }
        }
        @keyframes jl-star {
          0%   { opacity:0; transform:scale(.2) rotate(0deg); }
          40%  { opacity:1; transform:scale(1) rotate(22deg); }
          50%  { opacity:.55; }
          60%  { opacity:1; }
          100% { opacity:0; transform:scale(.2) rotate(22deg); }
        }
        @keyframes jl-cardIn {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes jl-logoIn {
          from { opacity:0; transform:translateY(-12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .jl-input::placeholder { color:#4b5b73; }
        .jl-input:focus { border-color:rgba(124,108,240,0.65) !important; }
        .jl-btn:hover:not(:disabled) {
          background:linear-gradient(135deg,#8a7cf5,#7468ea) !important;
          box-shadow:0 8px 28px rgba(108,92,240,0.55) !important;
          transform:translateY(-1px);
        }
        .jl-btn:active:not(:disabled) { transform:translateY(0); }
        .jl-eye:hover { color:#8593a8 !important; }
      `}</style>

      {/* ── Full-screen wrapper ── */}
      <div style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        background:'linear-gradient(158deg,#0e1626 0%,#0a0f1a 55%,#07080c 100%)',
        position:'relative', overflow:'hidden',
        fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        padding:'28px 16px',
      }}>

        {/* ── Glow blobs ── */}
        <div style={{
          position:'absolute', top:-160, left:-160,
          width:420, height:420, borderRadius:'50%', pointerEvents:'none',
          background:'radial-gradient(circle,rgba(108,92,240,.30) 0%,rgba(108,92,240,.10) 50%,transparent 100%)',
          animation:'jl-glow1 16s ease-in-out infinite',
        }}/>
        <div style={{
          position:'absolute', bottom:-160, right:-160,
          width:400, height:400, borderRadius:'50%', pointerEvents:'none',
          background:'radial-gradient(circle,rgba(124,108,240,.22) 0%,rgba(124,108,240,.07) 50%,transparent 100%)',
          animation:'jl-glow2 19s ease-in-out infinite',
        }}/>
        <div style={{
          position:'absolute', top:'35%', right:-100,
          width:320, height:320, borderRadius:'50%', pointerEvents:'none',
          background:'radial-gradient(circle,rgba(190,144,171,.14) 0%,transparent 70%)',
          animation:'jl-glow3 22s ease-in-out infinite',
        }}/>

        {/* ── Sparkle dots ── */}
        {ready && SPARKS.map((s, i) => (
          <div key={i} style={{
            position:'absolute', pointerEvents:'none',
            left:`${s.left}%`, top:`${s.top}%`,
            width:s.size, height:s.size, borderRadius:'50%',
            backgroundColor:'rgba(190,206,255,.85)',
            animation:`jl-spark ${s.dur}ms ${s.delay}ms ease-in-out infinite`,
          }}/>
        ))}

        {/* ── Main content ── */}
        <div style={{
          width:'100%', maxWidth:400, zIndex:10,
          animation: ready ? 'jl-cardIn .65s .05s cubic-bezier(.2,.7,.3,1) both' : undefined,
        }}>

          {/* ── Brandmark ── */}
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', marginBottom:32,
            animation: ready ? 'jl-logoIn .5s .1s ease both' : undefined,
          }}>
            <div style={{ position:'relative', display:'inline-block' }}>
              {/* Halo */}
              <div style={{
                position:'absolute', inset:-50, borderRadius:'50%', pointerEvents:'none',
                background:'radial-gradient(circle,rgba(108,92,240,.38) 0%,rgba(108,92,240,.14) 52%,transparent 100%)',
                animation:'jl-halo 3s ease-in-out infinite',
              }}/>
              {/* Floating logo */}
              <div style={{ animation:'jl-floatY 5.8s ease-in-out infinite', position:'relative' }}>
                <Image
                  src="/Joyful_logo_transparent.png"
                  alt="Joyful Cleaning Services"
                  width={185} height={185}
                  priority
                  style={{ filter:'drop-shadow(0 4px 28px rgba(108,92,240,.45))' }}
                />
                {/* 4-pointed stars */}
                <div style={{ position:'absolute', inset:0, overflow:'visible', pointerEvents:'none' }}>
                  {STARS.map((st, i) => (
                    <svg key={i}
                      width={st.r * 2 + 4} height={st.r * 2 + 4}
                      viewBox={`${-st.r - 2} ${-st.r - 2} ${st.r * 2 + 4} ${st.r * 2 + 4}`}
                      style={{
                        position:'absolute',
                        left:'50%', top:'50%',
                        overflow:'visible',
                        transform:`translate(calc(-50% + ${st.x}px), calc(-50% + ${st.y}px))`,
                        animation:`jl-star ${st.dur}s ${st.delay}s ease-in-out infinite`,
                      }}
                    >
                      <path d={starPath(st.r)} fill="rgba(190,206,255,.92)"/>
                    </svg>
                  ))}
                </div>
              </div>
            </div>

            <h1 style={{
              marginTop:14, fontSize:21, fontWeight:700,
              color:'#eaf0fa', letterSpacing:'.02em', textAlign:'center',
              textShadow:'0 2px 14px rgba(108,92,240,.32)',
            }}>
              Joyful Cleaning Services
            </h1>
            <p style={{ fontSize:12, color:'#8593a8', marginTop:4, letterSpacing:'.04em' }}>
              Management Portal
            </p>
          </div>

          {/* ── Glass card ── */}
          <div style={{
            background:'rgba(18,26,42,.74)',
            backdropFilter:'blur(28px)',
            WebkitBackdropFilter:'blur(28px)',
            border:'1px solid rgba(255,255,255,.07)',
            borderRadius:22,
            padding:'32px 28px 28px',
            boxShadow:'0 28px 70px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06)',
          }}>

            <h2 style={{
              fontSize:18, fontWeight:700, color:'#eaf0fa',
              marginBottom:24, textAlign:'center', letterSpacing:'.01em',
            }}>
              Sign in
            </h2>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {error && (
                <div style={{
                  background:'rgba(240,80,110,.12)', border:'1px solid rgba(240,80,110,.30)',
                  color:'#f0506e', fontSize:13, borderRadius:11, padding:'10px 14px', textAlign:'center',
                }}>
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label style={{
                  display:'block', marginBottom:8,
                  fontSize:11, fontWeight:700, color:'#bf90ab',
                  letterSpacing:'.09em', textTransform:'uppercase',
                }}>
                  Email
                </label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', lineHeight:0 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#5d6b82" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
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
                      width:'100%', background:'#131c2d',
                      border:'1px solid rgba(255,255,255,.08)', borderRadius:13,
                      padding:'12px 14px 12px 42px', color:'#eaf0fa',
                      fontSize:14, outline:'none', transition:'border-color .2s',
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{
                  display:'block', marginBottom:8,
                  fontSize:11, fontWeight:700, color:'#bf90ab',
                  letterSpacing:'.09em', textTransform:'uppercase',
                }}>
                  Password
                </label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', lineHeight:0 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#5d6b82" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      <rect x={4.5} y={10.5} width={15} height={9.5} rx={2.5}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>
                      <circle cx={12} cy={15} r={1.3} fill="#5d6b82" stroke="none"/>
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
                      width:'100%', background:'#131c2d',
                      border:'1px solid rgba(255,255,255,.08)', borderRadius:13,
                      padding:'12px 46px 12px 42px', color:'#eaf0fa',
                      fontSize:14, outline:'none', transition:'border-color .2s',
                    }}
                  />
                  <button
                    type="button"
                    className="jl-eye"
                    onClick={() => setShowPw(v => !v)}
                    style={{
                      position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', cursor:'pointer', padding:4,
                      color:'#5d6b82', lineHeight:0, transition:'color .2s',
                    }}
                  >
                    {showPw ? (
                      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 4.5 9 6a11 11 0 0 1-2.4 3.2M6.1 7.1C3.9 8.4 3 10.7 3 12c0 1.2 2.5 4.5 6.4 5.6"/>
                        <path d="M9.5 10.6a3 3 0 0 0 4 4"/>
                      </svg>
                    ) : (
                      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
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
                  marginTop:8, width:'100%', padding:'14px',
                  background: loading
                    ? 'rgba(124,108,240,.45)'
                    : 'linear-gradient(135deg,#7c6cf0,#6a59e6)',
                  border:'none', borderRadius:14, color:'#fff',
                  fontSize:15, fontWeight:700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 6px 22px rgba(108,92,240,.42)',
                  transition:'all .2s', letterSpacing:'.02em',
                }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Divider + brand notice */}
            <div style={{ marginTop:24, borderTop:'1px solid rgba(255,255,255,.07)', paddingTop:16 }}>
              <p style={{ textAlign:'center', fontSize:11, color:'#3d4657', letterSpacing:'.04em' }}>
                Joyful Cleaning Services Corp.
              </p>
            </div>
          </div>

          {/* Footer */}
          <p style={{
            marginTop:24, textAlign:'center',
            fontSize:10, color:'#2e3545', letterSpacing:'.12em', textTransform:'uppercase',
          }}>
            JOYFUL CLEANING SERVICES CORP. · NC
          </p>
        </div>
      </div>
    </>
  )
}
