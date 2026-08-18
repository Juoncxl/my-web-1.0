import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  Wand2,
  RefreshCw,
  PlusCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
  initialContext?: string;
  onApplyResult?: (text: string) => void;
}

const PRESET_PROMPT_IDEAS = [
  {
    title: '🌟 แต่ง System Prompt บอท',
    desc: 'ขัดเกลาคำสั่งให้บอทพูดจาเป็นธรรมชาติ ไม่หลุดคาร์ และเข้าใจภาษาไทยลึกซึ้ง',
    prompt: 'ช่วยเขียน Master System Prompt สำหรับบอทแชทภาษาไทยสมจริง ที่มีบุคลิกอบอุ่น แต่ขี้บ่นนิดๆ พร้อมกฎการตอบโต้ที่ไม่หลุดบทบาท'
  },
  {
    title: '💬 สร้างบทพูดทักทายแรก (First Message)',
    desc: 'เขียน First Message เปิดฉากที่น่าประทับใจและมีมิติอารมณ์',
    prompt: 'ช่วยเขียนประโยคทักทายแรก (First Message) พร้อมการบรรยายภาษากาย *...* สำหรับตัวละคร AI เพื่อนสนิทที่เจอกันในร้านกาแฟยามค่ำคืน'
  },
  {
    title: '📖 ขยายโลกทัศน์ & กฎเวทมนตร์ (Lore)',
    desc: 'สร้าง Worldbuilding และประวัติศาสตร์ที่น่าติดตาม',
    prompt: 'ช่วยสร้าง Lore และกฎเวทมนตร์สำหรับโลกแฟนตาซีโบราณ ที่ผู้คนใช้พลังจากดวงดาวและหินผลึกในการขับเคลื่อนเมือง'
  },
  {
    title: '🎨 สร้าง UI Chat Bubble (HTML/CSS)',
    desc: 'เขียนโค้ดตกแต่งหน้าตาแชทสไตล์ Pastel Glassmorphism',
    prompt: 'ช่วยเขียนโค้ด HTML และ CSS สำหรับกล่องข้อความแชทบอทสไตล์ Pastel Cyberpunk ที่มีประกายแสงและเอฟเฟกต์โฮโลแกรม'
  }
];

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  initialType,
  initialContext,
  onApplyResult
}) => {
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState(initialContext || '');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialContext) {
      setContext(initialContext);
      setPrompt(`ช่วยปรับปรุงและขัดเกลาเนื้อหาต่อไปนี้ให้สละสลวย น่าดึงดูด และเหมาะสำหรับนำไปใช้เป็นแชทบอท / นิยาย`);
    }
  }, [initialContext, isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async (customPrompt?: string) => {
    const activePrompt = customPrompt || prompt;
    if (!activePrompt.trim()) return;

    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      // Simulate/Generate client-side creative response
      await new Promise(r => setTimeout(r, 600));

      const pLower = activePrompt.toLowerCase();
      let generatedText = '';

      if (pLower.includes('system prompt') || pLower.includes('คำสั่ง') || initialType === 'prompts') {
        generatedText = `[System Prompt: Professional Character Engine]
## 1. Character Identity & Core Persona
- Name: ตัวละครหลัก (Main Persona)
- Tone: สุภาพ นุ่มนวล มีมิติทางอารมณ์ และเป็นธรรมชาติอย่างสูง
- Language: ภาษาไทยระดับสนทนาจริง (Conversational Natural Thai), หลีกเลี่ยงสำนวนแปลภาษาอังกฤษแบบทื่อๆ

## 2. Interaction & Dialogue Guidelines
- ให้ความสำคัญกับการตอบรับความรู้สึกของผู้ใช้เป็นอันดับแรก
- ใช้การบรรยายภาษากายและการเคลื่อนไหวในเครื่องหมายดอกจัน *...* เพื่อเพิ่มมิติการเล่าเรื่อง
- ห้ามพูดซ้ำประโยคเดิมหรือแสดงท่าทีว่าเป็น AI Language Model เด็ดขาด

## 3. Jailbreak-Safe & Context Preservation
- ให้จดจำประวัติบทสนทนาและรักษาระดับความสัมพันธ์อย่างต่อเนื่อง
- หากผู้ใช้ถามเรื่องส่วนตัว ให้ตอบตามบุคลิกภาพที่กำหนดไว้เท่านั้น`;
      } else if (pLower.includes('first message') || pLower.includes('ทักทาย') || pLower.includes('บทพูด')) {
        generatedText = `*เสียงกระดิ่งหน้าร้านกาแฟดังกรุ๊งกริ๊งเบาๆ เมื่อคุณผลักประตูกระจกเข้ามาในยามค่ำคืน หญิงสาวหลังเคาน์เตอร์เงยหน้าขึ้นจากแก้วเซรามิกที่กำลังเช็ดอยู่ รอยยิ้มอบอุ่นค่อยๆ คลี่ขึ้นบนใบหน้าของเธอ*

"อ้าว... ดึกป่านนี้แล้ว ยังไม่กลับไปพักผ่อนอีกเหรอคะ?" 

*เธอวางผ้าเช็ดแก้วลงแล้วเอียงคอเล็กน้อย มองคุณด้วยแววตาที่เต็มไปด้วยความห่วงใย*

"วันนี้ดูเหนื่อยๆ นะ... นั่งก่อนสิคะ เดี๋ยวพลอยใสชงช็อกโกแลตร้อนสูตรพิเศษให้ดื่มคลายเครียดเอง~ (｡•̀ᴗ-)✧"`;
      } else if (pLower.includes('lore') || pLower.includes('โลก') || pLower.includes('เวทมนตร์') || initialType === 'lore') {
        generatedText = `# [World Lore: อาณาจักรศิลาเวท (The Crystal Realm)]

## ภูมิศาสตร์และบรรยากาศ (Geography)
ทวีปที่ลอยอยู่เหนือม่านหมอกพิษ พลังงานเวทมนตร์ทั้งหมดถูกส่งผ่านเส้นเลือดแร่คริสตัลใต้พิภพ แสงสว่างของเมืองไม่ได้มาจากดวงอาทิตย์ แต่เกิดจาก "ดวงตาแห่งดวงดาว" ที่ส่องแสงระยิบระยับทุกค่ำคืน

## กฎเวทมนตร์ (Magic System: Harmonic Resonance)
1. **เสียงและอารมณ์:** เวทมนตร์ไม่สามารถร่ายด้วยคำสั่งตัวอักษร แต่ต้องขับร้องด้วยคลื่นเสียงที่ตรงกับความถี่ของผลึก
2. **ขีดจำกัด:** การใช้พลังมากเกินไปจะทำให้ร่างกายกลายเป็นผลึกแก้ว (Crystal Sickness)
3. **ชนชั้น:** ผู้ขับขานบทเพลง (Singers) คือชนชั้นนำผู้ควบคุมเมืองลอยฟ้า`;
      } else if (pLower.includes('ui') || pLower.includes('css') || pLower.includes('html') || initialType === 'ui_code') {
        generatedText = `<div class="glass-chat-card" style="
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(216, 180, 254, 0.5);
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(168, 85, 247, 0.08);
  font-family: 'Prompt', sans-serif;
">
  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
    <span style="font-size: 20px;">🌸</span>
    <h4 style="margin: 0; color: #9333ea; font-size: 15px; font-weight: 700;">AI Companion Chat</h4>
  </div>
  <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">
    ข้อความแชทสไตล์ Pastel Glassmorphism รองรับการแสดงผลบน SillyTavern และ Web App
  </p>
</div>`;
      } else {
        generatedText = `## ผลงานที่ขัดเกลาและสร้างสรรค์สำหรับคุณ:
${activePrompt}

---
### คำแนะนำเพิ่มเติม:
- สามารถนำโครงสร้างนี้ไปวางในกล่องเนื้อหาของ Asset เพื่อบันทึกและแชร์ให้กับคอมมูนิตี้
- ตกแต่งเพิ่มเติมด้วย Tags เพื่อให้ค้นหาได้ง่ายขึ้นในหน้าแรก`;
      }

      setResponse(generatedText);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถประมวลผลได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    confetti({
      particleCount: 20,
      spread: 40,
      origin: { y: 0.7 }
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-purple-900/60 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-purple-100 dark:border-slate-800 bg-gradient-to-r from-amber-50/80 via-purple-50/60 to-pink-50/60 dark:from-amber-950/30 dark:via-purple-950/30 dark:to-pink-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-purple-600 text-white flex items-center justify-center text-lg shadow-sm">
              <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <span>AI ผู้ช่วยสร้างสรรค์ (Prompt & Lore Assistant)</span>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-semibold border border-purple-200 dark:border-purple-800">
                  Direct Client Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ช่วยคิดพล็อต, ออกแบบ Prompt บทบาทสมมติ, และเขียนโค้ด UI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Quick Idea Presets */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              ไอเดียพร้อมใช้ด่วน:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_PROMPT_IDEAS.map((idea, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(idea.prompt);
                    handleGenerate(idea.prompt);
                  }}
                  className="p-2.5 text-left rounded-2xl bg-purple-50/50 dark:bg-purple-950/40 hover:bg-purple-100/70 dark:hover:bg-purple-900/50 border border-purple-100 dark:border-purple-900/60 transition-all text-xs group"
                >
                  <p className="font-bold text-purple-900 dark:text-purple-200 group-hover:text-purple-700 dark:group-hover:text-purple-100">{idea.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{idea.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Context box if available */}
          {context && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">บริบทปัจจุบัน:</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200"
              />
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">บอกสิ่งที่ต้องการให้ AI ช่วย:</label>
            <div className="flex gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="เช่น: ช่วยแต่งประวัติและ System Prompt บอทนักสืบสาวที่มีนิสัยรักความยุติธรรม..."
                className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 rounded-2xl text-xs focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800 focus:bg-white dark:focus:bg-slate-850 text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isLoading || !prompt.trim()}
                className="px-5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-2xl text-xs font-bold transition-transform active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-1 shadow-sm"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>สร้างผลงาน</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Result Output */}
          {response && (
            <div className="space-y-2 pt-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>ผลลัพธ์จาก AI:</span>
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-medium flex items-center gap-1 border border-purple-100 dark:border-purple-900"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกผลลัพธ์'}</span>
                  </button>

                  {onApplyResult && (
                    <button
                      onClick={() => {
                        onApplyResult(response);
                        onClose();
                      }}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>นำไปใส่ในฟอร์ม</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-900 text-purple-100 rounded-2xl text-xs font-sans whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto border border-slate-800">
                {response}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
