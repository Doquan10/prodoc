import { useWritingStore } from '../../store/useWritingStore'
import { useUIStore } from '../../store/useUIStore'
import WritingEditor from './WritingEditor'
import WritingsBrowser from './WritingsBrowser'

export default function WritingsView() {
  const selectedWritingId = useUIStore(s => s.selectedWritingId)
  // getWriting yerine doğrudan abone ol: detay (loaded) gelince yeniden render olsun
  const w = useWritingStore(s => (selectedWritingId ? s.writings.find(x => x.id === selectedWritingId) : undefined))

  if (selectedWritingId) {
    // Yazı → markdown editör; kategori (veya bulunamadı) → klasör görünümü
    if (w?.kind === 'note') {
      // key'e loaded'ı da kat: özet → tam gövde geçişinde editör remount olup
      // içeriğini dolu content'ten yeniden başlatsın (boş taslak gerçek içeriği ezmesin)
      return (
        <WritingEditor
          key={`${selectedWritingId}:${w.loaded ? 'full' : 'lite'}`}
          writingId={selectedWritingId}
        />
      )
    }
    return <WritingsBrowser key={selectedWritingId} parentId={selectedWritingId} />
  }

  return <WritingsBrowser parentId={null} />
}
