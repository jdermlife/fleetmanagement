from sqlalchemy import create_engine
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

print("DATABASE_URL:")
print(DATABASE_URL)

try:
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "sslmode": "require"
        }
    )

    connection = engine.connect()

    print("SUCCESSFULLY CONNECTED TO NEON")

    connection.close()

except Exception as e:
    print("ERROR:")
    print(e)