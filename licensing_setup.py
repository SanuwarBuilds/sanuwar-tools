"""Explicit database schema setup. Never print secrets or save licenses in public JSON."""
import argparse
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
import base64

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--generate-key',type=Path);p.add_argument('--init-db',action='store_true');args=p.parse_args()
    if args.generate_key:
        if args.generate_key.exists():raise SystemExit('Key already exists; refusing to overwrite')
        key=ec.generate_private_key(ec.SECP256R1());args.generate_key.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        with args.generate_key.open('x') as f:f.write(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode())
        args.generate_key.chmod(0o600)
        print('Public verification key (safe to embed in APK):',base64.b64encode(key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)).decode())
    if args.init_db:
        from dotenv import load_dotenv
        load_dotenv()
        from licensing import configured_store
        configured_store().initialize();print('Private license schema initialized')
