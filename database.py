import os
import mysql.connector

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),     # use env var or fallback to localhost
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "Spattern6dots@"),
        database=os.getenv("DB_NAME", "employee_db")
    )

