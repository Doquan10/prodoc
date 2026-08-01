import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ChangeEvent as ReactChangeEvent } from 'react'
import type { Writing } from '../../types'
import { useWritingStore } from '../../store/useWritingStore'
import { useQueueStore } from '../../store/useQueueStore'
import { useUIStore } from '../../store/useUIStore'
import { useToastStore } from '../../store/useToastStore'
import { renderMarkdown, TEXT_COLORS } from '../../utils/markdown'
import { dayOf, formatDate } from '../../utils/format'
import { getCaretCoords } from '../../utils/caret'

interface Props {
  writingId: string
}

interface SlashOption {
  id: string
  icon: string
  label: string
  desc: string
  type: 'prefix' | 'insert'
  text: string
  caretOffset?: number
  keywords: string[]
}

/** "/" ile açılan blok menüsü seçenekleri. */
const SLASH_OPTIONS: SlashOption[] = [
  { id: 'h1', icon: 'H₁', label: 'Başlık 1', desc: 'Büyük bölüm başlığı', type: 'prefix', text: '# ', keywords: ['baslik', 'başlık', 'h1', 'heading', 'title'] },
  { id: 'h2', icon: 'H₂', label: 'Başlık 2', desc: 'Orta başlık', type: 'prefix', text: '## ', keywords: ['baslik', 'başlık', 'h2'] },
  { id: 'h3', icon: 'H₃', label: 'Başlık 3', desc: 'Küçük başlık', type: 'prefix', text: '### ', keywords: ['baslik', 'başlık', 'h3'] },
  { id: 'ul', icon: '•', label: 'Madde listesi', desc: 'Sırasız liste', type: 'prefix', text: '- ', keywords: ['liste', 'madde', 'bullet', 'ul'] },
  { id: 'ol', icon: '1.', label: 'Numaralı liste', desc: 'Sıralı liste', type: 'prefix', text: '1. ', keywords: ['liste', 'numara', 'sirali', 'sıralı', 'ol', 'number'] },
  { id: 'todo', icon: '☐', label: 'Yapılacak', desc: 'Onay kutulu görev', type: 'prefix', text: '- [ ] ', keywords: ['todo', 'yapilacak', 'yapılacak', 'gorev', 'görev', 'task', 'checkbox', 'onay'] },
  { id: 'quote', icon: '❝', label: 'Alıntı', desc: 'Alıntı bloğu', type: 'prefix', text: '> ', keywords: ['alinti', 'alıntı', 'quote', 'blok'] },
  { id: 'code', icon: '</>', label: 'Kod bloğu', desc: 'Tek aralıklı kod', type: 'insert', text: '```\n\n```', caretOffset: 4, keywords: ['kod', 'code', 'blok'] },
  { id: 'hr', icon: '—', label: 'Ayraç', desc: 'Yatay çizgi', type: 'insert', text: '---\n', keywords: ['ayrac', 'ayraç', 'cizgi', 'çizgi', 'divider', 'hr'] },
]

/** İmleç bir liste/alıntı satırının sonundaysa, sonraki satırın işaretçisini üretir. */
function listContinuation(line: string): { marker: string; isEmpty: boolean } | null {
  let m
  if ((m = line.match(/^(\s*)[-*]\s+\[[ xX]\]\s+(.*)$/)))
    return { marker: m[1] + '- [ ] ', isEmpty: !m[2].trim() }
  if ((m = line.match(/^(\s*)([-*])\s+(.*)$/)))
    return { marker: m[1] + m[2] + ' ', isEmpty: !m[3].trim() }
  if ((m = line.match(/^(\s*)(\d+)\.\s+(.*)$/)))
    return { marker: m[1] + (parseInt(m[2]) + 1) + '. ', isEmpty: !m[3].trim() }
  if ((m = line.match(/^(\s*)>\s?(.*)$/)))
    return { marker: m[1] + '> ', isEmpty: !m[2].trim() }
  return null
}

/** İmlecin hemen solunda "/sorgu" var mı? Varsa slash menüsü için konum + sorgu. */
function detectSlash(text: string, caret: number): { slashPos: number; query: string } | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1
  const seg = text.slice(lineStart, caret)
  const m = seg.match(/(?:^|\s)\/(\S*)$/)
  if (!m) return null
  const query = m[1]
  return { slashPos: caret - query.length - 1, query }
}

