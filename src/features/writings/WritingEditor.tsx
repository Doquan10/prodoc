import { useEffect, useRef, useState } from 'react'
import type { Writing, DocLink } from '../../types'
import { useWritingStore } from '../../store/useWritingStore'
import { useQueueStore } from '../../store/useQueueStore'
import { useUIStore } from '../../store/useUIStore'
import { useToastStore } from '../../store/useToastStore'
import { stripMarkdown } from '../../utils/markdown'
import RichTextEditor from './RichTextEditor'

interface Props {
  writingId: string
}

/** Şemasız girişe https:// ekler; geçersizse null döner. */
function normalizeUrl(raw: string): string | null {
  let u = raw.trim()
  if (!u) return null
  if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u
  try {
    return new URL(u).href
  } catch {
    return null
  }
}

/** Görünen etiket için ana makineyi (www'siz) döndürür. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function WritingEditor({ writingId }: Props) {
  const writings = useWritingStore(s => s.writings)
  const { getWriting, updateWriting, deleteWriting, loadWriting } = useWritingStore()
  const { getItem } = useQueueStore()
  const { closeWriting, selectItem, openWriting } = useUIStore()
  const showToast = useToastStore(s => s.show)

  const writing = getWriting(writingId)
  const [title, setTitle] = useState(writing?.title ?? '')
  const [content, setContent] = useState(writing?.content ?? '')
  const [saved, setSaved] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [docUrl, setDocUrl] = useState('')
  const [docTitle, setDocTitle] = useState('')

  const draftRef = useRef({ title: writing?.title ?? '', content: writing?.content ?? '' })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function commit() {
    const w = useWritingStore.getState().getWriting(writingId)
    if (!w) return
    const { title, content } = draftRef.current
    const changes: Partial<Pick<Writing, 'title' | 'content'>> = {}
    if (title !== w.title) changes.title = title
    // İçerik yalnızca tam gövde yüklüyken kaydedilir — özet '' gerçek içeriği ezmesin
    if (w.loaded && content !== w.content) changes.content = content
    if (Object.keys(changes).length) updateWriting(writingId, changes)
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

  // Açılışta tam gövdeyi (content + documents) çek — özet listede content yok.
  // loadWriting içeride loaded/uçuş kontrolü yapar; yüklenince store patch'lenir,
  // WritingsView key'i değişir ve bu editör dolu içerikle remount olur.
  useEffect(() => {
    loadWriting(writingId)
  }, [writingId, loadWriting])

  // Unmount'ta bekleyen taslağı kaydet (content yalnızca tam gövde yüklüyse)
  useEffect(() => () => {
    clearTimeout(timer.current)
    const w = useWritingStore.getState().getWriting(writingId)
    if (!w) return
    const changes: Partial<Pick<Writing, 'title' | 'content'>> = {}
    if (draftRef.current.title !== w.title) changes.title = draftRef.current.title
    if (w.loaded && draftRef.current.content !== w.content) changes.content = draftRef.current.content
    if (Object.keys(changes).length) useWritingStore.getState().updateWriting(writingId, changes)
  }, [writingId])

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
  // Özet listeden gelen yazıların tam gövdesi henüz yok (detay endpoint'i bekleniyor):
  // içerik salt-okunur gösterilir, kayıt (content/documents) devre dışıdır.
  const loaded = writing.loaded ?? false

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
    openWriting(id)
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

  // ── Dökümanlar (sıralı bağlantılar) ─────────
  const documents = writing.documents ?? []

  function persistDocs(next: DocLink[]) {
    updateWriting(writingId, { documents: next })
  }

  function addDoc() {
    const url = normalizeUrl(docUrl)
    if (!url) {
      showToast('Geçerli bir bağlantı gir', 'error')
      return
    }
    persistDocs([...documents, { id: crypto.randomUUID(), url, title: docTitle.trim() || undefined }])
    setDocUrl('')
    setDocTitle('')
  }

  function removeDoc(id: string) {
    persistDocs(documents.filter(d => d.id !== id))
  }

  function moveDoc(id: string, dir: -1 | 1) {
    const i = documents.findIndex(d => d.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= documents.length) return
    const next = [...documents]
    ;[next[i], next[j]] = [next[j], next[i]]
    persistDocs(next)
  }

  function handleDelete() {
    if (!confirm('Bu yazıyı silmek istiyor musun?')) return
    clearTimeout(timer.current)
    draftRef.current = { title: writing?.title ?? '', content: writing?.content ?? '' }
    const parentId = writing?.parentId
    deleteWriting(writingId)
    if (parentId) openWriting(parentId)
    else closeWriting()
  }

  return (
    <div className="view-container writing-editor wide">
      {/* Üst bar */}
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

      <div className="writing-layout">
        <div className="writing-main">
      <input
        className="writing-title-input"
        placeholder="Yazı başlığı…"
        value={title}
        onChange={e => handleChange({ title: e.target.value })}
      />

      {loaded ? (
        <RichTextEditor
          value={writing.content ?? ''}
          onChange={md => handleChange({ content: md })}
          onBlur={commit}
          placeholder={'Blog yazıyormuş gibi anlat…  "/" ile blok ekle (başlık, liste, yapılacak, kod…)'}
        />
      ) : (
        <div className="writing-unloaded">
          <p className="writing-unloaded-note">İçerik yükleniyor…</p>
          {writing.excerpt && (
            <p className="writing-unloaded-excerpt">{stripMarkdown(writing.excerpt)}…</p>
          )}
        </div>
      )}

      <div className="writing-editor-footer">
        <span className={`notes-status ${saved ? '' : 'pending'}`}>
          {saved ? 'kaydedildi ✓' : 'yazılıyor…'}
        </span>
        <span>{loaded ? `${wordCount} kelime · yazdıkça biçimlenir` : 'içerik salt-okunur'}</span>
      </div>
        </div>

        {/* Dökümanlar — sıralı referans bağlantıları */}
        <aside className="writing-docs">
          <div className="writing-docs-head">
            <span className="writing-docs-title">Dökümanlar</span>
            {loaded && documents.length > 0 && <span className="fin-count">{documents.length}</span>}
          </div>

          {!loaded ? (
            <p className="writing-docs-empty">
              {writing.hasDocuments
                ? 'Dökümanlar yazının tam içeriği yüklenince görünür.'
                : 'Döküman yok.'}
            </p>
          ) : documents.length === 0 ? (
            <p className="writing-docs-empty">Henüz bağlantı yok. Aşağıdan sırayla ekle.</p>
          ) : (
            <ol className="writing-docs-list">
              {documents.map((d, i) => (
                <li key={d.id} className="writing-doc">
                  <span className="writing-doc-index">{i + 1}</span>
                  <a className="writing-doc-link" href={d.url} target="_blank" rel="noopener noreferrer" title={d.url}>
                    <span className="writing-doc-name">{d.title?.trim() || hostOf(d.url)}</span>
                    <span className="writing-doc-host">{hostOf(d.url)}</span>
                  </a>
                  <div className="writing-doc-actions">
                    <button title="Yukarı" disabled={i === 0} onClick={() => moveDoc(d.id, -1)}>↑</button>
                    <button title="Aşağı" disabled={i === documents.length - 1} onClick={() => moveDoc(d.id, 1)}>↓</button>
                    <button title="Kaldır" className="danger" onClick={() => removeDoc(d.id)}>×</button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {loaded && (
          <div className="writing-docs-form">
            <input
              className="input"
              placeholder="Bağlantı (https://…)"
              value={docUrl}
              onChange={e => setDocUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDoc() } }}
            />
            <input
              className="input"
              placeholder="Başlık (opsiyonel)"
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDoc() } }}
            />
            <button className="btn btn-primary" onClick={addDoc} disabled={!docUrl.trim()}>
              + Ekle
            </button>
          </div>
          )}
        </aside>
      </div>
    </div>
  )
}
