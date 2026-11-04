import type { Account } from '../../db/schema'
import { formatMoney } from '../../lib/format'
import { inputClass } from './form'

export function AccountSelect({ accounts, value, onChange }: { accounts: Account[]; value: string; onChange: (id: string) => void }) {
  return (
    <select aria-label="Счёт" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>{a.name} — {formatMoney(a.currentBalance, a.currency)}</option>
      ))}
    </select>
  )
}
