import os
import time
import requests
import hashlib
from pathlib import Path


CONTROLLER = os.getenv(
    "CONTROLLER_URL",
    "http://localhost:8000"
)

NODE_NAME = os.getenv(
    "NODE_NAME",
    "local-node"
)

STORAGE_PATH = Path(
    os.getenv(
        "STORAGE_PATH",
        "/data/storage"
    )
)


def get_capacity():
    STORAGE_PATH.mkdir(parents=True, exist_ok=True)

    stat = os.statvfs(STORAGE_PATH)

    return {
        "total": stat.f_blocks * stat.f_frsize,
        "free": stat.f_bavail * stat.f_frsize
    }


def register():
    print("Registering node...", flush=True)
    data = {
        "name": NODE_NAME,
        "storage_path": str(STORAGE_PATH),
        "capacity": get_capacity()
    }

    r = requests.post(
        f"{CONTROLLER}/api/nodes/register",
        json=data
        headers={
            "Authorization": f"Bearer {TOKEN}"
                            }
    )

    print(
        "REGISTER:",
        r.text
    )


def heartbeat():

    while True:

        print(
            "Heartbeat",
            NODE_NAME,
            get_capacity()
        )

        time.sleep(30)


if __name__ == "__main__":

    register()
    heartbeat()
