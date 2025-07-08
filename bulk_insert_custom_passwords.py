import pandas as pd
import hashlib
from database import get_connection  # Make sure this connects to your DB

# Load Excel
df = pd.read_excel("data\dummy_data.xlsx")

# Get unique user IDs
unique_userids = df['Userid'].dropna().astype(str).unique()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# Connect to DB
conn = get_connection()
cursor = conn.cursor()

for userid in unique_userids:
    plain_password = f"userpass{userid}"  # 👈 custom password
    hashed = hash_password(plain_password)
    name = f"Employee {userid}"
    role = "user"

    cursor.execute(
        "INSERT IGNORE INTO employee_logins (userid, password_hash, name, role) VALUES (%s, %s, %s, %s)",
        (userid, hashed, name, role)
    )

    print(f"Inserted: {userid} | Password: {plain_password}")

import csv

with open('user_credentials.csv', 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['UserID', 'PlainPassword'])
    for userid in unique_userids:
        writer.writerow([userid, f"userpass{userid}"])

conn.commit()
conn.close()

print(f"✅ Finished inserting {len(unique_userids)} users.")
