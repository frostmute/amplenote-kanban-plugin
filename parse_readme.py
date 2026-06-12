import json
import urllib.request
import base64

resp = urllib.request.urlopen('https://api.github.com/repos/alloy-org/plugin-template/readme').read().decode('utf-8')
data = json.loads(resp)
print(base64.b64decode(data['content']).decode('utf-8'))
