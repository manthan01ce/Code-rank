
import os
import psycopg2
from dotenv import load_dotenv

# Note: In a real scenario, we'd use environment variables
DATABASE_URL = "postgresql://neondb_owner:npg_xfyu3nXC9EeJ@ep-shy-star-a4cmtjl2-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT version();")
    record = cur.fetchone()
    print("You are connected to - ", record, "\n")
    cur.close()
    conn.close()
except (Exception, psycopg2.Error) as error:
    print("Error while connecting to PostgreSQL", error)
