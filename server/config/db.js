// server/config/db.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, '../storage');
const DB_FILE = path.join(STORAGE_DIR, 'dpl_database.json');
const BACKUP_DIR = path.join(STORAGE_DIR, 'backups');

const DEFAULT_STATE = {
  tourStatus: 'none',
  tourConfig: {
    name: 'Dược Premier League 2026',
    format: 'group',
    numGroups: 2,
    knockoutFormat: 'quarter',
    halfDuration: 20
  },
  groupsData: [],
  matches: {},
  players: {},
  suspensions: {},
  handledViolations: {}
};

class Database {
  constructor() {
    this.data = { ...DEFAULT_STATE };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      }
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = { ...DEFAULT_STATE, ...JSON.parse(raw) };
        console.log('✅ [Database] Đã tải dữ liệu giải đấu thành công từ disk');
      } else {
        this.save();
        console.log('✨ [Database] Đã khởi tạo cơ sở dữ liệu mặc định mới');
      }
    } catch (err) {
      console.error('❌ [Database] Lỗi khi khởi tạo database:', err);
      this.data = { ...DEFAULT_STATE };
    }
  }

  save() {
    try {
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      }
      // Ghi nguyên tử bằng file tạm để tránh mất dữ liệu nếu ngắt điện
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
      return true;
    } catch (err) {
      console.error('❌ [Database] Lỗi khi lưu file database:', err);
      return false;
    }
  }

  createBackup() {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUP_DIR, `dpl_backup_${timestamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(this.data, null, 2), 'utf-8');
      console.log(`📦 [Database] Đã tạo bản sao lưu an toàn: ${backupFile}`);
      return backupFile;
    } catch (err) {
      console.error('❌ [Database] Lỗi khi tạo bản sao lưu:', err);
      return null;
    }
  }

  getAll() {
    return this.data;
  }

  get(key) {
    return this.data[key];
  }

  set(key, val) {
    this.data[key] = val;
    this.save();
    return this.data[key];
  }

  updateMulti(updates = {}) {
    Object.keys(updates).forEach((pathKey) => {
      const parts = pathKey.split('/');
      if (parts.length === 1) {
        if (updates[pathKey] === null) {
          delete this.data[parts[0]];
        } else {
          this.data[parts[0]] = updates[pathKey];
        }
      } else if (parts.length === 2) {
        const [parent, child] = parts;
        if (!this.data[parent] || typeof this.data[parent] !== 'object') {
          this.data[parent] = {};
        }
        if (updates[pathKey] === null) {
          delete this.data[parent][child];
        } else {
          this.data[parent][child] = updates[pathKey];
        }
      }
    });
    this.save();
    return this.data;
  }

  reset() {
    this.createBackup();
    this.data = { ...DEFAULT_STATE };
    this.save();
    return this.data;
  }

  importData(importedData) {
    this.createBackup();
    this.data = { ...DEFAULT_STATE, ...importedData };
    this.save();
    return this.data;
  }
}

export const db = new Database();
