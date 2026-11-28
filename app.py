import os
import re
import copy
import base64
import mimetypes
import json
import uuid
import datetime
import secrets
import hmac
import hashlib
import tempfile
import time
import requests
from PIL import Image, UnidentifiedImageError
from werkzeug.security import check_password_hash
from werkzeug.utils import secure_filename
import security
from availability import is_public, public_config
import payments
import seo
from tool_guides import API_STUDIO_HELP, GUIDES, STUDY_TOOL_HELP
import monetization
import user_auth
import visitor_analytics
from cover_images import thumbnail_receipt
from download_metadata import utc_now, upload_time, album_metadata, download_size
import cloudinary
import cloudinary.uploader
from flask import Flask, request, render_template, session, redirect, jsonify, url_for, send_file, send_from_directory, abort, g, has_request_context, make_response
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
    raw = safe_read(TOOLS_CONFIG_REL)
    config = public_config(raw if isinstance(raw, dict) else {})
    catalog = load_tool_catalog()
    configured_routes = {item.get('route') for item in config.get('tools', [])}
    config['tools'] = [*config.get('tools', []),
                       *(card for card in browser_tool_cards(catalog) if card['route'] not in configured_routes)]
    downloads = [public_download_item(item) for item in public_downloads()]
    from urllib.parse import urlsplit
    for item in downloads:
        extension = os.path.splitext(urlsplit(item.get('link') or '').path)[1][1:].upper()
        item['home_file_type'] = ('ALBUM' if item.get('is_album') else
                                  extension if re.fullmatch(r'[A-Z0-9]{2,8}', extension) else item.get('category') or 'FILE')
    featured_order = {'remote': 0, 'ludo king': 1, 'remote controller guide bangla': 2}
    home_downloads = sorted(downloads, key=lambda item: featured_order.get(str(item.get('title', '')).lower(), 3))[:3]
    return render_template("index.html", catalog=catalog, public_config=config, guides=GUIDES,
                           initial_downloads=downloads, home_downloads=home_downloads)

@app.get('/guides/<slug>')
def tool_guide(slug):
    guide = GUIDES.get(slug)
    if guide is None:
        abort(404)
    return render_template('tool_guide.html', guide=guide)


def photo_tools_available(config):
    return not any(tool.get('id') == 'builtin-photo-tools' and not is_public(tool)
                   for tool in (config if isinstance(config, dict) else {}).get('tools', []))


@app.get('/photo-tools')
def photo_tools():
    if not photo_tools_available(safe_read(TOOLS_CONFIG_REL)):
        abort(404)
    return render_template('photo_tools.html')

def load_directory():
    data = safe_read(DIRECTORY_REL)
    if not isinstance(data, dict) or not isinstance(data.get('categories'), list):
        return {'categories': []}
    return data

DIRECTORY_SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')

def validate_directory_document(data):
    if not isinstance(data, dict) or not isinstance(data.get('categories'), list):
        raise ValueError('Directories must include a categories array')
    if not data['categories']:
        raise ValueError('Keep at least one directory category')
    if len(data['categories']) > 60:
        raise ValueError('Too many directory categories')
    for key in ('notice', 'updated'):
        if key in data and not isinstance(data[key], str):
            raise ValueError(f'{key} must be text')
    seen = set()
    for category in data['categories']:
        if not isinstance(category, dict):
            raise ValueError('Each directory category must be an object')
        name = category.get('name')
        slug = category.get('slug')
        if not isinstance(name, str) or not name.strip() or len(name) > 80:
            raise ValueError('Each directory needs a name up to 80 characters')
        if not isinstance(slug, str) or not DIRECTORY_SLUG.match(slug):
            raise ValueError('Directory URLs use lowercase letters, numbers and hyphens')
        if slug in seen:
            raise ValueError(f'Directory URL "{slug}" is used twice')
        seen.add(slug)
        if any(flag in category and type(category[flag]) is not bool for flag in ('enabled', 'visible')):
            raise ValueError('Directory publication flags must be true or false')
        for key in ('short', 'tagline', 'description', 'icon'):
            if key in category and not isinstance(category[key], str):
                raise ValueError(f'{key} must be text')
        groups = category.get('groups')
        if not isinstance(groups, list) or not groups:
            raise ValueError('Each directory needs at least one group')
        for group in groups:
            if not isinstance(group, dict) or not isinstance(group.get('name'), str) or not group['name'].strip():
                raise ValueError('Each group needs a name')
            sites = group.get('sites')
            if not isinstance(sites, list):
                raise ValueError('Each group needs a sites array')
            for site in sites:
                if not isinstance(site, dict):
                    raise ValueError('Each site must be an object')
                if not isinstance(site.get('name'), str) or not site['name'].strip():
                    raise ValueError('Each site needs a name')
                if not security.valid_url(site.get('url')) or not site.get('url'):
                    raise ValueError(f'Site "{site["name"]}" needs an HTTPS URL')
                if 'note' in site and not isinstance(site['note'], str):
                    raise ValueError('Site notes must be text')
                if slug == 'public-apis' and (
                    site.get('auth') not in ('No', 'API Key')
                    or site.get('https') not in ('Yes', 'No')
                    or site.get('cors') not in ('Yes', 'No', 'Unknown')
                ):
                    raise ValueError('Each API needs valid Auth, HTTPS and CORS values')
    return data

