#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def public_fixture() -> dict:
    return {
        "memberships": [
            {"user_id": "user_alpha", "org_id": "org_alpha", "role": "member", "status": "active"},
            {"user_id": "user_admin", "org_id": "org_alpha", "role": "admin", "status": "active"},
            {"user_id": "user_alpha", "org_id": "org_beta", "role": "member", "status": "removed"},
        ]
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="candidate/fixtures/public/memberships.json")
    args = parser.parse_args()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(public_fixture(), indent=2) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
