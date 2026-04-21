import os
import json
import uuid
import datetime
import cloudinary
import cloudinary.uploader
from flask import Flask, request, render_template, session, redirect, jsonify, url_for, send_file, send_from_directory
from dotenv import load_dotenv
import utils

load_dotenv()
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

app.secret_key = "SANUWAR_TOOLS_SECRET"

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

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/downloads")
def downloads():
    return render_template("downloads.html")

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        data = request.json or {}
        username = data.get("username", "")
        password = data.get("password", "")
        
        expected_user = os.getenv("ADMIN_USER", "admin")
        expected_pass = os.getenv("ADMIN_PASSWORD", "admin")
        
        if username == expected_user and password == expected_pass:
            session["admin_logged_in"] = True
            return jsonify({"success": True})
        return jsonify({"error": "Invalid credentials"}), 401
    return render_template("login.html")

@app.route("/admin")
@login_required
def admin():
    return render_template("admin.html")

@app.route("/admin/logout")
def admin_logout():
    session.pop("admin_logged_in", None)
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
        # Get current SHA
        r = req.get(api, headers=headers, timeout=8)
        sha = r.json().get("sha", "") if r.ok else ""
        payload = {"message": f"auto: update {file_rel_path}",
                   "content": base64.b64encode(content_str.encode()).decode()}
        if sha:
            payload["sha"] = sha
        req.put(api, json=payload, headers=headers, timeout=10)
    except Exception as e:
        print(f"GitHub push warning: {e}")

def safe_read(rel_path):
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
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(content_str)
    except Exception as e:
        print(f"Write error {path}: {e}")
    # Always push to GitHub so it persists on Vercel across cold starts
    github_push(rel_path, content_str)

TOOLS_CONFIG_REL = "data/tools.config.json"
DOWNLOADS_REL    = "data/downloads.json"

@app.route("/tools.config.json")
def serve_config():
    data = safe_read(TOOLS_CONFIG_REL)
    if data is None:
        data = {"tools": [], "categories": ["All"], "site": {}, "socialLinks": {}, "widgets": []}
    return jsonify(data)

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
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/store-apps", methods=["GET"])
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
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/store-apps/<app_id>", methods=["PUT"])
@login_required
def update_store_app(app_id):
    try:
        data = request.json
        config = utils.load_config()
        apps = config.get("store_apps", [])
        for app in apps:
            if app.get("id") == app_id:
                app.update(data)
                break
        utils.save_config(config)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/upload", methods=["POST"])
@login_required
def upload_file():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No file"}), 400
        file = request.files['image']
        url, _ = upload_to_cloudinary(file, resource_type="image", folder="sanuwar-tools/thumbnails")
        return jsonify({"url": url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ════════════════════════════════════════════
# DOWNLOAD HUB API
# ════════════════════════════════════════════

DOWNLOADS_FILE = get_writable_path(DOWNLOADS_REL)

def load_downloads():
    data = safe_read(DOWNLOADS_REL)
    return data if isinstance(data, list) else []

def save_downloads(items):
    safe_write(DOWNLOADS_REL, items)

@app.route("/api/downloads_data")
def api_downloads_data():
    """Public endpoint — returns all download items."""
    items = load_downloads()
    return jsonify(items)

@app.route("/api/add_item", methods=["POST"])
@login_required
def api_add_item():
    """Add a new download item."""
    try:
        data = request.json or {}
        if not data.get("title"):
            return jsonify({"error": "title is required"}), 400
        items = load_downloads()
        new_item = {
            "id": "item_" + str(uuid.uuid4())[:8],
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "category": data.get("category", "General"),
            "image": data.get("image", ""),
            "link": data.get("link", ""),
            "version": data.get("version", ""),
            "is_album": bool(data.get("is_album", False)),
            "album_files": data.get("album_files", []),
            "is_new": True,
        }
        items.insert(0, new_item)  # newest first
        save_downloads(items)
        return jsonify({"success": True, "item": new_item})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
                    "id": item_id,
                    "title": data.get("title", item.get("title", "")),
                    "description": data.get("description", item.get("description", "")),
                    "category": data.get("category", item.get("category", "General")),
                    "image": data.get("image", item.get("image", "")),
                    "link": data.get("link", item.get("link", "")),
                    "version": data.get("version", item.get("version", "")),
                    "is_album": bool(data.get("is_album", item.get("is_album", False))),
                    "album_files": data.get("album_files", item.get("album_files", [])),
                    "is_new": item.get("is_new", False),
                }
                found = True
                break
        if not found:
            return jsonify({"error": "Item not found"}), 404
        save_downloads(items)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"error": str(e)}), 500

@app.route("/api/downloads/categories", methods=["GET"])
def api_download_categories():
    """Get distinct categories from downloads."""
    items = load_downloads()
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
        is_image = ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg')
        rtype = "image" if is_image else "raw"
        url, fname = upload_to_cloudinary(file, resource_type=rtype, folder="sanuwar-tools/downloads")
        return jsonify({"url": url, "filename": original_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ============================================================
# --- WIDGET ROUTES (Home Screen Builder) ---
# ============================================================

@app.route("/api/widgets", methods=["GET"])
def api_widgets_public():
    """Public — returns all enabled widgets sorted by order."""
    config = utils.load_config()
    widgets = [w for w in config.get("widgets", []) if w.get("enabled")]
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
        return jsonify({"error": str(e)}), 500

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
        if "enabled" in data: w["enabled"] = bool(data["enabled"])
        if "order" in data:   w["order"]   = int(data["order"])
        if "data" in data:    w["data"]    = data["data"]
        config["widgets"] = widgets
        utils.save_config(config)
        return jsonify({"success": True, "widget": w})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/widgets/<widget_id>", methods=["DELETE"])
@login_required
def api_admin_widgets_delete(widget_id):
    try:
        config = utils.load_config()
        config["widgets"] = [w for w in config.get("widgets", []) if w["id"] != widget_id]
        utils.save_config(config)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"error": str(e)}), 500

@app.route("/api/widgets/<widget_id>/vote", methods=["POST"])
def api_widget_vote(widget_id):
    """Session-protected poll voting — a user can only vote once."""
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
        w = next((x for x in widgets if x["id"] == widget_id and x["type"] == "poll"), None)
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
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
