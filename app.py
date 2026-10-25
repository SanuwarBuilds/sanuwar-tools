import os
import copy
import base64
import mimetypes
import json
import uuid
import datetime
import secrets
import hmac
import tempfile
from PIL import Image, UnidentifiedImageError
from werkzeug.security import check_password_hash
from werkzeug.utils import secure_filename
import security
from availability import is_public, public_config
import payments
import seo
import monetization
import user_auth
from cover_images import thumbnail_receipt
from download_metadata import utc_now, upload_time, album_metadata
import cloudinary
import cloudinary.uploader
from flask import Flask, request, render_template, session, redirect, jsonify, url_for, send_file, send_from_directory, abort, g, has_request_context
from dotenv import load_dotenv
import utils

load_dotenv()
mimetypes.add_type('image/webp', '.webp')
app = Flask(__name__, static_folder='static/assets', static_url_path='/assets')

# ── Cloudinary setup ───────────────────────────────────────────
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", ""),
    api_key=os.getenv("CLOUDINARY_API_KEY", ""),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", ""),
    secure=True
)

def upload_to_cloudinary(file_storage, resource_type="auto", folder="sanuwar-tools"):
    """Upload a Flask FileStorage to Cloudinary. Returns (url, filename)."""
    filename = secure_filename(file_storage.filename or '')
    extension = os.path.splitext(filename)[1].lower()
    allowed = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.zip', '.apk', '.txt', '.csv', '.mp3', '.mp4', '.json', '.aab'}
    if not filename or extension not in allowed:
        raise ValueError('Unsupported file type')
    if resource_type == 'image':
        if extension not in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}:
            raise ValueError('Choose a PNG, JPEG, WebP or GIF image')
        Image.open(file_storage.stream).verify()
        file_storage.stream.seek(0)
    # Use .stream so Flask FileStorage is read correctly by Cloudinary SDK
    result = cloudinary.uploader.upload(
        file_storage.stream,
        folder=folder,
        resource_type=resource_type,
        use_filename=True,
        unique_filename=True,
        overwrite=False
    )
    return result.get("secure_url", ""), (file_storage.filename or "file")

security.install(app)

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("admin_logged_in"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "unauthorized"}), 401
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return decorated_function

import licensing
licensing.install(app, login_required)

@app.route('/favicon.ico')
def site_favicon():
    return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/x-icon', max_age=0)

@app.route('/apple-touch-icon.png')
def site_touch_icon():
    return send_from_directory(app.static_folder, 'apple-touch-icon.png', max_age=0)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/payment-demo")
def payment_demo():
    return render_template("payment_demo.html")

@app.route("/downloads")
@app.route("/download.html")
def downloads():
    if not (safe_read(TOOLS_CONFIG_REL) or {}).get('downloadPage', {}).get('enabled', True):
        abort(404)
    return render_template("downloads.html", initial_downloads=[payments.public_item(item) for item in public_downloads()])

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        if security.limited(('login', request.remote_addr)):
            response = jsonify(error="Too many attempts. Try again in 15 minutes.")
            response.headers['Retry-After'] = '900'
            return response, 429
        data = request.get_json(silent=True) or {}
        username, password = data.get('username', ''), data.get('password', '')
        expected_user = os.getenv('ADMIN_USER', '')
        password_hash = os.getenv('ADMIN_PASSWORD_HASH', '')
        expected_pass = os.getenv('ADMIN_PASSWORD', '')
        if not expected_user or not (password_hash or len(expected_pass) >= 12):
            return jsonify(error="Admin access needs configuration. Set ADMIN_USER and ADMIN_PASSWORD_HASH (or ADMIN_PASSWORD with at least 12 characters) on the server."), 503
        valid = False
        if isinstance(password, str) and len(password) <= 1024:
            try:
                valid = check_password_hash(password_hash, password) if password_hash else hmac.compare_digest(password.encode('utf-8'), expected_pass.encode('utf-8'))
            except (ValueError, TypeError, AttributeError):
                valid = False
        if isinstance(username, str) and hmac.compare_digest(username.encode('utf-8'), expected_user.encode('utf-8')) and valid:
            session.clear()
            session.permanent = True
            session['admin_logged_in'] = True
            session['csrf_token'] = secrets.token_urlsafe(32)
            return jsonify(success=True)
        return jsonify(error="Invalid username or password"), 401
    return render_template("login.html")

