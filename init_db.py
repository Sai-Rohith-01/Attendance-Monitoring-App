import sqlite3

# Create (or connect) to employee.db
conn = sqlite3.connect("employee.db")
cursor = conn.cursor()

# Example tables (adjust as needed)
cursor.execute("""
CREATE TABLE IF NOT EXISTS employee_logins (
    userid TEXT PRIMARY KEY,
    name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user'
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS login_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userid TEXT,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")


conn.commit()
conn.close()

print("✅ employee.db created with tables!")
