import { useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import Modal from '../../common/Modal'
import Input from '../../common/Input'
import Button from '../../common/Button'
import { todayStr } from '../../utils/format'
import type { NewExpense, Expense } from '../../types/finance'

// expenseChannel enum'u backend'de tanımlı — varsayılan eşleme (gerekirse düzelt)
const CHANNELS = [
  { id: 1, label: 'Nakit' },
  { id: 2, label: 'Kredi Kartı' },
  { id: 3, label: 'Banka Kartı' },
]

/** "2026-08-01" seçili günü, o anki saatle birleştirip ISO string üretir. */
function toIso(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const now = new Date()
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString()
}

/** ISO tarihi <input type="date"> için "YYYY-MM-DD"ye indirger. */
function toDateInput(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? todayStr() : iso.slice(0, 10)
}

/** Add-mode ön-doldurma — hızlı ekle chip'i ya da takvimde bir güne ekle. */
export interface ExpensePreset {
  name?: string
  categoryId?: number
  amount?: number
  date?: string
}

export default function ExpenseFormModal({ onClose, expense, preset }: { onClose: () => void; expense?: Expense; preset?: ExpensePreset }) {
  const isEdit = !!expense
  const categories = useFinanceStore(s => s.categories)
  const adding = useFinanceStore(s => s.addingExpense)
  const updating = useFinanceStore(s => s.updatingExpense)
  const addExpense = useFinanceStore(s => s.addExpense)
  const updateExpense = useFinanceStore(s => s.updateExpense)
  const filter = useFinanceStore(s => s.expenseFilter)

  const busy = adding || updating

  const [name, setName] = useState(expense?.name ?? preset?.name ?? '')
  const [amount, setAmount] = useState(
    expense ? String(expense.amount) : preset?.amount != null ? String(preset.amount) : '',
  )
  const [categoryId, setCategoryId] = useState<number | ''>(
    expense?.categoryId ?? preset?.categoryId ?? filter.categoryId ?? '',
  )
  const [date, setDate] = useState(
    expense ? toDateInput(expense.expenseDate) : preset?.date ?? todayStr(),
  )
  const [description, setDescription] = useState(expense?.description ?? '')
  // expenseChannel / reduceMyBalance ExpenseViewModel'de yok — düzenlemede varsayılandan başlar
  const [channel, setChannel] = useState(1)
  const [reduceMyBalance, setReduceMyBalance] = useState(false)
  const [touched, setTouched] = useState(false)

  const amountNum = Number(amount.replace(',', '.'))
  const valid = name.trim() !== '' && categoryId !== '' && amount !== '' && amountNum > 0

  const submit = async () => {
    setTouched(true)
    if (!valid || busy) return
    const payload: NewExpense = {
      name: name.trim(),
      description: description.trim() || null,
      amount: amountNum,
      categoryId: Number(categoryId),
      reduceMyBalance,
      expenseChannel: channel,
      expenseDate: toIso(date),
    }
    const ok = isEdit
      ? await updateExpense({ ...payload, id: expense!.id })
      : await addExpense(payload)
    if (ok) onClose()
  }

  return (
    <Modal title={isEdit ? 'Harcama Düzenle' : 'Harcama Ekle'} onClose={onClose}>
      <div className="fin-expense-form">
        <Input
          label="Başlık"
          placeholder="Örn. Market"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        {touched && name.trim() === '' && <span className="fin-form-err">Başlık gerekli.</span>}

        <div className="fin-form-row">
          <Input
            label="Tutar (₺)"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <div className="input-wrapper">
            <label className="input-label">Tarih</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>
        {touched && amount !== '' && amountNum <= 0 && (
          <span className="fin-form-err">Tutar 0'dan büyük olmalı.</span>
        )}

        <div className="fin-form-row">
          <div className="input-wrapper">
            <label className="input-label">Kategori</label>
            <select
              className="fin-form-select"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Seç…</option>
              {(categories ?? []).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="input-wrapper">
            <label className="input-label">Kanal</label>
            <select
              className="fin-form-select"
              value={channel}
              onChange={e => setChannel(Number(e.target.value))}
            >
              {CHANNELS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        {touched && categoryId === '' && <span className="fin-form-err">Kategori seç.</span>}

        <Input
          label="Açıklama (opsiyonel)"
          placeholder="Örn. Tereyağı, peynir"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <label className="fin-form-check">
          <input
            type="checkbox"
            checked={reduceMyBalance}
            onChange={e => setReduceMyBalance(e.target.checked)}
          />
          Bakiyemden düş
        </label>

        <div className="fin-form-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Vazgeç</Button>
          <Button onClick={() => void submit()} disabled={busy || (touched && !valid)}>
            {busy
              ? (isEdit ? 'Kaydediliyor…' : 'Ekleniyor…')
              : (isEdit ? 'Kaydet' : 'Ekle')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