@app.route("/admin")
@login_required
def admin():
    return render_template("admin.html")

@app.route("/admin/logout", methods=["POST"])
def admin_logout():
    session.clear()
    return redirect(url_for("admin_login"))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IS_VERCEL = bool(os.environ.get("VERCEL"))

# On Vercel filesystem is read-only EXCEPT /tmp — copy files there on first use
def get_writable_path(relative_data_path):
    """Returns a writable path. On Vercel uses /tmp, locally uses data/."""
    src = os.path.join(BASE_DIR, relative_data_path)
    if IS_VERCEL:
        dst = os.path.join("/tmp", os.path.basename(relative_data_path))
        if not os.path.exists(dst) and os.path.exists(src):
            import shutil
            shutil.copy2(src, dst)
        return dst
    return src

def github_push(file_rel_path, content_str):
    """Push a file update to GitHub so changes persist across Vercel deployments."""
    try:
        import base64, requests as req
        token = os.getenv("GITHUB_PAT", "")
        user  = os.getenv("GITHUB_USER", "")
        repo  = os.getenv("GITHUB_REPO", "sanuwar-tools")
        if not token or not user:
            return
        api = f"https://api.github.com/repos/{user}/{repo}/contents/{file_rel_path}"
        headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
        # Use the revision read by this mutation, so concurrent saves cannot overwrite it.
        sha = getattr(g, 'catalogue_revisions', {}).get(file_rel_path) if has_request_context() else None
        if sha is None:
            r = req.get(api, headers=headers, timeout=8)
            r.raise_for_status()
            sha = r.json().get("sha", "")
        payload = {"message": f"auto: update {file_rel_path}",
                   "content": base64.b64encode(content_str.encode()).decode()}
        if sha:
            payload["sha"] = sha
        response = req.put(api, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        app.logger.exception("Persistent configuration write failed")
        raise RuntimeError("Could not persist changes to GitHub; retry the save") from e

def safe_read(rel_path):
    if IS_VERCEL and os.getenv('GITHUB_PAT') and os.getenv('GITHUB_USER'):
        # /tmp and bundled JSON differ between serverless instances. Never use them
        # as the publication authority: a disabled entry could otherwise reappear.
        cached = getattr(g, 'catalogue_records', {}) if has_request_context() else {}
        if rel_path in cached:
            return copy.deepcopy(cached[rel_path])
        try:
            import requests as req
            repo = os.getenv('GITHUB_REPO', 'sanuwar-tools')
            response = req.get(f"https://api.github.com/repos/{os.environ['GITHUB_USER']}/{repo}/contents/{rel_path}",
                headers={'Authorization': 'Bearer ' + os.environ['GITHUB_PAT'],
                         'Accept': 'application/vnd.github+json', 'Cache-Control': 'no-cache'}, timeout=(3, 8))
            response.raise_for_status()
            remote = response.json()
            data = json.loads(base64.b64decode(remote['content']))
            if has_request_context():
                if not hasattr(g, 'catalogue_records'):
                    g.catalogue_records = {}; g.catalogue_revisions = {}
                g.catalogue_records[rel_path] = data
                g.catalogue_revisions[rel_path] = remote['sha']
            return copy.deepcopy(data)
        except Exception as error:
            app.logger.error('Catalogue refresh unavailable: %s', type(error).__name__)
            if has_request_context():
                abort(503, description='Catalogue temporarily unavailable. Please retry.')
            raise RuntimeError('Catalogue temporarily unavailable') from error
    path = get_writable_path(rel_path)
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as e:
        print(f"Read error {path}: {e}")
        return None

def safe_write(rel_path, data):
    path = get_writable_path(rel_path)
    content_str = json.dumps(data, indent=2)
    # Verify remote persistence before acknowledging an admin save.
    if IS_VERCEL and not (os.getenv('GITHUB_PAT') and os.getenv('GITHUB_USER')):
        raise RuntimeError('Persistent saves require GITHUB_PAT and GITHUB_USER on Vercel')
    github_push(rel_path, content_str)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=os.path.dirname(path), suffix='.tmp')
    try:
        with os.fdopen(fd, 'w') as handle:
            handle.write(content_str)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)

