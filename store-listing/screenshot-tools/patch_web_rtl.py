"""Makes a web export lay out right-to-left when the browser language is Arabic.

react-native-web's I18nManager always reports LTR, so on web the app never mirrors (on Android
it does). This patches the stub in the exported bundle, for screenshots only.

usage: python3 patch_web_rtl.py <web-export-dir>
"""
import glob
import sys

STUB = 'var t={allowRTL(){},forceRTL(){},getConstants:()=>({isRTL:!1})}'
PATCH = (
    'var __rtl=/^ar\\b/.test(navigator.language);'
    'var t={allowRTL(){},forceRTL(){},isRTL:__rtl,getConstants:()=>({isRTL:__rtl})}'
)

for path in glob.glob(f'{sys.argv[1]}/_expo/static/js/web/*.js'):
    src = open(path, encoding='utf-8').read()
    if STUB in src:
        open(path, 'w', encoding='utf-8').write(src.replace(STUB, PATCH))
        print('patched', path)
        break
else:
    sys.exit('I18nManager stub not found; the bundle format may have changed.')
