"""Configuration access shares the app's atomic, checked persistence path.

The app injects these callbacks after initialisation so importing this module
never creates a second Flask application or a different session secret.
"""

def load_config():
    data = safe_reader('data/config.json')
    return data if isinstance(data, dict) else {}


def save_config(config_data):
    safe_writer('data/config.json', config_data)
