import os
import json
import uuid
import datetime
from flask import Flask, request, render_template, session, redirect, jsonify, url_for, send_file, send_from_directory
from dotenv import load_dotenv
import utils

load_dotenv()
app = Flask(__name__, static_folder='static/assets', static_url_path='/assets')
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
TOOLS_CONFIG_PATH = os.path.join(BASE_DIR, "data", "tools.config.json")

@app.route("/tools.config.json")
def serve_config():
    try:
        with open(TOOLS_CONFIG_PATH, "r") as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        # Return empty valid config so frontend doesn't break
        return jsonify({"tools": [], "categories": ["All"], "site": {}, "socialLinks": {}, "widgets": []})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/tools.config", methods=["POST"])
@login_required
def update_config():
    try:
        data = request.json
        os.makedirs(os.path.dirname(TOOLS_CONFIG_PATH), exist_ok=True)
        with open(TOOLS_CONFIG_PATH, "w") as f:
            json.dump(data, f, indent=2)
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
        os.makedirs('static/assets/thumbnails', exist_ok=True)
        filename = f"{uuid.uuid4()}_{file.filename}"
        filepath = os.path.join('static/assets/thumbnails', filename)
        file.save(filepath)
        return jsonify({"url": f"/assets/thumbnails/{filename}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ════════════════════════════════════════════
# DOWNLOAD HUB API
# ════════════════════════════════════════════

DOWNLOADS_FILE = "data/downloads.json"

def load_downloads():
    """Load all download items from JSON file."""
    if not os.path.exists(DOWNLOADS_FILE):
        return []
    try:
        with open(DOWNLOADS_FILE, "r") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []

def save_downloads(items):
    """Persist download items list to JSON file."""
    os.makedirs("data", exist_ok=True)
    with open(DOWNLOADS_FILE, "w") as f:
        json.dump(items, f, indent=2)

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
    """Upload a file for the download hub (image or file attachment)."""
    try:
        key = 'file' if 'file' in request.files else ('image' if 'image' in request.files else None)
        if not key:
            return jsonify({"error": "No file in request"}), 400
        file = request.files[key]
        os.makedirs('static/assets/uploads', exist_ok=True)
        ext = os.path.splitext(file.filename)[1] if file.filename else ''
        filename = str(uuid.uuid4()) + ext
        filepath = os.path.join('static', 'assets', 'uploads', filename)
        file.save(filepath)
        return jsonify({"url": f"/assets/uploads/{filename}", "filename": file.filename})
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
