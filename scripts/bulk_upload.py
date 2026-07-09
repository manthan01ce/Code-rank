
import sys
import os
import pandas as pd
import psycopg2
import string
import random
import bcrypt
import json
from datetime import datetime

# Database connection URL - should be passed as env or arg
# For now we'll try to read it from .env.local if possible
def get_db_url():
    # In a real scenario, this would be more robust
    # For this task, we can assume it's set in the environment or we can hardcode for the agent run
    return os.environ.get('DATABASE_URL')

def generate_random_password(length=10):
    chars = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(random.choice(chars) for _ in range(length))

def hash_password(password):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def bulk_upload(file_path, role):
    db_url = get_db_url()
    if not db_url:
        print(json.dumps({"error": "DATABASE_URL environment variable is not set"}))
        return

    try:
        # Load file
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file_path.endswith('.xlsx'):
            df = pd.read_excel(file_path)
        else:
            print(json.dumps({"error": "Unsupported file format. Please use .csv or .xlsx"}))
            return

        # Expected columns: Name, Email
        # Flexible handling of column names
        name_col = next((col for col in df.columns if 'name' in col.lower()), None)
        email_col = next((col for col in df.columns if 'email' in col.lower()), None)

        if not name_col or not email_col:
            print(json.dumps({"error": f"Columns 'Name' and 'Email' not found in file. Found: {list(df.columns)}"}))
            return

        results = []
        skipped = []
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        for index, row in df.iterrows():
            name = str(row[name_col]).strip()
            email = str(row[email_col]).strip()
            
            # Skip invalid entries
            if not name or not email or '@' not in email:
                skipped.append({
                    "name": name if name else "N/A",
                    "email": email if email else "N/A",
                    "reason": "Invalid name or email format"
                })
                continue

            # Check if user already exists
            cur.execute("SELECT id, name, role, status FROM users WHERE email = %s", (email,))
            existing_user = cur.fetchone()
            
            if existing_user:
                skipped.append({
                    "name": name,
                    "email": email,
                    "reason": f"User already exists (ID: {existing_user[0]}, Name: {existing_user[1]}, Role: {existing_user[2]}, Status: {existing_user[3]})"
                })
                continue

            password = generate_random_password()
            hashed_pw = hash_password(password)

            try:
                cur.execute(
                    "INSERT INTO users (name, email, password, role, status) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (name, email, hashed_pw, role, 'active')
                )
                inserted = cur.fetchone()
                if inserted:
                    results.append({"name": name, "email": email, "password": password})
                    conn.commit()
            except Exception as e:
                # Skip errors for specific rows
                conn.rollback()
                skipped.append({
                    "name": name,
                    "email": email,
                    "reason": f"Database error: {str(e)}"
                })
                continue

        cur.close()
        conn.close()

        print(json.dumps({
            "success": True, 
            "count": len(results), 
            "users": results,
            "skipped": skipped,
            "skippedCount": len(skipped)
        }))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python bulk_upload.py <file_path> <role>"}))
    else:
        file_path = sys.argv[1]
        role = sys.argv[2]
        bulk_upload(file_path, role)