export default function WritingEditor({ writingId }: Props) {
  const writings = useWritingStore(s => s.writings)
  const { getWriting, updateWriting, deleteWriting } = useWritingStore()
  const { getItem } = useQueueStore()
  const { closeWriting, selectItem, openWriting } = useUIStore()
  const showToast = useToastStore(s => s.show)

  const writing = getWriting(writingId)
  const [title, setTitle] = useState(writing?.title ?? '')
  const [content, setContent] = useState(writing?.content ?? '')
  // 'split' varsayılan — yazarken renk/liste biçimi sağda canlı görünür
  const [mode, setMode] = useState<'write' | 'split' | 'preview'>('split')
  const [saved, setSaved] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [slash, setSlash] = useState<{ slashPos: number; query: string; top: number; left: number } | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)

  const draftRef = useRef({ title, content })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  function commit() {
    const w = useWritingStore.getState().getWriting(writingId)
    if (!w) return
    const { title, content } = draftRef.current
    if (title === w.title && content === w.content) return
    updateWriting(writingId, { title, content })
  }

  function handleChange(changes: Partial<{ title: string; content: string }>) {
    if (changes.title !== undefined) setTitle(changes.title)
    if (changes.content !== undefined) setContent(changes.content)
    draftRef.current = { ...draftRef.current, ...changes }
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      commit()
      setSaved(true)
    }, 600)
  }

  // Unmount'ta bekleyen taslağı kaydet
  useEffect(() => () => {
    clearTimeout(timer.current)
    const w = useWritingStore.getState().getWriting(writingId)
    if (w && (draftRef.current.title !== w.title || draftRef.current.content !== w.content)) {
      useWritingStore.getState().updateWriting(writingId, draftRef.current)
    }
  }, [writingId])

  /** Seçili metni before/after ile sarar; seçim yoksa placeholder ekler. */
  function applyInline(before: string, after: string, placeholder: string) {
    const ta = contentRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = content.slice(start, end) || placeholder
    const next = content.slice(0, start) + before + sel + after + content.slice(end)
    handleChange({ content: next })
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + sel.length)
    })
  }

  /** Seçimin kapsadığı satırların başına liste/alıntı/başlık öneki ekler. */
  function applyLinePrefix(prefix: string, numbered = false) {
    const ta = contentRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const lineStart = content.lastIndexOf('\n', start - 1) + 1
    const lineEndIdx = content.indexOf('\n', end)
    const lineEnd = lineEndIdx === -1 ? content.length : lineEndIdx
    const lines = content.slice(lineStart, lineEnd).split('\n')
    const prefixed = lines
      .map((l, i) => (l.trim() || lines.length === 1 ? (numbered ? `${i + 1}. ` : prefix) + l : l))
      .join('\n')
    const next = content.slice(0, lineStart) + prefixed + content.slice(lineEnd)
    handleChange({ content: next })
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(lineStart, lineStart + prefixed.length)
    })
  }

  function closeSlash() { setSlash(null) }

  /** İçerik değişince taslağı işler ve slash menüsünü günceller. */
  function handleContentChange(value: string, caret: number) {
    handleChange({ content: value })
    const info = detectSlash(value, caret)
    if (info && contentRef.current) {
      const c = getCaretCoords(contentRef.current, info.slashPos)
      setSlash({ slashPos: info.slashPos, query: info.query, top: c.top + c.height + 4, left: c.left })
      setSlashIndex(0)
    } else if (slash) {
      closeSlash()
    }
  }

  /** Slash menüsünden seçilen bloğu imlecin bulunduğu satıra uygular. */
  function applyBlock(opt: SlashOption) {
    const ta = contentRef.current
    if (!ta || !slash) return
    const caret = ta.selectionStart
    const from = slash.slashPos
    const withoutSlash = content.slice(0, from) + content.slice(caret)
    let next: string
    let newCaret: number
    if (opt.type === 'prefix') {
      const ls = withoutSlash.lastIndexOf('\n', from - 1) + 1
      next = withoutSlash.slice(0, ls) + opt.text + withoutSlash.slice(ls)
      newCaret = ls + opt.text.length
    } else {
      next = withoutSlash.slice(0, from) + opt.text + withoutSlash.slice(from)
      newCaret = from + (opt.caretOffset ?? opt.text.length)
    }
    closeSlash()
    handleChange({ content: next })
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(newCaret, newCaret)
    })
  }

  /** Enter'a basılınca liste/alıntı satırını otomatik sürdürür veya boşsa çıkar. */
  function maybeContinueList(): boolean {
    const ta = contentRef.current
    if (!ta || ta.selectionStart !== ta.selectionEnd) return false
    const caret = ta.selectionStart
    const ls = content.lastIndexOf('\n', caret - 1) + 1
    const leIdx = content.indexOf('\n', caret)
    const le = leIdx === -1 ? content.length : leIdx
    if (caret !== le) return false // yalnızca satır sonunda
    const cont = listContinuation(content.slice(ls, le))
    if (!cont) return false
    let next: string
    let newCaret: number
    if (cont.isEmpty) {
      next = content.slice(0, ls) + content.slice(le) // işaretçiyi sil, listeden çık
      newCaret = ls
    } else {
      next = content.slice(0, caret) + '\n' + cont.marker + content.slice(caret)
      newCaret = caret + 1 + cont.marker.length
    }
    handleChange({ content: next })
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(newCaret, newCaret)
    })
    return true
  }

  function handleContentKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (slash && slashFiltered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => (i + 1) % slashFiltered.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(i => (i - 1 + slashFiltered.length) % slashFiltered.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applyBlock(slashFiltered[Math.min(slashIndex, slashFiltered.length - 1)])
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && maybeContinueList()) {
      e.preventDefault()
    }
  }

  /** Önizleme/canlı panelde onay kutusuna tıklayınca kaynaktaki [ ] ↔ [x] değişir. */
  function handleTaskToggle(e: ReactChangeEvent<HTMLDivElement>) {
    const target = e.target as HTMLInputElement
    const attr = target.dataset?.taskLine
    if (attr === undefined) return
    const lineIndex = parseInt(attr)
    const lines = content.split('\n')
    const l = lines[lineIndex]
    if (l === undefined) return
    lines[lineIndex] = l.replace(/^(\s*[-*]\s+\[)([ xX])(\])/, (_m, a, c, b) => a + (c.toLowerCase() === 'x' ? ' ' : 'x') + b)
    handleChange({ content: lines.join('\n') })
  }

  const slashFiltered = slash
    ? SLASH_OPTIONS.filter(o => {
        const q = slash.query.toLocaleLowerCase('tr')
        return !q || o.label.toLocaleLowerCase('tr').includes(q) || o.keywords.some(k => k.includes(q))
      })
    : []

  if (!writing) {
    return (
      <div className="view-container">
        <div className="empty-state" style={{ marginTop: 80 }}>
          <p>Yazı bulunamadı.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={closeWriting}>
            ← Yazılarım
          </button>
        </div>
      </div>
    )
  }

  const item = writing.itemId ? getItem(writing.itemId) : undefined
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  // Kök → ... → üst sayfa zinciri (döngüye karşı korumalı)
  const crumbs: Writing[] = []
  {
    const seen = new Set<string>([writing.id])
    let cur: Writing | undefined = writing
    while (cur?.parentId && !seen.has(cur.parentId)) {
      seen.add(cur.parentId)
      cur = writings.find(w => w.id === cur!.parentId)
      if (cur) crumbs.unshift(cur)
    }
  }

  function goTo(id: string) {
    commit()
    openWriting(id) // WritingsView'daki key remount ile editör state'i sıfırlanır
  }

  function shareText() {
    const t = draftRef.current.title.trim()
    const c = draftRef.current.content
    return t ? `# ${t}\n\n${c}` : c
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText())
      showToast('Yazı panoya kopyalandı')
    } catch {
      showToast('Kopyalama başarısız', 'error')
    }
    setShareOpen(false)
  }

  function handleDownload() {
    const name = (draftRef.current.title.trim() || 'yazi')
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]+/gi, '-')
      .replace(/^-+|-+$/g, '')
    const blob = new Blob([shareText()], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name || 'yazi'}.md`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Markdown dosyası indirildi')
    setShareOpen(false)
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title: draftRef.current.title || 'Yazım', text: shareText() })
    } catch {
      // kullanıcı iptal etti — sessiz geç
    }
    setShareOpen(false)
  }

  function handleDelete() {
    if (!confirm('Bu yazıyı silmek istiyor musun?')) return
    clearTimeout(timer.current)
    draftRef.current = { title: writing?.title ?? '', content: writing?.content ?? '' } // unmount flush'ı yazmasın
    const parentId = writing?.parentId
    deleteWriting(writingId)
    if (parentId) openWriting(parentId)
    else closeWriting()
  }

  return (
    <div className={`view-container writing-editor ${mode === 'split' ? 'wide' : ''}`}>
      {/* Üst bar — Notion tarzı breadcrumb: Yazılarım / kategori / ... / bu sayfa */}
      <div className="writing-editor-top">
        <nav className="writing-crumbs">
          <button className="writing-crumb" onClick={() => { commit(); closeWriting() }}>
            Yazılarım
          </button>
          {crumbs.map(c => (
            <span key={c.id} className="writing-crumb-pair">
              <span className="writing-crumb-sep">/</span>
              <button className="writing-crumb" onClick={() => goTo(c.id)}>
                {c.title.trim() || 'Başlıksız'}
              </button>
            </span>
          ))}
          <span className="writing-crumb-sep">/</span>
          <span className="writing-crumb current">{title.trim() || 'Başlıksız'}</span>
        </nav>
        <div className="writing-editor-actions">
          <div className="writing-tabs">
            {([
              { value: 'write', label: '✎ Yaz' },
              { value: 'split', label: '◧ Canlı' },
              { value: 'preview', label: '◉ Önizle' },
            ] as const).map(t => (
              <button
                key={t.value}
                className={`writing-tab ${mode === t.value ? 'active' : ''}`}
                onClick={() => { commit(); setMode(t.value) }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="share-menu-wrap">
            <button className="btn btn-primary" onClick={() => setShareOpen(v => !v)}>
              ↗ Paylaş
            </button>
            {shareOpen && (
              <div className="share-menu">
                <button onClick={handleCopy}>⧉ Panoya Kopyala</button>
                <button onClick={handleDownload}>↓ .md Olarak İndir</button>
                {typeof navigator.share === 'function' && (
                  <button onClick={handleNativeShare}>↗ Cihazla Paylaş…</button>
                )}
              </div>
            )}
          </div>
          <button className="btn btn-ghost" style={{ color: 'var(--err)' }} onClick={handleDelete}>
            Sil
          </button>
        </div>
      </div>

      {/* Bağlı konu */}
      {item && (
        <button className="writing-item-link" onClick={() => selectItem(item.id)}>
          ◈ {item.question}
        </button>
      )}

      {mode === 'preview' ? (
        <article className="writing-preview markdown-body" onChange={handleTaskToggle}>
          <h1 className="writing-preview-title">{title || 'Başlıksız'}</h1>
          <p className="writing-preview-meta">
            {formatDate(dayOf(writing.createdAt))} · {wordCount} kelime
          </p>
          {content.trim()
            ? renderMarkdown(content, true)
            : <p style={{ color: 'var(--tx-3)' }}>Henüz içerik yok.</p>}
        </article>
      ) : (
        <>
          <input
            className="writing-title-input"
            placeholder="Yazı başlığı…"
            value={title}
            onChange={e => handleChange({ title: e.target.value })}
          />
          <div className="writing-toolbar">
            <button title="Kalın" style={{ fontWeight: 700 }} onClick={() => applyInline('**', '**', 'kalın')}>B</button>
            <button title="İtalik" style={{ fontStyle: 'italic' }} onClick={() => applyInline('*', '*', 'italik')}>I</button>
            <button title="Kod" onClick={() => applyInline('`', '`', 'kod')}>{'</>'}</button>
            <button title="Başlık" onClick={() => applyLinePrefix('## ')}>H</button>
            <span className="writing-toolbar-sep" />
            <button title="Madde listesi" onClick={() => applyLinePrefix('- ')}>•≡</button>
            <button title="Numaralı liste" onClick={() => applyLinePrefix('', true)}>1≡</button>
            <button title="Yapılacak (onay kutusu)" onClick={() => applyLinePrefix('- [ ] ')}>☑</button>
            <button title="Alıntı" onClick={() => applyLinePrefix('> ')}>❝</button>
            <span className="writing-toolbar-sep" />
            {TEXT_COLORS.map(c => (
              <button
                key={c.name}
                className="writing-color-swatch"
                title={`${c.name} yazı`}
                style={{ background: c.value }}
                onClick={() => applyInline(`{${c.name}|`, '}', 'renkli metin')}
              />
            ))}
          </div>
          <div className={`writing-edit-area ${mode === 'split' ? 'split' : ''}`}>
            <textarea
              ref={contentRef}
              className="writing-content-input"
              placeholder={'Blog yazıyormuş gibi anlat…\n\n"/" ile blok ekle (başlık, liste, yapılacak, kod…)\nMarkdown: # başlık, **kalın**, *italik*, `kod`, - liste, > alıntı, {kırmızı|renkli yazı}'}
              value={content}
              onChange={e => handleContentChange(e.target.value, e.target.selectionStart)}
              onKeyDown={handleContentKeyDown}
              onBlur={closeSlash}
              autoFocus
            />
            {slash && slashFiltered.length > 0 && (
              <div className="slash-menu" style={{ top: slash.top, left: slash.left }}>
                {slashFiltered.map((o, idx) => (
                  <button
                    key={o.id}
                    className={`slash-item${idx === slashIndex ? ' active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyBlock(o) }}
                    onMouseEnter={() => setSlashIndex(idx)}
                  >
                    <span className="slash-icon">{o.icon}</span>
                    <span className="slash-text">
                      <span className="slash-label">{o.label}</span>
                      <span className="slash-desc">{o.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {mode === 'split' && (
              <div className="writing-live-pane markdown-body" onChange={handleTaskToggle}>
                {content.trim()
                  ? renderMarkdown(content, true)
                  : <p style={{ color: 'var(--tx-3)' }}>Yazdıkça burada biçimli halini göreceksin.</p>}
              </div>
            )}
          </div>
          <div className="writing-editor-footer">
            <span className={`notes-status ${saved ? '' : 'pending'}`}>
              {saved ? 'kaydedildi ✓' : 'yazılıyor…'}
            </span>
            <span>{wordCount} kelime · markdown destekli</span>
          </div>
        </>
      )}
    </div>
  )
}