@app.route('/api/admin/directories', methods=['GET'])
@login_required
def admin_directories():
    return jsonify(load_directory())

@app.route('/api/admin/directories', methods=['POST'])
@login_required
def save_admin_directories():
    try:
        data = validate_directory_document(request.get_json(silent=True))
        safe_write(DIRECTORY_REL, data)
        return jsonify(success=True, directories=data)
    except ValueError as error:
        return jsonify(error=str(error)), 400
    except Exception:
        app.logger.exception('Could not save directories')
        return jsonify(error='Could not save directories. Check server configuration and try again.'), 500

def directory_sites(category):
    groups = [group for group in category.get('groups', []) if isinstance(group, dict)]
    total = 0
    for group in groups:
        total += len([site for site in group.get('sites', [])
                      if isinstance(site, dict) and security.valid_url(site.get('url'))])
    return groups, total

def public_directories(data):
    return [category for category in data.get('categories', [])
            if isinstance(category, dict) and category.get('slug') and category.get('name') and is_public(category)]


@app.get('/directory')
def directory_index():
    data = load_directory()
    directories = []
    for category in public_directories(data):
        _, total = directory_sites(category)
        directories.append({**category, 'site_count': total})
    if not directories:
        abort(404)
    return render_template('directory_index.html', directories=directories,
                           total_sites=sum(item['site_count'] for item in directories),
                           notice=data.get('notice', ''))

@app.get('/directory/<slug>')
def directory_page(slug):
    data = load_directory()
    categories = public_directories(data)
    category = next((item for item in categories if item['slug'] == slug), None)
    if category is None:
        abort(404)
    groups, total = directory_sites(category)
    others = [{**item, 'site_count': directory_sites(item)[1]}
              for item in categories if item['slug'] != slug]
    return render_template('directory.html', category=category, groups=groups,
                           total_sites=total, others=others, notice=data.get('notice', ''))

@app.template_filter('site_domain')
def site_domain(value):
    if not isinstance(value, str):
        return ''
    try:
        from urllib.parse import urlsplit
        host = urlsplit(value).hostname or ''
    except ValueError:
        return ''
    return host[4:] if host.startswith('www.') else host

@app.template_filter('link_check_href')
def link_check_href(value):
    from urllib.parse import quote, urlsplit
    if not isinstance(value, str) or not value.startswith('https://') or not security.valid_url(value):
        return ''
    parsed = urlsplit(value)
    return '/tools/link-safety-checker#url=' + quote(parsed._replace(query='', fragment='').geturl(), safe='')

@app.template_filter('download_size_label')
def download_size_label(size):
    if not download_size(size):
        return ''
    for divisor, unit in ((1000**3, 'GB'), (1000**2, 'MB'), (1000, 'KB')):
        if size >= divisor:
            return f'{size / divisor:.1f} {unit}'
    return f'{size} B'


def load_eduhelp():
    data = safe_read(EDUHELP_REL)
    if not isinstance(data, dict) or not isinstance(data.get('updates'), list):
        return {'updates': [], 'notice': '', 'updated': ''}
    return data

