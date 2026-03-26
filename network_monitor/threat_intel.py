"""
脅威インテリジェンス: IPアドレスの評判をチェックし、既知の悪意あるIPを検出する
"""
import ipaddress
import logging
import time
from functools import lru_cache
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# リクエストタイムアウト (秒)
REQUEST_TIMEOUT = 5

# キャッシュの有効期限 (秒)
CACHE_TTL = 3600  # 1時間

# IP評価のキャッシュ (ip -> (timestamp, result))
_ip_cache: dict[str, tuple[float, dict]] = {}


def check_ip_reputation(ip: str, abuseipdb_api_key: str = "") -> dict:
    """
    IPアドレスの評判をチェックする。

    AbuseIPDB APIキーが設定されている場合はそれを使用し、
    なければ無料のAPIサービスにフォールバックする。

    Returns:
        {
            "ip": str,
            "is_malicious": bool,
            "confidence_score": int,  # 0-100
            "reports": int,
            "country": str,
            "source": str,
            "detail": str,
        }
    """
    # プライベートIPはチェック不要
    if _is_private_ip(ip):
        return _safe_result(ip, "private")

    # キャッシュチェック
    cached = _get_cached(ip)
    if cached is not None:
        return cached

    result = None

    # AbuseIPDB (APIキーあり)
    if abuseipdb_api_key:
        result = _check_abuseipdb(ip, abuseipdb_api_key)

    # フォールバック: ip-api.com (無料、レート制限あり)
    if result is None:
        result = _check_ip_api(ip)

    # それでも取得できなければ不明として返す
    if result is None:
        result = _safe_result(ip, "unknown")

    _set_cache(ip, result)
    return result


def check_multiple_ips(ips: list[str], api_key: str = "") -> dict[str, dict]:
    """複数IPをまとめてチェックする (レート制限を考慮して間隔を空ける)"""
    results = {}
    unique_ips = list(set(ips))

    for i, ip in enumerate(unique_ips):
        results[ip] = check_ip_reputation(ip, api_key)
        # レート制限対策: AbuseIPDBは1分あたり1000リクエスト (無料プラン)
        if i > 0 and i % 10 == 0:
            time.sleep(0.1)

    return results


def _check_abuseipdb(ip: str, api_key: str) -> Optional[dict]:
    """AbuseIPDB APIでIPを検査する"""
    try:
        resp = requests.get(
            "https://api.abuseipdb.com/api/v2/check",
            headers={"Key": api_key, "Accept": "application/json"},
            params={"ipAddress": ip, "maxAgeInDays": 90},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            score = data.get("abuseConfidenceScore", 0)
            return {
                "ip": ip,
                "is_malicious": score >= 25,
                "confidence_score": score,
                "reports": data.get("totalReports", 0),
                "country": data.get("countryCode", ""),
                "source": "AbuseIPDB",
                "detail": f"信頼スコア: {score}/100, 報告件数: {data.get('totalReports', 0)}",
            }
        elif resp.status_code == 429:
            logger.warning("AbuseIPDB レート制限に達しました")
    except requests.RequestException as e:
        logger.debug(f"AbuseIPDB API エラー: {e}")
    return None


def _check_ip_api(ip: str) -> Optional[dict]:
    """
    ip-api.com を使ってIPの地理情報と基本的な評判をチェックする。
    (無料・無認証だが詳細な悪意スコアはない)
    """
    try:
        resp = requests.get(
            f"http://ip-api.com/json/{ip}",
            params={"fields": "status,message,country,countryCode,isp,org,as,proxy,hosting"},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success":
                is_proxy = data.get("proxy", False)
                is_hosting = data.get("hosting", False)
                # プロキシ/ホスティングは要注意
                is_suspicious = is_proxy or is_hosting
                detail_parts = []
                if is_proxy:
                    detail_parts.append("プロキシ/VPN")
                if is_hosting:
                    detail_parts.append("ホスティングサービス")
                return {
                    "ip": ip,
                    "is_malicious": False,  # ip-api では確定的な悪意判定はしない
                    "is_suspicious": is_suspicious,
                    "confidence_score": 50 if is_suspicious else 0,
                    "reports": 0,
                    "country": data.get("countryCode", ""),
                    "isp": data.get("isp", ""),
                    "org": data.get("org", ""),
                    "source": "ip-api.com",
                    "detail": "、".join(detail_parts) if detail_parts else "正常",
                }
    except requests.RequestException as e:
        logger.debug(f"ip-api.com エラー: {e}")
    return None


def _safe_result(ip: str, reason: str) -> dict:
    return {
        "ip": ip,
        "is_malicious": False,
        "is_suspicious": False,
        "confidence_score": 0,
        "reports": 0,
        "country": "",
        "source": reason,
        "detail": "チェック不要" if reason == "private" else "不明",
    }


def _is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.IPv4Address(ip)
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except ValueError:
        return False


def _get_cached(ip: str) -> Optional[dict]:
    if ip in _ip_cache:
        ts, result = _ip_cache[ip]
        if time.time() - ts < CACHE_TTL:
            return result
        del _ip_cache[ip]
    return None


def _set_cache(ip: str, result: dict) -> None:
    _ip_cache[ip] = (time.time(), result)


def clear_cache() -> None:
    """IPキャッシュをクリアする"""
    _ip_cache.clear()