utils.safe_reader = safe_read
utils.safe_writer = safe_write

TOOLS_CONFIG_REL = "data/tools.config.json"
DOWNLOADS_REL    = "data/downloads.json"

@app.route("/tools.config.json")
def serve_config():
    data = safe_read(TOOLS_CONFIG_REL)
    if data is None:
        data = {"tools": [], "categories": ["All"], "site": {}, "socialLinks": {}, "widgets": []}
    return jsonify(public_config(data))

@app.context_processor
def site_context():
    return {'public_config': public_config(safe_read(TOOLS_CONFIG_REL)), 'now_year': datetime.datetime.now().year}

@app.route('/api/admin/tools.config')
@login_required
def admin_tools_config():
    return jsonify(safe_read(TOOLS_CONFIG_REL) or {'tools': [], 'categories': ['All'], 'site': {}})

@app.route("/api/tools.config", methods=["POST"])
@login_required
def update_config():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "no data"}), 400
        safe_write(TOOLS_CONFIG_REL, data)
        return jsonify({"success": True})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/admin/store-apps", methods=["GET"])
@login_required
def get_store_apps():
    config = utils.load_config()
    return jsonify(config.get("store_apps", []))

@app.route("/api/admin/store-apps", methods=["POST"])
@login_required
def add_store_app():
    try:
        data = request.json
        config = utils.load_config()
        apps = config.get("store_apps", [])
        data["id"] = str(uuid.uuid4())
        apps.append(data)
        config["store_apps"] = apps
        utils.save_config(config)
        return jsonify({"success": True, "app": data})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/admin/store-apps/<app_id>", methods=["PUT"])
@login_required
def update_store_app(app_id):
    try:
        data = request.json
        config = utils.load_config()
        apps = config.get("store_apps", [])
        for app in apps:
            if app.get("id") == app_id:
                app.update({key:value for key,value in data.items() if key != "id"})
                break
        else:
            return jsonify(error="App not found"), 404
        utils.save_config(config)
        return jsonify({"success": True})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/admin/store-apps/<app_id>", methods=["DELETE"])
@login_required
def delete_store_app(app_id):
    try:
        config = utils.load_config()
        apps = config.get("store_apps", [])
        config["store_apps"] = [a for a in apps if a.get("id") != app_id]
        utils.save_config(config)
        return jsonify({"success": True})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/admin/upload", methods=["POST"])
@login_required
def upload_file():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No file"}), 400
        file = request.files['image']
        # Covers are small public thumbnails; saving them with the catalogue avoids
        # lost covers when an external upload service is not configured or unavailable.
        return jsonify(thumbnail_receipt(file.stream, file.filename or "cover"))
    except (ValueError, UnidentifiedImageError, Image.DecompressionBombError):
        return jsonify(error="Unsupported or invalid file. Choose a supported file up to 32 MB."), 400
    except Exception:
        app.logger.exception("Upload failed")
        return jsonify(error="Upload unavailable. Check Cloudinary configuration and try again."), 500

# ════════════════════════════════════════════
# DOWNLOAD HUB API
# ════════════════════════════════════════════

DOWNLOADS_FILE = get_writable_path(DOWNLOADS_REL)

def load_downloads():
    data = safe_read(DOWNLOADS_REL)
    return data if isinstance(data, list) else []

def save_downloads(items):
    safe_write(DOWNLOADS_REL, items)

def public_downloads():
    if (safe_read(TOOLS_CONFIG_REL) or {}).get('downloadPage', {}).get('enabled', True) is not True:
        return []
    return [item for item in load_downloads() if is_public(item)]


