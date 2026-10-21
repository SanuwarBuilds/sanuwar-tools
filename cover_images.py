"""Small public cover thumbnails that persist with the catalogue, without an external upload."""
import base64
import io
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_COVER_BYTES = 96 * 1024

def thumbnail_bytes(stream):
    with Image.open(stream) as source:
        if source.format not in ('PNG', 'JPEG', 'WEBP', 'GIF'):
            raise ValueError('Choose a PNG, JPG, WebP or GIF image')
        if source.width * source.height > 16_000_000:
            raise ValueError("Cover image must be at most 16 megapixels")
        source.seek(0)
        image = ImageOps.exif_transpose(source).convert('RGBA')
        image.thumbnail((640, 640), Image.Resampling.LANCZOS)
        for quality in (82, 68, 50):
            buffer = io.BytesIO()
            image.save(buffer, format='WEBP', quality=quality, method=4)
            data = buffer.getvalue()
            if len(data) <= MAX_COVER_BYTES:
                return data, image.size
        raise ValueError('Image is too detailed. Choose a smaller cover image.')


def thumbnail_receipt(stream, filename):
    data, size = thumbnail_bytes(stream)
    return {'url': 'data:image/webp;base64,' + base64.b64encode(data).decode('ascii'),
            'filename': filename, 'width': size[0], 'height': size[1], 'size': len(data)}
