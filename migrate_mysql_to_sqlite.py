import mysql.connector
import sqlite3

# --- MySQL connection ---
mysql_conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Spattern6dots@",   # your MySQL password
    database="employee_db"
)
mysql_cursor = mysql_conn.cursor(dictionary=True)

# --- SQLite connection ---
sqlite_conn = sqlite3.connect("employee.db")
sqlite_cursor = sqlite_conn.cursor()

# Ensure table exists in SQLite
sqlite_cursor.execute("""
CREATE TABLE IF NOT EXISTS employee_logins (
    userid TEXT PRIMARY KEY,
    name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user'
);
""")

print("✅ Table ensured in SQLite")

# Fetch all users from MySQL
mysql_cursor.execute("SELECT userid, name, password_hash, role FROM employee_logins")
all_users = mysql_cursor.fetchall()

print(f"✅ Fetched {len(all_users)} users from MySQL")

# Insert into SQLite
for user in all_users:
    sqlite_cursor.execute("""
        INSERT OR REPLACE INTO employee_logins (userid, name, password_hash, role)
        VALUES (?, ?, ?, ?)
    """, (user['userid'], user['name'], user['password_hash'], user['role']))

sqlite_conn.commit()

# Close connections
mysql_cursor.close()
mysql_conn.close()
sqlite_conn.close()

print("✅ Migrated all users to SQLite successfully!")