@app.route('/api/admin/content/<kind>/<identity>/availability', methods=['PATCH'])
@login_required
def set_content_availability(kind, identity):
    enabled = (request.get_json() or {}).get('enabled')
    if type(enabled) is not bool:
        return jsonify(error='enabled must be true or false'), 400
    if kind == 'tools':
        record = safe_read(TOOLS_CONFIG_REL) or {}
        items = record.get('tools', [])
    elif kind == 'downloads':
        items = load_downloads()
    elif kind in ('widgets', 'store'):
        record = utils.load_config()
        items = record.get('widgets' if kind == 'widgets' else 'store_apps', [])
    else:
        return jsonify(error='Content not found'), 404
    item = next((item for item in items if item.get('id') == identity), None)
    if item is None:
        return jsonify(error='Content not found'), 404
    # Normalize both legacy and current flags so re-enabling always works.
    item['enabled'] = enabled
    if kind == 'tools' or 'visible' in item:
        item['visible'] = enabled
    try:
        if kind == 'tools':
            safe_write(TOOLS_CONFIG_REL, record)
        elif kind == 'downloads':
            save_downloads(items)
        else:
            utils.save_config(record)
    except Exception:
        app.logger.exception('Could not save availability')
        return jsonify(error='Could not save availability. Please retry.'), 500
    return jsonify(success=True, item=item)


@app.route("/api/downloads_data")
def api_downloads_data():
    """Public endpoint — returns all download items."""
    items = public_downloads()
    return jsonify([payments.public_item(item) for item in items])

@app.route("/api/admin/downloads")
@login_required
def admin_downloads():
    return jsonify(load_downloads())

@app.route("/api/add_item", methods=["POST"])
@login_required
def api_add_item():
    """Add a new download item."""
    try:
        data = request.json or {}
        if not data.get("title"):
            return jsonify({"error": "title is required"}), 400
        items = load_downloads()
        now = utc_now()
        new_item = {
            "id": "item_" + str(uuid.uuid4())[:8],
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "category": data.get("category", "General"),
            "image": data.get("image", ""),
            "link": data.get("link", ""),
            "version": data.get("version", ""),
            "is_album": bool(data.get("is_album", False)),
            "album_files": album_metadata(data.get("album_files", []), now=now),
            "created_at": now,
            "updated_at": now,
            "is_new": True,
            "enabled": data.get("enabled", True),
        }
        if upload_time(data.get('uploaded_at')):
            new_item['uploaded_at'] = upload_time(data['uploaded_at'])
        new_item['pricing'] = payments.pricing(data)
        if data.get('asset'):
            new_item['asset'] = data['asset']
        payments.protect_item(new_item)
        items.insert(0, new_item)  # newest first
        save_downloads(items)
        return jsonify({"success": True, "item": new_item})
    except ValueError as e:
        return jsonify(error=str(e)), 400
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/update_item", methods=["PUT"])
@login_required
def api_update_item():
    """Update an existing download item by ID."""
    try:
        data = request.json or {}
        item_id = data.get("id")
        if not item_id:
            return jsonify({"error": "id is required"}), 400
        items = load_downloads()
        found = False
        for i, item in enumerate(items):
            if item.get("id") == item_id:
                # Preserve ID, update the rest
                items[i] = {
                    **item,
                    "id": item_id,
                    "title": data.get("title", item.get("title", "")),
                    "description": data.get("description", item.get("description", "")),
                    "category": data.get("category", item.get("category", "General")),
                    "image": data.get("image", item.get("image", "")),
                    "link": data.get("link", item.get("link", "")),
                    "version": data.get("version", item.get("version", "")),
                    "is_album": bool(data.get("is_album", item.get("is_album", False))),
                    "album_files": album_metadata(data.get("album_files", item.get("album_files", [])), item.get("album_files", [])),
                    "updated_at": utc_now(),
                    "is_new": item.get("is_new", False),
                    "enabled": data.get("enabled", item.get("enabled", True)),
                }
                if data.get('link', item.get('link')) != item.get('link'):
                    items[i].pop('uploaded_at', None)
                if upload_time(data.get('uploaded_at')) and (data.get('link') != item.get('link') or data.get('asset') != item.get('asset')):
                    items[i]['uploaded_at'] = upload_time(data['uploaded_at'])
                items[i]['pricing'] = payments.pricing(data, item)
                if data.get('link', item.get('link')) != item.get('link') and 'asset' not in data:
                    items[i].pop('asset', None)
                if 'asset' in data:
                    items[i]['asset'] = data['asset']
                if "enabled" in data and "visible" in item:
                    items[i]["visible"] = data["enabled"]
                payments.protect_item(items[i])
                found = True
                break
        if not found:
            return jsonify({"error": "Item not found"}), 404
        save_downloads(items)
        return jsonify({"success": True, "item": items[i]})
    except ValueError as e:
        return jsonify(error=str(e)), 400
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/delete_item/<item_id>", methods=["DELETE"])
@login_required
def api_delete_item(item_id):
    """Delete a download item by ID."""
    try:
        items = load_downloads()
        new_items = [i for i in items if i.get("id") != item_id]
        if len(new_items) == len(items):
            return jsonify({"error": "Item not found"}), 404
        save_downloads(new_items)
        return jsonify({"success": True})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/downloads/categories", methods=["GET"])
