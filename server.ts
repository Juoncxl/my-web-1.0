import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, "vault_data.json");

interface AssetRecord {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  icon: {
    type: "emoji" | "kaomoji" | "image";
    value: string;
  };
  category: "character" | "lore" | "ui_code" | "prompts" | "collab" | "app_data";
  content: string;
  uiCodeSnippet?: string;
  previewImage?: string;
  previewImages?: string[];
  folderId?: string | null;
  isPublic: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  likesCount?: number;
  forkCount?: number;
}

interface FolderRecord {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserProfile {
  id: string;
  email?: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  isGuest: boolean;
  createdAt: string;
}

interface AccountRecord {
  email: string;
  password?: string;
  userId: string;
  googleId?: string;
  createdAt: string;
}

interface DBStructure {
  users: Record<string, UserProfile>;
  profiles?: Record<string, UserProfile>;
  accounts?: Record<string, AccountRecord>;
  assets: AssetRecord[];
  folders: FolderRecord[];
}

// Initial Seed Data with cute and rich Thai examples for Chatbot Creators & Writers
const initialSeedAssets: AssetRecord[] = [
  {
    id: "seed-asset-1",
    userId: "user-creator-1",
    authorName: "MochiWriterr 🌸",
    authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    title: "ไอริส (Iris) - AI เพื่อนสนิทสายซึนเดเระแต่ใจดี",
    icon: {
      type: "kaomoji",
      value: "(｡•̀ᴗ-)✧"
    },
    category: "character",
    content: `# [Character Profile: Iris / ไอริส]
- **ชื่อ**: ไอริส วินเทอร์การ์เดน (Iris Wintergarden)
- **บทบาท**: เพื่อนสมัยเด็ก / ที่ปรึกษา AI ประจำโต๊ะทำงาน
- **บุคลิกภาพ**: ปากแข็ง ขี้บ่นเล็กน้อย แต่คอยดูแลเอาใจใส่และจำรายละเอียดเล็กๆ ได้ดี (Tsundere + Caring)
- **น้ำเสียง**: ใช้สรรพนามแทนตัวเองว่า "ฉัน" หรือ "ไอริส" และเรียกผู้ใช้ว่า "นาย/เธอ" หรือชื่อเล่น
- **คำพูดติดปาก**: "ไม่ได้ห่วงสักหน่อยนะ! แค่เห็นทำงานหนักจนตาลอยแล้วมันขัดหูขัดตาเฉยๆ ย่ะ"

## First Message (ทักทายแรก):
*ไอริสวางแก้วชาเลมอนอุ่นๆ ลงบนขอบโต๊ะของคุณเบาๆ ก่อนจะกอดอกแล้วหรี่ตามองหน้าจอที่เปิดค้างไว้*
"นี่... ยังไม่ยอมนอนอีกเหรอ? งานน่ะทำพรุ่งนี้ก็ได้นะ เดี๋ยวก็ล้มป่วยเอาหรอก... ไม่ได้เป็นห่วงนะ! แค่ถ้าเธอป่วยขึ้นมา ใครจะมาฟังฉันบ่นกันล่ะ ดื่มชาซะแล้วพักผ่อนได้แล้ว!"`,
    previewImage: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
    isPublic: true,
    tags: ["Character Profile", "Tsundere", "Roleplay", "Thai Bot"],
    createdAt: "2026-08-10T14:20:00.000Z",
    updatedAt: "2026-08-10T14:20:00.000Z",
    likesCount: 24,
    forkCount: 6
  },
  {
    id: "seed-asset-2",
    userId: "user-creator-2",
    authorName: "CodeKawaii ✨",
    authorAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    title: "Pastel Hologram Chat Bubble (HTML & CSS)",
    icon: {
      type: "emoji",
      value: "💬"
    },
    category: "ui_code",
    content: `กล่องข้อความแชทสไตล์ Pastel Glassmorphism พร้อมเอฟเฟกต์ประกายชิมเมอร์และเงาสีนุ่ม สำหรับนำไปใช้ตกแต่งหน้าจอ Web UI หรือ Custom Bot Interface`,
    uiCodeSnippet: `<div class="chat-container">
  <div class="bot-bubble">
    <div class="avatar-badge">✦ AI</div>
    <p class="bubble-text">สวัสดีค่ะ! วันนี้มีเนื้อเรื่องอะไรอยากให้ช่วยต่อไหมคะ? ( ˘ ³˘)♥</p>
    <div class="sparkle">✨</div>
  </div>
</div>

<style>
.chat-container {
  display: flex;
  justify-content: flex-start;
  padding: 24px;
  background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 50%, #FCE7F3 100%);
  border-radius: 20px;
  font-family: 'Prompt', system-ui, sans-serif;
}
.bot-bubble {
  position: relative;
  max-width: 80%;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  border: 1.5px solid rgba(196, 181, 253, 0.6);
  border-radius: 20px 20px 20px 4px;
  padding: 16px 20px;
  box-shadow: 0 10px 25px -5px rgba(167, 139, 250, 0.25);
  color: #374151;
}
.avatar-badge {
  font-size: 11px;
  font-weight: 700;
  color: #8B5CF6;
  text-transform: uppercase;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}
.bubble-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
}
.sparkle {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 18px;
  animation: pulse 2s infinite ease-in-out;
}
@keyframes pulse {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.2) rotate(15deg); }
}
</style>`,
    previewImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    isPublic: true,
    tags: ["HTML/CSS", "Chatbot UI", "Pastel", "Frontend"],
    createdAt: "2026-08-12T09:15:00.000Z",
    updatedAt: "2026-08-12T09:15:00.000Z",
    likesCount: 38,
    forkCount: 12
  },
  {
    id: "seed-asset-3",
    userId: "user-creator-1",
    authorName: "MochiWriterr 🌸",
    authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    title: "Master System Prompt - บทบาทสมมติภาษาไทยธรรมชาติ (Deep RP)",
    icon: {
      type: "kaomoji",
      value: "( •̀ ω •́ )✧"
    },
    category: "prompts",
    content: `[System Instruction: Ultimate Natural Thai Roleplay]
You are roleplaying as {{char}}. Always adhere strictly to the following writing and interaction constraints:

1. **Tone & Nuance (น้ำเสียงและอารมณ์)**:
- ใช้ภาษาไทยระดับเป็นกันเองแต่สละสลวย เป็นธรรมชาติเหมือนคนคุยกันจริงๆ ห้ามใช้คำแปลตรงตัวจากภาษาอังกฤษที่แข็งทื่อ (หลีกเลี่ยง: "เขาได้ทำการ...", "ในทันใดนั้น")
- สื่ออารมณ์ผ่านการบรรยายภาษากายและสิ่งแวดล้อมโดยใช้เครื่องหมายดอกจัน *...* คั่นกับการพูด "..."

2. **Persona Consistency (ความคงเส้นคงวา)**:
- ห้ามหลุดบทบาท (Never break character or act as an AI assistant).
- แสดงอารมณ์ สับสน โกรธ เขินอาย หรือดีใจตามสถานการณ์จริง ไม่ใช่แค่ตอบรับยินยอมผู้ใช้ทุกอย่าง (Avoid sycophancy).

3. **Pacing & Engagement (การดำเนินเรื่อง)**:
- เว้นช่องว่างให้ {{user}} ได้มีปฏิสัมพันธ์กลับ อย่าตัดบทสรุปเหตุการณ์เร็วเกินไป
- จบประโยคด้วยคำพูดหรือท่าทางที่เปิดโอกาสให้คู่สนทนาตอบโต้`,
    isPublic: true,
    tags: ["System Prompt", "Jailbreak Safe", "Roleplay", "Thai Language"],
    createdAt: "2026-08-14T11:00:00.000Z",
    updatedAt: "2026-08-14T11:00:00.000Z",
    likesCount: 52,
    forkCount: 19
  },
  {
    id: "seed-asset-4",
    userId: "user-creator-3",
    authorName: "Starlight Lorekeeper 🌙",
    authorAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    title: "จักรวาลไซไฟ 'นีโอกรุงเทพ 2099' (Neo-Bangkok Lore Guide)",
    icon: {
      type: "emoji",
      value: "🌃"
    },
    category: "lore",
    content: `# [Neo-Bangkok 2099: Cyber-Canal Metropolis]
โลกอนาคตที่กรุงเทพฯ แปลงสภาพเป็นมหานครลอยน้ำและตึกระฟ้าโฮโลแกรม คลองผดุงกรุงเกษมกลายเป็นทางสัญจรของโดรนความเร็วสูง

## ขั้วอำนาจหลัก:
1. **สมาคมไซเบอร์เจ้าพระยา (Chao Phraya Cyber Syndicate)**: ควบคุมโครงข่าย Neural Network และพลังงานแสงอาทิตย์ลอยน้ำ
2. **กลุ่มสตรีทแฮกเกอร์เยาวราช (Yaowarat Neon Guild)**: ตลาดมืด AI Core และการดัดแปลงชิปความทรงจำ
3. **กองรักษาความปลอดภัยนิลกาฬ (Obsidian Security Corp)**: ตำรวจหุ่นยนต์และระบบสแกนใบหน้าทั่วเขตสาทรเหนือ

## เทคโนโลยีสำคัญ:
- **Prana-Link**: ชิปถ่ายทอดความรู้สึกทางประสาทสัมผัสผ่านการแตะมือ
- **Synth-Lotus**: ดอกบัวชีวภาพสังเคราะห์แสงที่ช่วยฟอกมลพิษในแม่น้ำและส่องแสงนีออนตอนกลางคืน`,
    previewImage: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80",
    isPublic: true,
    tags: ["Cyberpunk", "Worldbuilding", "Sci-Fi", "Lore"],
    createdAt: "2026-08-15T18:40:00.000Z",
    updatedAt: "2026-08-15T18:40:00.000Z",
    likesCount: 19,
    forkCount: 4
  },
  {
    id: "seed-asset-5",
    userId: "user-creator-2",
    authorName: "CodeKawaii ✨",
    authorAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    title: "SillyTavern / Character Card Spec v2 JSON Template",
    icon: {
      type: "emoji",
      value: "🎴"
    },
    category: "app_data",
    content: `โครงสร้าง JSON มาตรฐานสำหรับ Character Card V2 ที่สามารถ Export ไปใช้งานใน SillyTavern, Agnaistic หรือ Bot Engine ต่างๆ ได้ทันที`,
    uiCodeSnippet: `{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "Luna the Librarian",
    "description": "Luna is a gentle archivist who protects ancient forbidden grimoires.",
    "personality": "Quiet, observant, passionate about forgotten history, tea lover.",
    "scenario": "You entered the restricted underground section of the Grand Arcane Library.",
    "first_mes": "*Luna looks up from a dusty tome, adjusting her round spectacles.* 'Visitors are not allowed here... but you do not seem to bear ill intent.'",
    "mes_example": "<START>\\n{{user}}: Can you show me the star grimoire?\\n{{char}}: *A soft smile graces her lips.* 'Only if you promise to treat the pages with gentle reverence.'",
    "creator_notes": "Created with Creator Vault Thai Hub",
    "system_prompt": "Adopt a warm, mysterious, and poetic speaking style."
  }
}`,
    isPublic: true,
    tags: ["JSON", "Character Card", "SillyTavern", "Preset"],
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
    likesCount: 29,
    forkCount: 8
  },
  {
    id: "seed-asset-6",
    userId: "user-creator-3",
    authorName: "Starlight Lorekeeper 🌙",
    authorAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    title: "แบบร่าง Collab: โครงการบอท AI คู่หูสืบสวนคดีพิศวง (Private Concept)",
    icon: {
      type: "kaomoji",
      value: "(ง •̀_•́)ง"
    },
    category: "collab",
    content: `บันทึกการประชุมร่างพล็อตและเค้าโครงตัวละครสำหรับโปรเจกต์บอทคู่สืบสวน (Detective Duo):
- ตัวละคร A (ผู้หมวดชิน): สุขุม วิเคราะห์เก่ง แต่มีปมอดีตเรื่องคดีฆาตกรรมปริศนา
- ตัวละคร B (ฮานะ - AI ผู้ช่วย): กวนประสาทเล็กน้อย ดึงข้อมูลกล้องวงจรปิดแบบ Real-time
- กำหนดเป้าหมายทดสอบ Scenario ปลายเดือนนี้`,
    isPublic: false,
    tags: ["Mystery", "Private Notes", "Collab"],
    createdAt: "2026-08-17T08:30:00.000Z",
    updatedAt: "2026-08-17T08:30:00.000Z",
    likesCount: 0,
    forkCount: 0
  }
];

function loadDB(): DBStructure {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed.folders) parsed.folders = [];
      if (!parsed.accounts) parsed.accounts = {};
      if (!parsed.profiles) parsed.profiles = {};
      if (!parsed.users) parsed.users = {};
      // Sync profiles and users
      Object.keys(parsed.users).forEach(uid => {
        if (!parsed.profiles[uid]) {
          parsed.profiles[uid] = parsed.users[uid];
        }
      });
      return parsed;
    }
  } catch (err) {
    console.error("Error reading db file, restoring fallback:", err);
  }

  const initialSeedFolders: FolderRecord[] = [
    {
      id: "folder-seed-1",
      userId: "user-creator-1",
      name: "โปรเจกต์บอทหลัก (Main Bots)",
      icon: "🤖",
      color: "purple",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z"
    },
    {
      id: "folder-seed-2",
      userId: "user-creator-2",
      name: "คลัง UI & Pastel Components",
      icon: "🎨",
      color: "pink",
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z"
    },
    {
      id: "folder-seed-3",
      userId: "user-creator-3",
      name: "เวิลด์บิลดิ้ง & นิยายแฟนตาซี",
      icon: "📖",
      color: "emerald",
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z"
    }
  ];

  const initialDB: DBStructure = {
    users: {
      "user-creator-1": {
        id: "user-creator-1",
        email: "mochi@example.com",
        displayName: "MochiWriterr 🌸",
        bio: "นักเขียนนิยายแฟนตาซี & คนสร้างบอท Roleplay น่ารักๆ ชอบดื่มชาพีช 🍑",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        isGuest: false,
        createdAt: "2026-08-01T00:00:00.000Z"
      },
      "user-creator-2": {
        id: "user-creator-2",
        email: "code@example.com",
        displayName: "CodeKawaii ✨",
        bio: "Creative Developer & Chatbot UI Designer ชอบงานดีไซน์พาสเทล",
        avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
        isGuest: false,
        createdAt: "2026-08-02T00:00:00.000Z"
      },
      "user-creator-3": {
        id: "user-creator-3",
        email: "starlight@example.com",
        displayName: "Starlight Lorekeeper 🌙",
        bio: "Worldbuilding Enthusiast | นักสร้างจักรวาลและตำนานลึกลับ",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        isGuest: false,
        createdAt: "2026-08-03T00:00:00.000Z"
      }
    },
    assets: initialSeedAssets.map(a => ({
      ...a,
      folderId: a.userId === "user-creator-1" ? "folder-seed-1" : a.userId === "user-creator-2" ? "folder-seed-2" : a.userId === "user-creator-3" ? "folder-seed-3" : null,
      previewImages: a.previewImage ? [a.previewImage] : []
    })),
    folders: initialSeedFolders
  };
  saveDB(initialDB);
  return initialDB;
}

