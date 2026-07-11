'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

const LANG_KEY = 'app_language'

export type Lang = 'en' | 'es'

const en = {
  locale: 'en-US',

  nav: {
    dashboard:  'Dashboard',
    aiRequests: 'AI Requests',
    calendar:   'Calendar',
    map:        'Map',
    services:   'Services',
    clients:    'Clients',
    staff:      'Staff',
    finances:   'Finances',
    analytics:  'Analytics',
    export:     'Export',
    settings:   'Settings',
  },

  topbar: {
    welcomeBack: 'Welcome back,',
    admin:       '👑 Admin',
    staff:       '👷 Staff',
    signOut:     'Sign out',
  },

  status: {
    pending:     'pending',
    in_progress: 'in progress',
    completed:   'completed',
    cancelled:   'cancelled',
  } as Record<string, string>,

  dashboard: {
    title:            'Dashboard',
    subtitle:         'Operational overview',
    totalServices:    'Total Services',
    completed:        'Completed',
    pending:          'Pending',
    activeClients:    'Active Clients',
    allStatuses:      'all statuses combined',
    pctOfTotal:       (n: number) => `${n}% of total services`,
    allClients:       'all registered clients',
    recentServices:   'Recent Services',
    noServices:       'No services yet. Create your first service to get started.',
    colId:            'ID',
    colClient:        'Client',
    colType:          'Type',
    colDate:          'Date',
    colStatus:        'Status',
    colTotal:         'Total',
  },

  settings: {
    language: 'Interface Language',
    languageHint: 'Applies immediately on this device — the menu, top bar and dashboard switch language.',
  },
}

const es: typeof en = {
  locale: 'es-US',

  nav: {
    dashboard:  'Panel',
    aiRequests: 'Solicitudes IA',
    calendar:   'Calendario',
    map:        'Mapa',
    services:   'Servicios',
    clients:    'Clientes',
    staff:      'Personal',
    finances:   'Finanzas',
    analytics:  'Analíticas',
    export:     'Exportar',
    settings:   'Ajustes',
  },

  topbar: {
    welcomeBack: 'Bienvenido de nuevo,',
    admin:       '👑 Admin',
    staff:       '👷 Personal',
    signOut:     'Cerrar sesión',
  },

  status: {
    pending:     'pendiente',
    in_progress: 'en progreso',
    completed:   'completado',
    cancelled:   'cancelado',
  } as Record<string, string>,

  dashboard: {
    title:            'Panel',
    subtitle:         'Resumen operativo',
    totalServices:    'Servicios totales',
    completed:        'Completados',
    pending:          'Pendientes',
    activeClients:    'Clientes activos',
    allStatuses:      'todos los estados combinados',
    pctOfTotal:       (n: number) => `${n}% del total de servicios`,
    allClients:       'todos los clientes registrados',
    recentServices:   'Servicios recientes',
    noServices:       'Aún no hay servicios. Crea el primero para comenzar.',
    colId:            'ID',
    colClient:        'Cliente',
    colType:          'Tipo',
    colDate:          'Fecha',
    colStatus:        'Estado',
    colTotal:         'Total',
  },

  settings: {
    language: 'Idioma de la interfaz',
    languageHint: 'Se aplica al instante en este dispositivo — el menú, la barra superior y el panel cambian de idioma.',
  },
}

export type Dict = typeof en
const DICTS: Record<Lang, Dict> = { en, es }

type I18nCtx = {
  lang: Lang
  t: Dict
  setLang: (l: Lang) => void
}

const Ctx = createContext<I18nCtx>({ lang: 'en', t: en, setLang: () => {} })

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'es') setLangState(saved)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem(LANG_KEY, l)
  }

  return (
    <Ctx.Provider value={{ lang, t: DICTS[lang], setLang }}>
      {children}
    </Ctx.Provider>
  )
}

export function useI18n() {
  return useContext(Ctx)
}