def api_download_categories():
    """Get distinct categories from downloads."""
    items = public_downloads()
    cats = list(set(i.get("category", "General") for i in items if i.get("category")))
    cats.sort()
    return jsonify(cats)

@app.route("/api/admin/upload-download-file", methods=["POST"])
@login_required
def upload_download_file():
    """Upload any file to Cloudinary for the download hub."""
    try:
        key = 'file' if 'file' in request.files else ('image' if 'image' in request.files else None)
        if not key:
            return jsonify({"error": "No file in request"}), 400
        file = request.files[key]
        original_name = file.filename or "upload"
        # Images go to image folder, everything else as raw
        ext = os.path.splitext(original_name)[1].lower()
        is_image = ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp')
        rtype = "image" if is_image else "raw"
        file.stream.seek(0, 2)
        size = file.stream.tell()
        file.stream.seek(0)
        if request.form.get('private') == '1':
            filename = secure_filename(original_name)
            if ext not in {'.jpg','.jpeg','.png','.webp','.gif','.pdf','.zip','.apk','.txt','.csv','.mp3','.mp4','.json','.aab'}:
                raise ValueError('Unsupported file type')
            if is_image:
                Image.open(file.stream).verify()
                file.stream.seek(0)
            result = cloudinary.uploader.upload(file.stream, folder='sanuwar-tools/paid',
                resource_type=rtype, type='authenticated', public_id=uuid.uuid4().hex + (ext if rtype == 'raw' else ''),
                use_filename=False, unique_filename=True, overwrite=False)
            asset = {key: result.get(key, '') for key in ('public_id', 'resource_type', 'format', 'type')}
            if not payments.private_asset(asset):
                raise ValueError('Private upload was not confirmed by Cloudinary')
            return jsonify(url='', filename=original_name, asset=asset, uploaded_at=utc_now(), size=size)
        url, fname = upload_to_cloudinary(file, resource_type=rtype, folder="sanuwar-tools/downloads")
        return jsonify({"url": url, "filename": original_name, "uploaded_at": utc_now(), "size": size})
    except (ValueError, UnidentifiedImageError, Image.DecompressionBombError):
        return jsonify(error="Unsupported or invalid file. Choose a supported file up to 32 MB."), 400
    except Exception:
        app.logger.exception("Upload failed")
        return jsonify(error="Upload unavailable. Check Cloudinary configuration and try again."), 500

# ============================================================
# --- WIDGET ROUTES (Home Screen Builder) ---
# ============================================================

@app.route("/api/widgets", methods=["GET"])
def api_widgets_public():
    """Public — returns all enabled widgets sorted by order."""
    config = utils.load_config()
    widgets = [w for w in config.get("widgets", []) if w.get("enabled") is True and is_public(w)]
    widgets.sort(key=lambda x: x.get("order", 0))
    return jsonify(widgets)

