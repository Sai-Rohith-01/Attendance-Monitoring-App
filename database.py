import mysql.connector

def get_connection():
    return mysql.connector.connect(
        host='localhost',
        user='root',
        password='Spattern6dots@',
        database='employee_db'
    )
