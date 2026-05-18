#!/usr/bin/env python3
"""Push current branch to origin using a GitHub PAT."""

import getpass
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

# Always run git from the repo root, regardless of where the script is called from
REPO_ROOT = Path(__file__).resolve().parent.parent
os.chdir(REPO_ROOT)


def push(branch: str = "main") -> None:
    token = getpass.getpass("GitHub token: ")
    if not token.strip():
        print("No token entered.")
        sys.exit(1)

    encoded = quote(token.strip(), safe="")
    remote_url = f"https://{encoded}@github.com/sreme19/pocket-dating-coach.git"

    result = subprocess.run(
        [
            "git",
            "-c", "credential.https://github.com.helper=",
            "push", remote_url, branch,
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        print(f"Pushed {branch} successfully.")
    else:
        print(result.stderr.strip())
        sys.exit(result.returncode)


if __name__ == "__main__":
    branch = sys.argv[1] if len(sys.argv) > 1 else "main"
    push(branch)