@app.route("/api/admin/widgets", methods=["GET"])
@login_required
def api_admin_widgets_get():
    config = utils.load_config()
    widgets = config.get("widgets", [])
    widgets.sort(key=lambda x: x.get("order", 0))
    return jsonify(widgets)

@app.route("/api/admin/widgets", methods=["POST"])
@login_required
def api_admin_widgets_add():
    try:
        data = request.json
        if not data.get("type"):
            return jsonify({"error": "type is required"}), 400
        config = utils.load_config()
        widgets = config.get("widgets", [])
        new_widget = {
            "id": str(uuid.uuid4()),
            "type": data["type"],
            "enabled": bool(data.get("enabled", True)),
            "order": len(widgets),
            "data": data.get("data", {}),
            "created_at": datetime.datetime.now().isoformat()
        }
        widgets.append(new_widget)
        config["widgets"] = widgets
        utils.save_config(config)
        return jsonify({"success": True, "widget": new_widget})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/admin/widgets/<widget_id>", methods=["PUT"])
@login_required
def api_admin_widgets_update(widget_id):
    try:
        data = request.json
        config = utils.load_config()
        widgets = config.get("widgets", [])
        w = next((x for x in widgets if x["id"] == widget_id), None)
        if not w:
            return jsonify({"error": "not_found"}), 404
        if "enabled" in data:
            w["enabled"] = data["enabled"]
            if "visible" in w: w["visible"] = data["enabled"]
        if "order" in data:   w["order"]   = int(data["order"])
        if "data" in data:    w["data"]    = data["data"]
        config["widgets"] = widgets
        utils.save_config(config)
        return jsonify({"success": True, "widget": w})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/admin/widgets/<widget_id>", methods=["DELETE"])
@login_required
def api_admin_widgets_delete(widget_id):
    try:
        config = utils.load_config()
        config["widgets"] = [w for w in config.get("widgets", []) if w["id"] != widget_id]
        utils.save_config(config)
        return jsonify({"success": True})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/admin/widgets/reorder", methods=["POST"])
@login_required
def api_admin_widgets_reorder():
    try:
        order = request.json.get("order", [])  # list of widget IDs in new order
        config = utils.load_config()
        widgets = config.get("widgets", [])
        id_to_pos = {wid: idx for idx, wid in enumerate(order)}
        for w in widgets:
            if w["id"] in id_to_pos:
                w["order"] = id_to_pos[w["id"]]
        config["widgets"] = widgets
        utils.save_config(config)
        return jsonify({"success": True})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

@app.route("/api/widgets/<widget_id>/vote", methods=["POST"])
def api_widget_vote(widget_id):
    """Session-protected poll voting — a user can only vote once."""
    if security.limited(('vote', request.remote_addr), maximum=20, window=60):
        return jsonify(error='Please wait before voting again'), 429
    try:
        data = request.json
        option_id = data.get("option_id")
        if not option_id:
            return jsonify({"error": "option_id required"}), 400
        voted_key = f"voted_{widget_id}"
        if session.get(voted_key):
            return jsonify({"error": "already_voted"}), 403
        config = utils.load_config()
        widgets = config.get("widgets", [])
        w = next((x for x in widgets if x["id"] == widget_id and x["type"] == "poll" and x.get("enabled") is True and is_public(x)), None)
        if not w:
            return jsonify({"error": "poll_not_found"}), 404
        options = w["data"].get("options", [])
        opt = next((o for o in options if o["id"] == option_id), None)
        if not opt:
            return jsonify({"error": "option_not_found"}), 404
        opt["votes"] = opt.get("votes", 0) + 1
        config["widgets"] = widgets
        utils.save_config(config)
        session[voted_key] = True
        return jsonify({"success": True, "options": options})
    except Exception as e:
        app.logger.exception("Operation failed")
        return jsonify({"error": "Could not save or upload. Check server configuration and try again."}), 500

payments.register(app, public_downloads, login_required)
seo.install(app, lambda: safe_read(TOOLS_CONFIG_REL))
monetization.install(app)
user_auth.install(app)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=os.getenv('FLASK_DEBUG') == '1')