def validate_eduhelp_document(data):
    if not isinstance(data, dict) or not isinstance(data.get('updates'), list):
        raise ValueError('Eduhelp must include an updates array')
    if len(data['updates']) > 200:
        raise ValueError('Too many Eduhelp updates')
    for key in ('notice', 'updated'):
        if key in data and not isinstance(data[key], str):
            raise ValueError(f'{key} must be text')
    if str(data.get('notice') or '') and len(data['notice']) > 2000:
        raise ValueError('Keep the Eduhelp notice under 2000 characters')
    if data.get('updated') and not EDUHELP_DATE.match(data['updated']):
        raise ValueError('The updated date must use YYYY-MM-DD')
    seen = set()
    for item in data['updates']:
        if not isinstance(item, dict):
            raise ValueError('Each Eduhelp update must be an object')
        identity = item.get('id')
        if not isinstance(identity, str) or not EDUHELP_ID.match(identity):
            raise ValueError('Each Eduhelp update needs a simple unique ID')
        if identity in seen:
            raise ValueError('Eduhelp update IDs must be unique')
        seen.add(identity)
        title = item.get('title')
        if not isinstance(title, str) or not title.strip() or len(title) > 160:
            raise ValueError('Each Eduhelp update needs a title up to 160 characters')
        summary = item.get('summary', '')
        if not isinstance(summary, str) or len(summary) > 800:
            raise ValueError('Eduhelp summaries must be text up to 800 characters')
        if item.get('category') not in EDUHELP_CATEGORIES:
            raise ValueError('Choose a valid Eduhelp category')
        if item.get('link'):
            if not isinstance(item['link'], str) or not security.valid_url(item['link']):
                raise ValueError('Eduhelp links must be HTTPS URLs')
        if item.get('date') and (not isinstance(item['date'], str) or not EDUHELP_DATE.match(item['date'])):
            raise ValueError('Eduhelp dates must use YYYY-MM-DD')
        for key, limit in (('class_name', 40), ('subject', 80), ('chapter', 120), ('kind', 40)):
            value = item.get(key)
            if value is None:
                continue
            if not isinstance(value, str) or len(value) > limit:
                raise ValueError(f'{key.replace("_", " ").capitalize()} must be text up to {limit} characters')
            item[key] = value.strip()
        if item.get('category') == 'Lab' and not all(item.get(key) for key in ('class_name', 'subject', 'chapter')):
            raise ValueError('Lab entries need a class, subject and chapter')
        for key in ('enabled', 'pinned'):
            if key in item and type(item[key]) is not bool:
                raise ValueError(f'{key} must be true or false')
    return data

def natural_key(value):
    return [int(part) if part.isdigit() else part.casefold()
            for part in re.split(r'(\d+)', str(value or ''))]

def group_eduhelp_labs(updates):
    grouped = {}
    for item in updates:
        grouped.setdefault(item.get('class_name') or 'Other', {}) \
               .setdefault(item.get('subject') or 'General', {}) \
               .setdefault(item.get('chapter') or 'More labs', []).append(item)
    classes = []
    for class_name in sorted(grouped, key=natural_key):
        subjects = []
        for subject in sorted(grouped[class_name], key=natural_key):
            chapters = []
            for chapter in sorted(grouped[class_name][subject], key=natural_key):
                labs = sorted(grouped[class_name][subject][chapter],
                              key=lambda item: (item.get('pinned') is not True, natural_key(item.get('title'))))
                chapters.append({'name': chapter, 'labs': labs})
            subjects.append({'name': subject, 'chapters': chapters})
        classes.append({'name': class_name, 'subjects': subjects})
    return classes

@app.get('/eduhelp')
def eduhelp():
    data = load_eduhelp()
    updates = [item for item in data.get('updates', [])
               if isinstance(item, dict) and is_public(item)]
    updates.sort(key=lambda item: item.get('date') or '', reverse=True)
    updates.sort(key=lambda item: item.get('pinned') is not True)
    categories = [name for name in EDUHELP_CATEGORIES
                  if any(item.get('category') == name for item in updates)]
    tools = [tool for tool in load_tool_catalog()['tools'] if tool['category'] == 'Education']
    level = 'hs' if request.args.get('level') == 'hs' else 'hslc'
    chapters = {slug: chapter for slug, chapter in eduhelp_resource('eduhelp-study.json').items()
                if chapter['level'] == 'Class 10'} if level == 'hslc' else {}
    return render_template('eduhelp.html', updates=updates, categories=categories, study_tools=tools,
                           weather_mode=weather_provider(), chapters=chapters, level=level,
                           notice=data.get('notice', ''))


def eduhelp_resource(filename):
    with open(os.path.join(BASE_DIR, 'data', filename), encoding='utf-8') as resource:
        return json.load(resource)


@app.get('/eduhelp/study')
def eduhelp_study():
    chapters = eduhelp_resource('eduhelp-study.json')
    options = {key: sorted({chapter[key] for chapter in chapters.values()}, key=natural_key)
               for key in ('board', 'level', 'subject')}
    filters = {key: request.args.get(key, '') for key in options}
    chapters = {slug: chapter for slug, chapter in chapters.items()
                if all(value not in options[key] or chapter[key] == value for key, value in filters.items())}
    return render_template('eduhelp_study.html', chapters=chapters, options=options, filters=filters)


