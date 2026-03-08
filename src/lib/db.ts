import { type Database as Database } from 'better-sqlite3'
import path from 'path'

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'congregation.db')

let db: Database

// 初始化數據庫
function initDatabase() {
  const schemaPath = path.join(process.cwd(), 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf-8')
  
  if (!fs.existsSync(dbPath)) {
    db = new Database(dbPath)
    db.exec(schema)
    console.log('Database initialized')
  }
  
  return db
}

// 獲取數據庫實例
export const db = initDatabase()
