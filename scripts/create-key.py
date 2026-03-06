#!/usr/bin/env python3
import asyncio
import hashlib
import secrets
import argparse
import sys
import os

# Add the shared package source to sys.path (src-layout: shared/src/shared/)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'shared', 'src')))

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env')))

from shared.database import async_session_maker
from shared.models import GatewayKey
from sqlalchemy import select

async def create_key(label: str, scopes: list[str], token_type: str = "api"):
    raw_token = "sk-" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    
    async with async_session_maker() as session:
        # If admin, revoke old admin keys first
        if token_type == "admin":
            result = await session.execute(select(GatewayKey))
            all_keys = result.scalars().all()
            for k in all_keys:
                if "admin" in k.scopes:
                    await session.delete(k)
            await session.commit()
            
            # Write raw token to .admin_token file for CLI retrieval
            admin_token_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.admin_token'))
            try:
                with open(admin_token_path, "w") as f:
                    f.write(raw_token)
            except Exception as e:
                print(f"Warning: Could not save .admin_token file: {e}")

        new_key = GatewayKey(
            label=label,
            key_hash=key_hash,
            raw_token=raw_token,
            scopes=scopes,
            enabled=True
        )
        session.add(new_key)
        await session.commit()
        await session.refresh(new_key)
        
        print(f"\n[SUCCESS] {token_type.capitalize()} Gateway Key Created Successfully!")
        print(f"Label: {new_key.label}")
        print(f"Key Hash: {new_key.key_hash}")
        print("\n" + "="*60)
        print(f"RAW TOKEN:\n{raw_token}")
        print("="*60 + "\n")
        print("[WARNING] SAVE THIS TOKEN NOW. It will never be shown again in plaintext.")
        print("\nTo use with LLMWAY, set your environment variable:")
        print(f"  export LLMWAY_API_KEY={raw_token}\n")

    from shared.database import engine
    await engine.dispose()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a new Gateway API Key")
    parser.add_argument("label", help="A descriptive label for the key (e.g. 'llmway-prod')")
    parser.add_argument("--scopes", nargs="*", default=[], help="Optional list of scopes")
    parser.add_argument("--type", choices=["admin", "api"], default="api", help="Type of token to create")
    
    args = parser.parse_args()
    
    # Ensure scopes align with type
    scopes = args.scopes.copy()
    if args.type == "admin" and "admin" not in scopes:
        scopes.append("admin")
    elif args.type == "api" and "api" not in scopes:
        scopes.append("api")
        
    asyncio.run(create_key(args.label, scopes, args.type))
