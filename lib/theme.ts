export const JOYFUL_PURPLE = '#4A3FB0'
export const JOYFUL_PURPLE_HOVER = '#3D34A0'

export function applyTheme(theme: 'dark' | 'light') {
  if (typeof window === 'undefined') return
  if (theme === 'light') {
    document.body.classList.add('light')
    document.body.classList.remove('dark')
  } else {
    document.body.classList.add('dark')
    document.body.classList.remove('light')
  }
  localStorage.setItem('theme', theme)
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }))
}

export function getTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
}
