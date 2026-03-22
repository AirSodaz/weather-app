import json

with open('src/locales/en.json', 'r') as f:
    en_locales = json.load(f)

with open('src/locales/zh.json', 'r') as f:
    zh_locales = json.load(f)

auto_location_en = {
    "locating": "Locating...",
    "finding": "Finding your location...",
    "currentLocation": "Current Location",
    "lastKnownLocation": "Last Known Location",
    "locationUnavailable": "Location Unavailable",
    "locationDenied": "Location Denied",
    "enableServices": "Please enable location services or search for a city.",
    "searchCity": "Search City",
    "geoNotSupported": "Geolocation not supported",
    "deniedUsingLast": "Location denied, using last known",
    "accessDenied": "Location access denied",
    "unavailableUsingLast": "Location unavailable, using last known"
}

auto_location_zh = {
    "locating": "正在定位...",
    "finding": "正在查找您的位置...",
    "currentLocation": "当前位置",
    "lastKnownLocation": "上次已知位置",
    "locationUnavailable": "定位不可用",
    "locationDenied": "定位被拒绝",
    "enableServices": "请开启定位服务或搜索城市。",
    "searchCity": "搜索城市",
    "geoNotSupported": "不支持地理定位",
    "deniedUsingLast": "定位被拒绝，使用上次已知位置",
    "accessDenied": "定位访问被拒绝",
    "unavailableUsingLast": "定位不可用，使用上次已知位置"
}

en_locales["autoLocation"] = auto_location_en
zh_locales["autoLocation"] = auto_location_zh

with open('src/locales/en.json', 'w') as f:
    json.dump(en_locales, f, indent=4, ensure_ascii=False)

with open('src/locales/zh.json', 'w') as f:
    json.dump(zh_locales, f, indent=4, ensure_ascii=False)

print("Locales updated.")
