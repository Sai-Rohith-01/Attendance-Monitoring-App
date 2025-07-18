from database import get_connection

def check_users():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT userid, role FROM employee_logins LIMIT 10")
    rows = cur.fetchall()
    conn.close()

    if not rows:
        print("❌ No users found in SQLite!")
    else:
        print(f"✅ Found {len(rows)} sample users:")
        for row in rows:
            print(dict(row))

if __name__ == "__main__":
    check_users()