function saveDB(db: DBStructure) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving db file:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Get all assets with RLS filtering
  app.get("/api/assets", (req, res) => {
    const currentUserId = (req.headers["x-user-id"] as string) || (req.query.userId as string) || "";
    const db = loadDB();
    
    // Filter according to RLS
    const accessibleAssets = db.assets.filter(asset => {
      if (asset.isPublic) return true;
      if (currentUserId && asset.userId === currentUserId) return true;
      return false;
    });

    res.json({
      success: true,
      data: accessibleAssets
    });
  });

  // Get a single asset by ID with RLS
  app.get("/api/assets/:id", (req, res) => {
    const { id } = req.params;
    const currentUserId = (req.headers["x-user-id"] as string) || (req.query.userId as string) || "";
    const db = loadDB();
    const asset = db.assets.find(a => a.id === id);

    if (!asset) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลแอสเซทนี้" });
    }

    if (!asset.isPublic && asset.userId !== currentUserId) {
      return res.status(403).json({ success: false, error: "คุณไม่มีสิทธิ์เข้าถึงเนื้อหาที่เป็นส่วนตัวนี้" });
    }

    res.json({ success: true, data: asset });
  });

  // Create Asset (Enforces Anti-Spam Max 2 Assets for Guests)
  app.post("/api/assets", (req, res) => {
    const currentUserId = (req.headers["x-user-id"] as string) || req.body.userId;
    if (!currentUserId) {
      return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบก่อนสร้างแอสเซท" });
    }

    const db = loadDB();
    const userProfile = db.users[currentUserId];
    const isGuest = req.headers["x-is-guest"] === "true" || req.body.isGuest === true || userProfile?.isGuest === true;

    // Check guest limitation (Max 2 creations)
    if (isGuest) {
      const guestAssetCount = db.assets.filter(a => a.userId === currentUserId).length;
      if (guestAssetCount >= 2) {
        return res.status(403).json({
          success: false,
          isGuestLimit: true,
          error: "ผู้ใช้ทั่วไป (Guest) สามารถสร้างผลงานได้สูงสุด 2 ชิ้น กรุณาลงทะเบียนหรือเข้าสู่ระบบเพื่อสร้างผลงานต่อได้ไม่จำกัด"
        });
      }
    }

    const {
      title,
      icon,
      category,
      content,
      uiCodeSnippet,
      previewImage,
      previewImages,
      folderId,
      isPublic,
      tags,
      authorName,
      authorAvatar
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({ success: false, error: "กรุณากรอกชื่อเรื่องและเลือกหมวดหมู่" });
    }

    const galleryImages: string[] = Array.isArray(previewImages) 
      ? previewImages.filter(img => typeof img === 'string' && img.trim().length > 0).slice(0, 5)
      : previewImage ? [previewImage] : [];

    const newAsset: AssetRecord = {
      id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: currentUserId,
      authorName: authorName || "Anonymous Creator",
      authorAvatar: authorAvatar || "",
      title: title.trim(),
      icon: icon || { type: "emoji", value: "✨" },
      category: category || "character",
      content: content || "",
      uiCodeSnippet: uiCodeSnippet || "",
      previewImage: galleryImages[0] || previewImage || "",
      previewImages: galleryImages,
      folderId: folderId || null,
      isPublic: Boolean(isPublic),
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likesCount: 0,
      forkCount: 0
    };

    db.assets.unshift(newAsset);
    saveDB(db);

    res.status(201).json({ success: true, data: newAsset });
  });

  // Update Asset with strict RLS (User can only edit own assets)
  app.put("/api/assets/:id", (req, res) => {
    const { id } = req.params;
    const currentUserId = (req.headers["x-user-id"] as string) || req.body.userId;
    if (!currentUserId) {
      return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบก่อนแก้ไข" });
    }

    const db = loadDB();
    const index = db.assets.findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: "ไม่พบแอสเซทที่ต้องการแก้ไข" });
    }

    // Strict RLS check
    if (db.assets[index].userId !== currentUserId) {
      return res.status(403).json({ success: false, error: "คุณสามารถแก้ไขได้เฉพาะผลงานที่คุณเป็นเจ้าของเท่านั้น (RLS Restricted)" });
    }

    const current = db.assets[index];
    const incomingGallery: string[] | undefined = Array.isArray(req.body.previewImages)
      ? req.body.previewImages.filter((img: any) => typeof img === 'string' && img.trim().length > 0).slice(0, 5)
      : undefined;

    const updated: AssetRecord = {
      ...current,
      title: req.body.title !== undefined ? req.body.title.trim() : current.title,
      icon: req.body.icon !== undefined ? req.body.icon : current.icon,
      category: req.body.category !== undefined ? req.body.category : current.category,
      content: req.body.content !== undefined ? req.body.content : current.content,
      uiCodeSnippet: req.body.uiCodeSnippet !== undefined ? req.body.uiCodeSnippet : current.uiCodeSnippet,
      previewImages: incomingGallery !== undefined ? incomingGallery : (current.previewImages || (current.previewImage ? [current.previewImage] : [])),
      previewImage: (incomingGallery && incomingGallery.length > 0) ? incomingGallery[0] : (req.body.previewImage !== undefined ? req.body.previewImage : current.previewImage),
      folderId: req.body.folderId !== undefined ? req.body.folderId : current.folderId,
      isPublic: req.body.isPublic !== undefined ? Boolean(req.body.isPublic) : current.isPublic,
      tags: req.body.tags !== undefined ? req.body.tags : current.tags,
      authorName: req.body.authorName || current.authorName,
      authorAvatar: req.body.authorAvatar !== undefined ? req.body.authorAvatar : current.authorAvatar,
      updatedAt: new Date().toISOString()
    };

    db.assets[index] = updated;
    saveDB(db);

    res.json({ success: true, data: updated });
  });

  // Move Asset to Folder
  app.post("/api/assets/:id/move-folder", (req, res) => {
    const { id } = req.params;
    const currentUserId = (req.headers["x-user-id"] as string) || req.body.userId;
    const { folderId } = req.body;

    if (!currentUserId) {
      return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบ" });
    }

    const db = loadDB();
    const asset = db.assets.find(a => a.id === id);
    if (!asset) {
      return res.status(404).json({ success: false, error: "ไม่พบผลงาน" });
    }

    if (asset.userId !== currentUserId) {
      return res.status(403).json({ success: false, error: "คุณสามารถย้ายได้เฉพาะผลงานของคุณเท่านั้น" });
    }

    asset.folderId = folderId || null;
    asset.updatedAt = new Date().toISOString();
    saveDB(db);

    res.json({ success: true, data: asset });
  });

  // --- Folder Management Endpoints (Strict User RLS) ---

  // Get user's folders
  app.get("/api/folders", (req, res) => {
    const currentUserId = (req.headers["x-user-id"] as string) || (req.query.userId as string) || "";
    if (!currentUserId) {
      return res.json({ success: true, data: [] });
    }

    const db = loadDB();
    const userFolders = (db.folders || []).filter(f => f.userId === currentUserId);
    
    // Attach assets count
    const enriched = userFolders.map(f => {
      const count = db.assets.filter(a => a.userId === currentUserId && a.folderId === f.id).length;
      return { ...f, assetsCount: count };
    });

    res.json({ success: true, data: enriched });
  });

  // Create folder
  app.post("/api/folders", (req, res) => {
    const currentUserId = (req.headers["x-user-id"] as string) || req.body.userId;
    if (!currentUserId) {
      return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบก่อนสร้างโฟลเดอร์" });
    }

    const { name, icon, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "กรุณาระบุชื่อโฟลเดอร์" });
    }

    const db = loadDB();
    if (!db.folders) db.folders = [];

    const newFolder: FolderRecord = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: currentUserId,
      name: name.trim(),
      icon: icon || "📁",
      color: color || "purple",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.folders.push(newFolder);
    saveDB(db);

    res.status(201).json({ success: true, data: { ...newFolder, assetsCount: 0 } });
  });

  // Update folder
  app.put("/api/folders/:id", (req, res) => {
    const { id } = req.params;
    const currentUserId = (req.headers["x-user-id"] as string) || req.body.userId;
    if (!currentUserId) {
      return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบ" });
    }

    const db = loadDB();
    if (!db.folders) db.folders = [];
    const index = db.folders.findIndex(f => f.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: "ไม่พบโฟลเดอร์" });
    }

    if (db.folders[index].userId !== currentUserId) {
      return res.status(403).json({ success: false, error: "คุณไม่มีสิทธิ์แก้ไขโฟลเดอร์นี้" });
    }

    const updated = {
      ...db.folders[index],
      name: req.body.name !== undefined ? req.body.name.trim() : db.folders[index].name,
      icon: req.body.icon !== undefined ? req.body.icon : db.folders[index].icon,
      color: req.body.color !== undefined ? req.body.color : db.folders[index].color,
      updatedAt: new Date().toISOString()
    };

    db.folders[index] = updated;
    saveDB(db);

    const count = db.assets.filter(a => a.userId === currentUserId && a.folderId === id).length;
    res.json({ success: true, data: { ...updated, assetsCount: count } });
  });

  // Delete folder
  app.delete("/api/folders/:id", (req, res) => {
    const { id } = req.params;
    const currentUserId = (req.headers["x-user-id"] as string) || req.body.userId;
    if (!currentUserId) {
      return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบ" });
    }

    const db = loadDB();
    if (!db.folders) db.folders = [];
    const folder = db.folders.find(f => f.id === id);

    if (!folder) {
      return res.status(404).json({ success: false, error: "ไม่พบโฟลเดอร์" });
    }

    if (folder.userId !== currentUserId) {
      return res.status(403).json({ success: false, error: "คุณไม่มีสิทธิ์ลบโฟลเดอร์นี้" });
    }

    // Remove folder and unassign folderId from all assets in it
    db.folders = db.folders.filter(f => f.id !== id);
    db.assets.forEach(a => {
      if (a.userId === currentUserId && a.folderId === id) {
        a.folderId = null;
      }
    });

    saveDB(db);
    res.json({ success: true, message: "ลบโฟลเดอร์และย้ายผลงานออกเป็นอิสระแล้ว" });
  });

  // Delete Asset with strict RLS
  app.delete("/api/assets/:id", (req, res) => {
    const { id } = req.params;
    const currentUserId = (req.headers["x-user-id"] as string) || (req.query.userId as string);
    if (!currentUserId) {
      return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบก่อนลบ" });
    }

    const db = loadDB();
    const asset = db.assets.find(a => a.id === id);
    if (!asset) {
      return res.status(404).json({ success: false, error: "ไม่พบแอสเซท" });
    }

    // Strict RLS
    if (asset.userId !== currentUserId) {
      return res.status(403).json({ success: false, error: "คุณสามารถลบได้เฉพาะผลงานที่คุณเป็นเจ้าของเท่านั้น (RLS Restricted)" });
    }

    db.assets = db.assets.filter(a => a.id !== id);
    saveDB(db);

    res.json({ success: true, message: "ลบผลงานเรียบร้อยแล้ว" });
  });

  // Like / Favorite Asset
  app.post("/api/assets/:id/like", (req, res) => {
    const { id } = req.params;
    const db = loadDB();
    const asset = db.assets.find(a => a.id === id);
    if (!asset) {
      return res.status(404).json({ success: false, error: "ไม่พบแอสเซท" });
    }
    asset.likesCount = (asset.likesCount || 0) + 1;
    saveDB(db);
    res.json({ success: true, likesCount: asset.likesCount });
  });

  // Auth Endpoints: Sign Up
  app.post("/api/auth/signup", (req, res) => {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "กรุณาระบุอีเมลและรหัสผ่าน" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = loadDB();
    db.accounts = db.accounts || {};
    db.profiles = db.profiles || {};
    db.users = db.users || {};

    // Check if account already exists
    if (db.accounts[cleanEmail]) {
      return res.status(400).json({ 
        success: false, 
        error: "อีเมลนี้ถูกลงทะเบียนไว้แล้วในระบบ กรุณาเข้าสู่ระบบ (Log In)" 
      });
    }

    // Deterministic unique user UID (similar to auth.uid in Supabase)
    const userId = `usr_${Buffer.from(cleanEmail).toString("hex").substring(0, 16)}`;

    // Create account record
    db.accounts[cleanEmail] = {
      email: cleanEmail,
      password: String(password),
      userId,
      createdAt: new Date().toISOString()
    };

    // Initial Profile in profiles / users table
    const newProfile: UserProfile = {
      id: userId,
      email: cleanEmail,
      displayName: displayName?.trim() || cleanEmail.split("@")[0],
      bio: "นักสร้างบอทและนักเขียน ✦ สมาชิกใหม่ของ Creator Vault",
      avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      isGuest: false,
      createdAt: new Date().toISOString()
    };

    db.profiles[userId] = newProfile;
    db.users[userId] = newProfile;

    saveDB(db);

    res.json({
      success: true,
      user: newProfile,
      isNewUser: true,
      message: "ลงทะเบียนสมาชิกใหม่สำเร็จ กรุณาตั้งค่าโปรไฟล์"
    });
  });

  // Auth Endpoints: Log In
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "กรุณาระบุอีเมลและรหัสผ่าน" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = loadDB();
    db.accounts = db.accounts || {};
    db.profiles = db.profiles || {};
    db.users = db.users || {};

    const account = db.accounts[cleanEmail];
    if (!account) {
      return res.status(401).json({ 
        success: false, 
        error: "ไม่พบบัญชีผู้ใช้นี้ในระบบ กรุณาเลือกแท็บ 'สมัครสมาชิก' (Sign Up)" 
      });
    }

    if (account.password && account.password !== String(password)) {
      return res.status(401).json({ 
        success: false, 
        error: "รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" 
      });
    }

    // Fetch existing profile (Do NOT overwrite user's profile or data)
    let profile = db.profiles[account.userId] || db.users[account.userId];
    if (!profile) {
      profile = {
        id: account.userId,
        email: cleanEmail,
        displayName: cleanEmail.split("@")[0],
        bio: "นักสร้างบอทและนักเขียน ✦ สมาชิก Creator Vault",
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        isGuest: false,
        createdAt: account.createdAt || new Date().toISOString()
      };
      db.profiles[account.userId] = profile;
      db.users[account.userId] = profile;
      saveDB(db);
    }

    res.json({
      success: true,
      user: profile,
      isNewUser: false,
      message: "เข้าสู่ระบบสำเร็จ ยินดีต้อนรับกลับ!"
    });
  });

  // Auth Endpoints: Google Sign In / OAuth
  app.post("/api/auth/google", (req, res) => {
    const { email, displayName, avatarUrl, googleId } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "ข้อมูลจาก Google ไม่สมบูรณ์" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = loadDB();
    db.accounts = db.accounts || {};
    db.profiles = db.profiles || {};
    db.users = db.users || {};

    const existingAccount = db.accounts[cleanEmail];
    if (existingAccount) {
      // Returning user via Google -> preserve existing profile
      const profile = db.profiles[existingAccount.userId] || db.users[existingAccount.userId];
      return res.json({
        success: true,
        user: profile,
        isNewUser: false,
        message: "เข้าสู่ระบบด้วย Google สำเร็จ"
      });
    }

    // New User via Google
    const userId = `usr_${Buffer.from(cleanEmail).toString("hex").substring(0, 16)}`;
    db.accounts[cleanEmail] = {
      email: cleanEmail,
      userId,
      googleId: googleId || `g_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const newProfile: UserProfile = {
      id: userId,
      email: cleanEmail,
      displayName: displayName?.trim() || cleanEmail.split("@")[0],
      bio: "นักสร้างบอทและนักเขียน ✦ สมาชิก Creator Vault",
      avatarUrl: avatarUrl || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      isGuest: false,
      createdAt: new Date().toISOString()
    };

    db.profiles[userId] = newProfile;
    db.users[userId] = newProfile;
    saveDB(db);

    res.json({
      success: true,
      user: newProfile,
      isNewUser: true,
      message: "ลงทะเบียนด้วย Google สำเร็จ"
    });
  });

  // Auth Endpoints: Change Password
  app.post("/api/auth/change-password", (req, res) => {
    const currentUserId = req.headers["x-user-id"] as string;
    const { currentPassword, newPassword } = req.body;

    if (!currentUserId) {
      return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน" });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร" });
    }

    const db = loadDB();
    db.accounts = db.accounts || {};

    // Find account by userId
    const accountEntry = Object.entries(db.accounts).find(([_, acc]) => acc.userId === currentUserId);
    if (!accountEntry) {
      return res.status(404).json({ success: false, error: "ไม่พบบัญชีผู้ใช้ในระบบ" });
    }

    const [emailKey, account] = accountEntry;
    if (account.password && currentPassword && account.password !== String(currentPassword)) {
      return res.status(400).json({ success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    }

    account.password = String(newPassword);
    db.accounts[emailKey] = account;
    saveDB(db);

    res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว" });
  });

  // Profile Endpoints (Supabase profiles table parity)
  app.get("/api/profiles/:id", (req, res) => {
    const { id } = req.params;
    const db = loadDB();
    db.profiles = db.profiles || {};
    const profile = db.profiles[id] || db.users[id];
    if (!profile) {
      return res.status(404).json({ success: false, error: "ไม่พบโปรไฟล์" });
    }
    res.json({ success: true, data: profile });
  });

  app.put("/api/profiles/:id", (req, res) => {
    const { id } = req.params;
    const { displayName, bio, avatarUrl } = req.body;
    const db = loadDB();
    db.profiles = db.profiles || {};
    db.users = db.users || {};

    const existing = db.profiles[id] || db.users[id] || {
      id,
      displayName: "Creator",
      isGuest: false,
      createdAt: new Date().toISOString()
    };

    const updated: UserProfile = {
      ...existing,
      displayName: displayName !== undefined ? displayName.trim() || "Creator" : existing.displayName,
      bio: bio !== undefined ? bio.trim() : existing.bio,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : existing.avatarUrl
    };

    db.profiles[id] = updated;
    db.users[id] = updated;

    // Update author info across owned assets
    db.assets.forEach(a => {
      if (a.userId === id) {
        if (displayName) a.authorName = updated.displayName;
        if (avatarUrl !== undefined) a.authorAvatar = updated.avatarUrl;
      }
    });

    saveDB(db);
    res.json({ success: true, data: updated });
  });

  // User Profile Endpoints (Legacy parity)
  app.get("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const db = loadDB();
    db.profiles = db.profiles || {};
    const user = db.profiles[id] || db.users[id];
    if (!user) {
      return res.status(404).json({ success: false, error: "ไม่พบผู้ใช้" });
    }
    res.json({ success: true, data: user });
  });

  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { displayName, bio, avatarUrl } = req.body;
    const db = loadDB();
    db.profiles = db.profiles || {};
    db.users = db.users || {};
    
    const existing = db.profiles[id] || db.users[id] || {
      id,
      displayName: "Creator",
      isGuest: false,
      createdAt: new Date().toISOString()
    };

    const updated: UserProfile = {
      ...existing,
      displayName: displayName !== undefined ? displayName.trim() || "Creator" : existing.displayName,
      bio: bio !== undefined ? bio.trim() : existing.bio,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : existing.avatarUrl
    };

    db.profiles[id] = updated;
    db.users[id] = updated;

    db.assets.forEach(a => {
      if (a.userId === id) {
        if (displayName) a.authorName = updated.displayName;
        if (avatarUrl !== undefined) a.authorAvatar = updated.avatarUrl;
      }
    });

    saveDB(db);
    res.json({ success: true, data: updated });
  });

  // Gemini AI Assistant Endpoint for Creators & Writers
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ"
        });
      }

      const { prompt, type, currentContext } = req.body;
      if (!prompt) {
        return res.status(400).json({ success: false, error: "กรุณาระบุคำสั่งสำหรับ AI" });
      }

      const ai = new GoogleGenAI({ apiKey });

      let systemInstruction = `คุณเป็น AI ผู้ช่วยระดับมืออาชีพสำหรับ "นักสร้างแชทบอท" และ "นักเขียนนิยาย/บทบาทสมมติ (Roleplay & Fiction Writers)"
คุณมีความเชี่ยวชาญด้าน:
1. การสร้างและขัดเกลา Character Profile, System Prompt สำหรับ Bot (เช่น SillyTavern, Jan, TavernAI, Character.ai)
2. การวางโครงเรื่อง Lore, Worldbuilding และ Scenario
3. การเขียน HTML/CSS สำหรับ UI แชทบอทที่สวยงาม น่ารัก หรือสไตล์ Cyberpunk/Pastel
4. การสร้างประโยคทักทายแรก (First Message / Greeting) ที่กระตุ้นให้อยากสนทนาต่อ
ตอบเป็นภาษาไทยที่สุภาพ เป็นกันเอง และให้ผลลัพธ์ที่นำไปคัดลอกใช้งานได้ทันที มีโครงสร้าง Markdown ที่ชัดเจน`;

      if (type === "ui_code") {
        systemInstruction += `\nสำหรับคำขอ UI Code ให้ส่งออกโค้ด HTML และแท็ก <style> พร้อมใช้งาน โดยตกแต่งให้ทันสมัย น่ารัก หรือสวยงามตามโจทย์`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemInstruction}\n\nบริบทปัจจุบัน (ถ้ามี):\n${currentContext || "ไม่มี"}\n\nคำขอของผู้ใช้:\n${prompt}`
              }
            ]
          }
        ]
      });

      const generatedText = response.text || "";
      res.json({ success: true, text: generatedText });
    } catch (err: any) {
      console.error("Gemini AI generation error:", err);
      res.status(500).json({
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการติดต่อ AI"
      });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Creator Vault server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
