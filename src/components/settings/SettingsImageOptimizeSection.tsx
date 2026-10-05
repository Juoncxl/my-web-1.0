import React, { useState } from 'react';
import { ImageDown } from 'lucide-react';
import { cxlDataService } from '../../data/cxlDataService';
import { optimizeWorkImages, type OptimizeWorkResult } from '../../lib/optimizeWorkImages';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Owner-only: shrink the large images of existing Works (old files stay in Drive). */
export const SettingsImageOptimizeSection: React.FC<{ ownerId: string }> = ({ ownerId }) => {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<OptimizeWorkResult[]>([]);

  const run = async (mode: 'one' | 'all') => {
    setRunning(true); setResults([]); setStatus('กำลังโหลดรายการผลงาน…');
    try {
      const list = await cxlDataService.works.fetch({ userId: ownerId, detail: 'summary', limit: 500 });
      if (list.error) throw new Error(list.error);
      const works = (list.data || []).filter(work => work.userId === ownerId && !work.deletedAt && work.category !== 'collab');
      const done: OptimizeWorkResult[] = [];
      for (let index = 0; index < works.length; index += 1) {
        setStatus(`กำลังตรวจผลงาน ${index + 1}/${works.length}: ${works[index].title || works[index].id}`);
        const result = await optimizeWorkImages(works[index].id, {
          fetchFullWork: async id => (await cxlDataService.works.fetch({ assetId: id, currentUserId: ownerId, detail: 'full', limit: 1 })).data?.[0] || null,
          updateWork: (id, updates, options) => cxlDataService.works.update(id, updates, options),
          download: async url => {
            const response = await fetch(url, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`โหลดรูปไม่สำเร็จ (${response.status})`);
            return response.blob();
          }
        });
        if (result.optimized || result.error) { done.push(result); setResults([...done]); }
        if (mode === 'one' && result.optimized) break;
      }
      const saved = done.reduce((sum, item) => sum + item.bytesBefore - item.bytesAfter, 0);
      const failed = done.filter(item => item.error).length;
      setStatus(done.some(item => item.optimized)
        ? `เสร็จแล้ว ย่อรูปใน ${done.filter(item => item.optimized).length} ผลงาน ลดลง ${mb(saved)}${failed ? ` · มี ${failed} ผลงานที่ไม่สำเร็จ กดอีกครั้งเพื่อลองใหม่ได้` : ''}`
        : failed ? `ไม่สำเร็จ ${failed} ผลงาน กดอีกครั้งเพื่อลองใหม่ได้` : 'ไม่มีรูปที่ต้องย่อแล้ว ทุกรูปเล็กพออยู่แล้ว');
      window.dispatchEvent(new CustomEvent('creator-vault-cloud-data-changed'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'ย่อรูปไม่สำเร็จ');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="cv-settings-card">
      <div className="cv-settings-card-heading"><div>
        <h3><ImageDown className="cv-settings-inline-icon" />ย่อรูปเก่าให้เล็กลง</h3>
        <p>ย่อรูปขนาดใหญ่ในผลงานเก่า (ไม่รวมงานคอลแลป) ให้เหมือนรูปที่อัปใหม่ เว็บจะโหลดเร็วขึ้นและใช้โควตาน้อยลง</p>
        <p><strong>ไฟล์เดิมไม่ถูกลบ</strong> ยังอยู่ใน Google Drive ครบ แนะนำให้กด "ลองกับ 1 ผลงาน" แล้วเปิดดูก่อนว่ารูปขึ้นปกติ</p>
      </div></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="cv-settings-primary-button" disabled={running} onClick={() => void run('one')}>ลองกับ 1 ผลงาน</button>
        <button type="button" className="cv-settings-primary-button" disabled={running} onClick={() => void run('all')}>ย่อทั้งหมด</button>
      </div>
      {status && <p role="status" className="mt-3 text-sm">{status}</p>}
      {results.length > 0 && <ul className="mt-2 text-sm list-disc pl-5">{results.map(item => (
        <li key={item.workId}>{item.title}: {item.error ? `ไม่สำเร็จ (${item.error})` : `ย่อ ${item.optimized} รูป ${mb(item.bytesBefore)} → ${mb(item.bytesAfter)}`}</li>
      ))}</ul>}
    </section>
  );
};
