"""Explicit, public metadata for the site's unified navigation search."""
from urllib.parse import quote, urlencode, urlsplit, unquote
from availability import is_public
from tool_guides import GUIDES

PAGES = [
    ('Home', '/', 'Tools and downloads'),
    ('All browser tools', '/tools', 'Calculators converters text image PDF tools'),
    ('Directories', '/directory', 'Movies anime music websites'),
    ('Eduhelp', '/eduhelp', 'Exams results admission notes study'),
    ('Lab library', '/eduhelp/labs', 'Interactive science physics chemistry biology labs'),
    ('Players', '/players', 'Video audio player HLS DASH MKV MP3 subtitles cloud streaming'),
    ('How it works', '/#how-it-works', 'Help using the toolkit'),
    ('About', '/about', 'About SanuwarTools'),
    ('Contact', '/contact', 'Support feedback report a problem'),
    ('Privacy', '/privacy', 'Privacy cookies data settings'),
    ('Sign in', '/signin', 'Login Google account'),
    ('My account', '/account', 'Profile account settings'),
    ('Purchases', '/purchases', 'Orders paid downloads payment history'),
    ('Admin', '/admin', 'Admin login dashboard manage website'),
    ('Link bypass', '/bypass', 'Unlock supported links'),
    ('Payment demo', '/payment-demo', 'Payment test demonstration'),
]
ADMIN_VIEWS = {
    'dashboard': 'Dashboard', 'analytics': 'Visitor analytics', 'tools': 'Tools',
    'downloads': 'Downloads', 'directories': 'Directories', 'eduhelp': 'Eduhelp',
    'widgets': 'Home widgets', 'store': 'Store apps', 'categories': 'Categories',
    'payments': 'Payments', 'settings': 'Site settings', 'backup': 'Backup & restore',
}


def build_index(config, catalog, downloads, directory, eduhelp, admin=False, widgets=()):
    entries, seen = [], set()

    def add(name, href, kind, description='', keywords=''):
        if not isinstance(href, str) or not href or any(c in href for c in '\\\r\n'):
            return
        parsed = urlsplit(href)
        if href.startswith('//') or not (href.startswith('/') or (parsed.scheme == 'https' and parsed.netloc)):
            return
        key = (str(name), href)
        if not name or key in seen:
            return
        seen.add(key)
        entries.append(dict(name=str(name), href=href, category=kind,
                            description=str(description or ''), keywords=str(keywords or ''), mark=kind[0]))

    for name, href, description in PAGES:
        add(name, href, 'Page', description)
    for slug, guide in GUIDES.items():
        add(guide['title'], '/guides/' + slug, 'Guide', guide['intro'], slug.replace('-', ' '))
    for category in catalog.get('categories', []):
        add(category, '/tools?' + urlencode({'category': category}), 'Category', 'Browse ' + category.lower())
    for tool in catalog.get('tools', []):
        add(tool['name'], '/tools/' + tool['slug'], 'Tool', tool.get('description'), tool.get('category'))
    for tool in config.get('tools', []):
        if not is_public(tool):
            continue
        route = tool.get('route') or ('/photo-tools' if tool.get('id') == 'builtin-photo-tools' else tool.get('siteUrl'))
        add(tool.get('name'), route, 'Tool', tool.get('description'),
            ' '.join([tool.get('category', ''), tool.get('longDescription', ''), *tool.get('tags', [])]))
    if config.get('downloadPage', {}).get('enabled', True) is True:
        add('Downloads', '/downloads', 'Page', 'Download apps APK documents files and albums')
        for item in downloads:
            if not is_public(item):
                continue
            href = '/downloads?' + urlencode({'item': item.get('id', '')})
            add(item.get('title'), href, 'Album' if item.get('is_album') else 'Download',
                item.get('description'), ' '.join(str(item.get(k) or '') for k in ('category', 'version', 'filename', 'name')) + ' ' +
                unquote(urlsplit(item.get('link') or '').path.rsplit('/', 1)[-1]))
            for file in item.get('album_files', []):
                if is_public(file):
                    # File names are already public; delivery URLs/assets never enter this feed.
                    add(file.get('name'), href + '&' + urlencode({'file': file.get('name', '')}), 'File',
                        item.get('title'), item.get('category'))
    for category in directory.get('categories', []):
        if not is_public(category):
            continue
        href = '/directory/' + quote(category.get('slug', ''), safe='')
        add(category.get('name'), href, 'Directory', category.get('description'), category.get('short'))
        for group in category.get('groups', []):
            for site in group.get('sites', []):
                if is_public(site):
                    add(site.get('name'), href + '?' + urlencode({'q': site.get('name', '')}),
                        'Website', site.get('note') or category.get('name'), group.get('name'))
    for update in eduhelp.get('updates', []):
        if is_public(update):
            add(update.get('title'), '/eduhelp?' + urlencode({'q': update.get('title', '')}),
                'Eduhelp', update.get('summary'), ' '.join(str(update.get(k) or '') for k in
                    ('category', 'class_name', 'subject', 'chapter', 'kind', 'date')))
    for widget in widgets:
        if widget.get('enabled') is True and is_public(widget):
            data = widget.get('data') or {}
            name = next((data.get(key) for key in ('title', 'question', 'name', 'winner_name', 'heading') if data.get(key)), None)
            description = next((data.get(key) for key in ('description', 'message', 'bio', 'content', 'text') if data.get(key)), '')
            add(name, '/#widgets', 'Widget', description, widget.get('type'))
    if admin:
        for view, label in ADMIN_VIEWS.items():
            add('Admin · ' + label, '/admin#' + view, 'Admin', 'Manage ' + label.lower())
        add('Remote access licenses', '/admin/licenses', 'Admin', 'License keys devices remote access')
    return entries
