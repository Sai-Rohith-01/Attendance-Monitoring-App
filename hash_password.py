import hashlib

password = "admin123"
hashed = hashlib.sha256(password.encode()).hexdigest()
print("Hashed password:", hashed)
