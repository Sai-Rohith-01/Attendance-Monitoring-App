# 
import sqlite3
import os

# Path to SQLite DB file
DB_PATH = os.path.join(os.path.dirname(__file__), "employee.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # allows accessing columns by name
    return conn
