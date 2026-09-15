import { call } from '../lib/ipc'

export function TitleBar() {
  return (
    <div className="titlebar">
      <div className="brand">NEMO</div>
      <div className="win-btns">
        <button onClick={() => call('window:minimize')}>—</button>
        <button onClick={() => call('window:maximize')}>▢</button>
        <button onClick={() => call('window:close')} style={{ borderColor: '#5a1113' }}>✕</button>
      </div>
    </div>
  )
}
