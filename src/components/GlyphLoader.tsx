import { motion } from 'framer-motion'
import { t, useLang } from '../lib/i18n'

export function GlyphLoader({ text }: { text?: string }) {
  useLang()
  const label = text ?? t('app.loading')
  const bars = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <div className="row" style={{ gap: 14 }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 26 }}>
        {bars.map((i) => (
          <motion.div
            key={i}
            style={{ width: 6, borderRadius: 3, background: i === 3 ? 'var(--red)' : 'var(--txt)' }}
            animate={{ height: [6, 26, 10, 22, 6] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.09, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <span style={{ fontFamily: 'var(--font-dot)', letterSpacing: 3, fontSize: 13, color: 'var(--dim)' }}>{label}</span>
    </div>
  )
}