@app.get('/eduhelp/study/<slug>')
def eduhelp_chapter(slug):
    chapter = eduhelp_resource('eduhelp-study.json').get(slug)
    if not chapter:
        abort(404)
    return render_template('eduhelp_chapter.html', chapter=chapter)


@app.get('/eduhelp/calendar')
def eduhelp_calendar():
    events = eduhelp_resource('eduhelp-opportunities.json')['events']
    kinds = ('Admission', 'Admit card', 'Application deadline', 'Exam', 'Result')
    kind = request.args.get('type', '')
    if kind not in kinds:
        kind = ''
    periods = {'upcoming': 'Upcoming and ongoing', 'past': 'Past dates', 'all': 'All dates'}
    period = request.args.get('period', 'upcoming')
    if period not in periods:
        period = 'upcoming'
    india = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    today = datetime.datetime.now(india).date().isoformat()
    groups = {}
    for event in sorted(events, key=lambda item: item['start'], reverse=period == 'past'):
        past = event.get('end', event['start']) < today
        if (kind and event['type'] != kind) or (period != 'all' and past != (period == 'past')):
            continue
        groups.setdefault(event['start'][:7], []).append(event)
    return render_template('eduhelp_calendar.html', groups=groups, kinds=kinds, kind=kind,
                           periods=periods, period=period)


@app.get('/eduhelp/calendar/<slug>.ics')
def eduhelp_calendar_event(slug):
    event = next((item for item in eduhelp_resource('eduhelp-opportunities.json')['events'] if item['id'] == slug), None)
    if not event:
        abort(404)
    end = datetime.date.fromisoformat(event.get('end', event['start'])) + datetime.timedelta(days=1)
    title = event['title'].replace('\\', '\\\\').replace(',', '\\,').replace(';', '\\;').replace('\n', '\\n')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SanuwarTools//EduHelp//EN', 'BEGIN:VEVENT',
        f'UID:{slug}@sanuwartools.online', f'DTSTAMP:{stamp}',
        "DTSTART;VALUE=DATE:" + event['start'].replace('-', ''),
        f'DTEND;VALUE=DATE:{end:%Y%m%d}', 'SUMMARY:' + title,
        'DESCRIPTION:Verify any changes with the official source.', 'URL:' + event['source'],
        'END:VEVENT', 'END:VCALENDAR', '',
    ]
    # Fold content lines for calendar importers. The seeded event fields are ASCII.
    folded = ['\r\n '.join([line[:75]] + [line[i:i + 74] for i in range(75, len(line), 74)]) for line in lines]
    return make_response('\r\n'.join(folded), 200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': f'attachment; filename="{slug}.ics"',
    })


@app.get('/eduhelp/scholarships')
def eduhelp_scholarships():
    schemes = eduhelp_resource('eduhelp-opportunities.json')['schemes']
    regions = ('Assam', 'Other Indian states')
    levels = sorted({level for scheme in schemes for level in scheme['levels']}, key=natural_key)
    region = request.args.get('region', 'Assam')
    if region not in regions:
        region = 'Assam'
    level = request.args.get('level', '')
    if level not in levels:
        level = ''
    matches = [scheme for scheme in schemes if region in scheme['regions'] and
               (not level or level in scheme['levels'])]
    return render_template('eduhelp_scholarships.html', schemes=matches, regions=regions,
                           levels=levels, region=region, level=level)


@app.get('/eduhelp/papers')
def eduhelp_papers():
    exams = {'hslc': 'HSLC · Class 10', 'hs': 'HS Final · Class 12'}
    exam = request.args.get('exam', 'hslc')
    if exam not in exams:
        exam = 'hslc'
    years = list(range(2026, 2014, -1))
    year = request.args.get('year', type=int)
    if year not in years:
        year = None
    streams = ('Arts', 'Science', 'Commerce', 'Common', 'Other subjects') if exam == 'hs' else ()
    stream = request.args.get('stream', '')
    if stream not in streams:
        stream = ''
    query = request.args.get('q', '').strip()[:100]
    terms = ['math' if word == 'maths' else word for word in query.casefold().split()]
    catalog = eduhelp_resource('eduhelp-papers.json')
    exam_papers = [paper for paper in catalog if paper['exam'] == exam]
    subjects = sorted({paper['subject'] for paper in exam_papers}, key=natural_key)
    subject = request.args.get('subject', '')
    if subject not in subjects:
        subject = ''

    grouped = {number: [] for number in ([year] if year else years)}
    for paper in exam_papers:
        if paper['year'] not in grouped or (subject and subject != paper['subject']):
            continue
        categories = paper.get('streams') or ['Other subjects']
        if stream and stream not in categories and not (stream in streams[:3] and 'Common' in categories):
            continue
        searchable = f"{paper['subject']} {paper['year']} {paper.get('kind', 'Board exam')}".casefold()
        if all(word in searchable for word in terms):
            grouped[paper['year']].append(paper)

    totals = {key: sum(paper['exam'] == key for paper in catalog) for key in exams}
    return render_template('eduhelp_papers.html', exam=exam, exams=exams, years=years, year=year,
                           streams=streams, stream=stream, subjects=subjects, subject=subject,
                           query=query, grouped=grouped, totals=totals,
                           matches=sum(map(len, grouped.values())))


