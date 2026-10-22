"""One publication policy for catalogue views and download delivery."""
def is_public(item):
    # Missing flags preserve legacy entries; malformed flags fail closed.
    return all(item.get(key, True) is True for key in ('enabled', 'visible'))


def public_config(config):
    result = dict(config or {})
    for key in ('tools', 'widgets', 'store_apps'):
        if key in result:
            result[key] = [item for item in result[key] if is_public(item)]
    active_categories = {item.get('category') for item in result.get('tools', [])}
    result['categories'] = [category for category in result.get('categories', [])
                            if category == 'All' or category in active_categories]
    return result
