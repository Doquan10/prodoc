import { useWritingStore } from '../../store/useWritingStore'
import { useUIStore } from '../../store/useUIStore'
import WritingEditor from './WritingEditor'
import WritingsBrowser from './WritingsBrowser'

export default function WritingsView() {
  const selectedWritingId = useUIStore(s => s.selectedWritingId)
  const getWriting = useWritingStore(s => s.getWriting)

  if (selectedWritingId) {
    const w = getWriting(selectedWritingId)
    // Yazı → markdown editör; kategori (veya bulunamadı) → klasör görünümü
    // key: seçim değişince ilgili bileşenin iç state'i sıfırlansın
    if (w?.kind === 'note') {
      return <WritingEditor key={selectedWritingId} writingId={selectedWritingId} />
    }
    return <WritingsBrowser key={selectedWritingId} parentId={selectedWritingId} />
  }

  return <WritingsBrowser parentId={null} />
}
