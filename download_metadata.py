"""UTC catalogue timestamps. Legacy entries keep unknown upload times unknown."""
import datetime


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def upload_time(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            return None
        if not 2000 <= parsed.year or parsed > datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1):
            return None
        return parsed.astimezone(datetime.timezone.utc).isoformat(timespec='seconds')
    except ValueError:
        return None


def album_metadata(files, previous=(), now=None):
    now = now or utc_now()
    old = {f.get('link'): f for f in previous}
    result = []
    for incoming in files:
        entry = dict(incoming)
        prior = old.get(entry.get('link'))
        if prior is not None:
            # Editing a caption/name must never reset an existing file's dates.
            for key in ('added_at', 'uploaded_at'):
                entry.pop(key, None)
                if key in prior:
                    entry[key] = prior[key]
        else:
            entry['added_at'] = now
            stamp = upload_time(entry.get('uploaded_at'))
            entry.pop('uploaded_at', None)
            if stamp:
                entry['uploaded_at'] = stamp
        result.append(entry)
    return result
