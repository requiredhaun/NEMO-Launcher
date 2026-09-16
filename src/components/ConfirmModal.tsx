import { AnimatePresence, motion } from 'framer-motion'
import { t, useLang } from '../lib/i18n'

export interface ConfirmProps {
  open: boolean
  title: string
  text: string
  okLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onOk: () => void
  onCancel: () => void
}

/** Модалка подтверждения в дизайне лаунчера вместо системного confirm(). */
export function ConfirmModal({ open, title, text, okLabel, cancelLabel, danger, busy, onOk, onCancel }: ConfirmProps) {
  useLang()
  const ok = okLabel ?? t('modal.ok')
  const cancel = cancelLabel ?? t('modal.cancel')
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => { if (!busy) onCancel() }}
        >
          <motion.div
            className={'modal-card' + (danger ? ' danger' : '')}
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">{title}</div>
            <div className="sub" style={{ margin: '8px 0 0', lineHeight: 1.6 }}>{text}</div>
            <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
              <button className="btn ghost" disabled={busy} onClick={onCancel}>{cancel}</button>
              <button className={'btn' + (danger ? ' danger-btn' : ' play')} style={danger ? {} : { padding: '11px 26px', fontSize: 14 }} disabled={busy} onClick={onOk}>
                {busy ? t('modal.working') : ok}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