WEATHER_ENDPOINTS = {
    'places': 'https://customer-geocoding-api.open-meteo.com/v1/search',
    'weather': 'https://customer-api.open-meteo.com/v1/forecast',
    'air': 'https://customer-air-quality-api.open-meteo.com/v1/air-quality',
}
WEATHER_FIELDS = {
    'weather': ('temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'weather_code'),
    'air': ('us_aqi', 'pm2_5', 'pm10'),
}


def weather_provider():
    if os.getenv('OPEN_METEO_API_KEY', '').strip():
        return 'proxy'
    if (request.host.split(':', 1)[0] in ('localhost', '127.0.0.1') or
            os.getenv('OPEN_METEO_NONCOMMERCIAL') == '1'):
        return 'public'
    return 'unconfigured'


@app.get('/api/public-weather/<kind>')
def public_weather(kind):
    if kind not in WEATHER_ENDPOINTS:
        abort(404)
    key = os.getenv('OPEN_METEO_API_KEY', '').strip()
    if not key:
        return jsonify(error='Weather service is not configured.'), 503
    if security.limited(('public-weather', request.remote_addr), maximum=36, window=60):
        return jsonify(error='Too many weather requests. Try again shortly.'), 429

    if kind == 'places':
        name = request.args.get('name', '').strip()
        if not 2 <= len(name) <= 100 or any(ord(ch) < 32 for ch in name):
            return jsonify(error='Enter a city name of 2–100 characters.'), 400
        params = {'name': name, 'count': 6, 'language': 'en'}
    else:
        try:
            lat = float(request.args.get('latitude', ''))
            lng = float(request.args.get('longitude', ''))
        except (ValueError, OverflowError):
            return jsonify(error='Invalid coordinates.'), 400
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return jsonify(error='Invalid coordinates.'), 400
        params = {'latitude': round(lat, 5), 'longitude': round(lng, 5), 'timezone': 'auto',
                  'current': ','.join(WEATHER_FIELDS[kind])}
    try:
        upstream = requests.get(WEATHER_ENDPOINTS[kind], params={**params, 'apikey': key},
                                timeout=(3, 6), allow_redirects=False)
        if upstream.status_code == 429:
            return jsonify(error='Weather provider request limit reached.'), 429
        if upstream.status_code != 200:
            return jsonify(error='Weather provider is unavailable.'), 502
        data = upstream.json()
        if not isinstance(data, dict) or data.get('error'):
            return jsonify(error='Weather provider returned an invalid response.'), 502
        if kind == 'places':
            results = data.get('results', [])
            if not isinstance(results, list):
                return jsonify(error='Weather provider returned an invalid response.'), 502
            fields = ('name', 'admin1', 'country', 'latitude', 'longitude')
            return jsonify(results=[{name: place.get(name) for name in fields}
                                    for place in results[:6] if isinstance(place, dict)])
        current = data.get('current')
        if not isinstance(current, dict):
            return jsonify(error='Weather provider returned no current data.'), 502
        fields = ('time', *WEATHER_FIELDS[kind])
        return jsonify(current={name: current.get(name) for name in fields},
                       timezone=data.get('timezone'))
    except (requests.RequestException, ValueError):
        return jsonify(error='Weather provider is unavailable.'), 502

@app.get('/eduhelp/labs')
def eduhelp_labs():
    data = load_eduhelp()
    labs = [item for item in data.get('updates', [])
            if isinstance(item, dict) and is_public(item) and item.get('category') == 'Lab']
    guides = {url_for('eduhelp_lab', slug=chapter['lab']): url_for('eduhelp_chapter', slug=slug, _anchor='experiment')
              for slug, chapter in eduhelp_resource('eduhelp-study.json').items()}
    return render_template('eduhelp_labs.html', classes=group_eduhelp_labs(labs), guides=guides,
                           total=len(labs), notice=data.get('notice', ''),
                           updated=data.get('updated', ''))

@app.get('/eduhelp/labs/<slug>')
def eduhelp_lab(slug):
    filename = EDUHELP_LABS.get(slug)
    if not filename:
        abort(404)
    try:
        with open(os.path.join(BASE_DIR, 'labs', filename), encoding='utf-8') as lab_file:
            markup = lab_file.read()
    except OSError:
        abort(404)
    nonce = monetization.nonce()
    markup = re.sub(r'<script(?![^>]*\bsrc=)', f'<script nonce="{nonce}"', markup, flags=re.IGNORECASE)
    return make_response(markup, 200, {'Content-Type': 'text/html; charset=utf-8'})

@app.route('/api/admin/eduhelp', methods=['GET'])
@login_required
def admin_eduhelp():
    return jsonify(load_eduhelp())

@app.route('/api/admin/eduhelp', methods=['POST'])
@login_required
def save_admin_eduhelp():
    try:
        data = validate_eduhelp_document(request.get_json(silent=True))
        safe_write(EDUHELP_REL, data)
        return jsonify(success=True, eduhelp=data)
    except ValueError as error:
        return jsonify(error=str(error)), 400
    except Exception:
        app.logger.exception('Could not save Eduhelp updates')
        return jsonify(error='Could not save Eduhelp updates. Check server configuration and try again.'), 500

@app.route("/payment-demo")
def payment_demo():
    return render_template("payment_demo.html")

@app.route("/downloads")
@app.route("/download.html")
def downloads():
    if not (safe_read(TOOLS_CONFIG_REL) or {}).get('downloadPage', {}).get('enabled', True):
        abort(404)
    return render_template("downloads.html", initial_downloads=[public_download_item(item) for item in public_downloads()])

@app.get('/downloads/<identity>/<slug>')
def download_detail(identity, slug):
    if not seo.DOWNLOAD_ID.fullmatch(identity):
        abort(404)
    item = next((item for item in public_downloads() if item.get('id') == identity and item.get('title')), None)
    if item is None:
        abort(404)
    canonical = seo.download_path(item)
    if not canonical:
        abort(404)
    if request.path != canonical:
        return redirect(canonical, code=301)
    detail = public_download_item(item)
    if not detail.get('is_album') and detail['link'] and security.valid_url(detail['link']):
        from urllib.parse import urlsplit
        extension = os.path.splitext(urlsplit(detail['link']).path)[1][1:].upper()
        if re.fullmatch(r'[A-Z0-9]{2,8}', extension):
            detail['file_type'] = {'APK': 'Android APK', 'AAB': 'Android App Bundle'}.get(extension, extension)
    g.download_page = detail
    return render_template('download_detail.html', item=detail)


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
DIRECTORY_REL    = "data/directory.json"
EDUHELP_REL      = "data/eduhelp.json"
TOOL_CATALOG_REL = "data/tools.catalog.json"
EDUHELP_CATEGORIES = ('Exam', 'Result', 'Admission', 'Scholarship', 'Notice', 'Lab')
EDUHELP_DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
EDUHELP_ID = re.compile(r'^[A-Za-z0-9_-]{1,60}$')
EDUHELP_LABS = {
    'electricity': 'class-10-electricity.html',
    'carbon-compounds': 'carbon-compounds.html',
}
TOOL_BUNDLES = {"text", "media", "forms", "network", "misc", "calculators", "dls", "land", "players", "file-workbench", "study-planner", "pdf-editor", "api-studio", "study-utilities", "scan-workflow"}
TOOL_VENDORS = {"js-yaml", "marked", "fflate", "pdf-lib", "pdfjs", "jspdf", "bcryptjs", "qrcodegen", "hlsjs", "dashjs", "tesseract"}
TOOL_CATEGORY_ICONS = {
    'Players': 'film',
    'Calculators': 'calculator',
    'Encoding & Hashing': 'key',
    'Developer Tools': 'tool',
    'Text Tools': 'text',
    'Networking': 'vpn',
    'Unit Converters': 'convert',
    'Images & Media': 'photo',
    'Financial Calculators': 'wallet',
    'PDF & Documents': 'document',
    'Time & Date': 'clock',
    'Health & Fitness': 'heart',
    'Compression & Archives': 'archive',
    'Security & Privacy': 'shield',
    'Sports & Games': 'score',
    'Land & Property': 'convert',
    'Lookups': 'document',
    'Education': 'ebook',
}
TOOL_CATEGORY_ORDER = [
    'Players',
    'Text Tools',
    'Developer Tools',
    'Encoding & Hashing',
    'Images & Media',
    'PDF & Documents',
    'Compression & Archives',
    'Networking',
    'Security & Privacy',
    'Calculators',
    'Financial Calculators',
    'Unit Converters',
    'Time & Date',
    'Health & Fitness',
    'Land & Property',
    'Lookups',
    'Education',
    'Sports & Games',
]

def load_tool_catalog():
    data = safe_read(TOOL_CATALOG_REL)
    if not isinstance(data, dict) or not isinstance(data.get('tools'), list):
        return {'updated': '', 'categories': [], 'tools': []}
    categories = []
    for category in data.get('categories', []):
        if isinstance(category, str) and category.strip() and category not in categories:
            categories.append(category.strip())
    tools = []
    seen = set()
    config = safe_read(TOOLS_CONFIG_REL)
    config_tools = config.get('tools') if isinstance(config, dict) else []
    hidden_routes = {item.get('route') for item in (config_tools if isinstance(config_tools, list) else [])
                     if isinstance(item, dict) and not is_public(item) and isinstance(item.get('route'), str)}
    for item in data['tools']:
        if not isinstance(item, dict):
            continue
        slug = item.get('slug')
        name = item.get('name')
        description = item.get('description')
        bundle = item.get('bundle')
        category = item.get('category')
        if not isinstance(slug, str) or not DIRECTORY_SLUG.match(slug) or slug in seen:
            continue
        if not isinstance(name, str) or not name.strip() or len(name) > 80:
            continue
        if not isinstance(description, str) or not description.strip():
            continue
        if bundle not in TOOL_BUNDLES or not isinstance(category, str) or not category.strip():
            continue
        if bundle in ('api-studio', 'study-utilities') and f'/tools/{slug}' in hidden_routes:
            continue
        vendors = [vendor for vendor in item.get('vendor', []) if vendor in TOOL_VENDORS] if isinstance(item.get('vendor'), list) else []
        icon = item.get('icon') if isinstance(item.get('icon'), str) else '•'
        seen.add(slug)
        tools.append({
            'slug': slug,
            'name': name.strip(),
            'category': category.strip(),
            'description': description.strip(),
            'icon': icon[:4],
            'icon_file': TOOL_CATEGORY_ICONS.get(category.strip(), 'tool'),
            'bundle': bundle,
            'vendor': vendors,
            'popular': item.get('popular') is True,
        })
        if category.strip() not in categories:
            categories.append(category.strip())
    order = {name: index for index, name in enumerate(TOOL_CATEGORY_ORDER)}
    categories.sort(key=lambda name: (order.get(name, len(order)), name))
    return {'updated': data.get('updated', ''), 'categories': categories, 'tools': tools}

def browser_tool_cards(catalog):
    """Homepage catalogue cards for the self-hosted browser tools."""
    cards = []
    for tool in catalog.get('tools', []):
        icon = tool.get('icon_file') or 'tool'
        cards.append({
            'id': 'browser-' + tool['slug'],
            'name': tool['name'],
            'category': tool['category'],
            'description': tool['description'],
            'longDescription': tool['description'],
            'route': '/tools/' + tool['slug'],
            'tags': [tool['category'], 'browser tool', 'free'],
            'icon': icon,
            'thumbnail': '/assets/icons/%s.svg?v=soft1' % icon,
            'featured': False,
            'popular': bool(tool.get('popular')),
            'visible': True,
            'enabled': True,
            'downloadAvailable': False,
        })
    return cards

@app.get('/tools')
@app.get('/tools/')
def tools_hub():
    catalog = load_tool_catalog()
    if not catalog['tools']:
        abort(404)
    return render_template('tools/hub.html', catalog=catalog)

@app.get('/players')
def players_hub():
    catalog = load_tool_catalog()
    players = [tool for tool in catalog['tools'] if tool['category'] == 'Players']
    if not players:
        abort(404)
    return render_template('players.html', players=players, catalog=catalog)

@app.get('/api/browser-tools.json')
def browser_tools_feed():
    catalog = load_tool_catalog()
    response = jsonify({'tools': browser_tool_cards(catalog), 'categories': catalog['categories']})
    response.headers['Cache-Control'] = 'public, max-age=300'
    return response

@app.get('/tools/<slug>')
def tool_page(slug):
    if not DIRECTORY_SLUG.match(slug):
        abort(404)
    catalog = load_tool_catalog()
    tool = next((item for item in catalog['tools'] if item['slug'] == slug), None)
    if tool is None:
        abort(404)
    related = [item for item in catalog['tools']
               if item['category'] == tool['category'] and item['slug'] != slug][:4]
    template = 'tools/land.html' if slug == 'land-measurement-calculator' else 'tools/tool.html'
    return render_template(template, tool=tool, related=related, catalog=catalog,
                           api_studio_help=API_STUDIO_HELP, study_tool_help=STUDY_TOOL_HELP,
                           weather_mode=weather_provider() if slug == 'weather-air-quality' else '')

BYPASS_PASSWORD_SALT = 'sanuwar-tools::bypass::jpd::v1'
BYPASS_PASSWORD_HASH = '2c04d2f0c3db543e3965959bc8968c693ec3db1276077f88f9e3ee8de4e190ed'
BYPASS_UNLOCK_SECONDS = 6 * 60 * 60
BYPASS_EXPIRY = datetime.datetime(2027, 5, 3, 23, 59, 59)

def bypass_password_ok(value):
    if not isinstance(value, str) or not value or len(value) > 64:
        return False
    expected = os.getenv('BYPASS_PASSWORD', '')
    if expected:
        return hmac.compare_digest(value, expected)
    digest = hashlib.sha256((BYPASS_PASSWORD_SALT + value).encode('utf-8')).hexdigest()
    return hmac.compare_digest(digest, BYPASS_PASSWORD_HASH)

def render_bypass(unlocked, expired, error=None, status=200):
    response = make_response(render_template('bypass.html', unlocked=unlocked,
                                             expired=expired, error=error), status)
    response.headers['Cache-Control'] = 'no-store'
    return response

@app.route('/bypass', methods=['GET', 'POST'])
def bypass():
    if any(item.get('id') == 'builtin-lyrics-bypass' and not is_public(item)
           for item in (safe_read(TOOLS_CONFIG_REL) or {}).get('tools', [])):
        abort(404)
    expired = datetime.datetime.now() > BYPASS_EXPIRY
    if request.method == 'POST':
        if expired:
            return render_bypass(False, True)
        if security.limited(('bypass', request.remote_addr), maximum=8, window=900):
            return render_bypass(False, False, 'limited', 429)
        if bypass_password_ok(request.form.get('password', '')):
            session['bypass_unlocked_at'] = int(time.time())
            response = redirect(url_for('bypass'))
            response.headers['Cache-Control'] = 'no-store'
            return response
        return render_bypass(False, False, 'invalid', 401)
    unlocked_at = session.get('bypass_unlocked_at', 0)
    unlocked = isinstance(unlocked_at, int) and (time.time() - unlocked_at) < BYPASS_UNLOCK_SECONDS
    return render_bypass(unlocked, expired)

@app.route("/tools.config.json")
def serve_config():
    data = safe_read(TOOLS_CONFIG_REL)
    if data is None:
        data = {"tools": [], "categories": ["All"], "site": {}, "socialLinks": {}, "widgets": []}
    return jsonify(public_config(data))

@app.get('/api/search-index')
def search_index():
    from site_search import build_index
    response = jsonify(entries=build_index(
        safe_read(TOOLS_CONFIG_REL) or {}, load_tool_catalog(), public_downloads(),
        load_directory(), load_eduhelp(), admin=bool(session.get('admin_logged_in')),
        widgets=utils.load_config().get('widgets', [])))
    response.headers['Cache-Control'] = 'private, no-store'
    return response


@app.context_processor
def site_context():
    raw = safe_read(TOOLS_CONFIG_REL)
    return {'public_config': public_config(raw), 'photo_tools_available': photo_tools_available(raw),
            'now_year': datetime.datetime.now().year}

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

def public_download_item(item):
    public = payments.public_item(item)
    public['download_path'] = seo.download_path(item)
    return public


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
    return jsonify([public_download_item(item) for item in items])

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
        if not new_item['is_album'] and download_size(data.get('size')):
            new_item['size'] = data['size']
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
                if (items[i]['link'] != item.get('link') or
                        ('asset' in data and data['asset'] != item.get('asset')) or items[i]['is_album']):
                    items[i].pop('size', None)
                if not items[i]['is_album'] and download_size(data.get('size')):
                    items[i]['size'] = data['size']
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
seo.install(app, lambda: safe_read(TOOLS_CONFIG_REL), lambda: {'categories': public_directories(load_directory())},
            load_tool_catalog, load_downloads=public_downloads)
monetization.install(app)
user_auth.install(app)
visitor_analytics.install(app, login_required, lambda: safe_read(TOOLS_CONFIG_REL), lambda: safe_read(DOWNLOADS_REL) or [])

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=os.getenv('FLASK_DEBUG') == '1')
